# Deploying The AI Site Auditor as a standalone worker

A separate app (typically a Next.js dashboard on Vercel, which cannot host Chromium) submits URLs
here and displays the result. This repo runs as that worker: a container with Chromium, exposing
a small bearer-authenticated HTTP contract on top of the same Fastify API described in the main
[README](../README.md#rest-api).

Nothing here is specific to a host. Pick Railway, Fly.io, Render, or any other container platform
that (a) runs an arbitrary Docker image, (b) lets you set environment variables, and (c) gives the
container roughly 1 vCPU / 1 GB RAM. See [Per-host notes](#per-host-notes) below.

## The worker contract

Everything under `/worker/` requires `Authorization: Bearer <AUDIT_WORKER_TOKEN>`. Unset that
variable and the worker refuses every `/worker/*` request with `503` rather than running open —
there is no "open" mode.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/worker/audits` | `{ url, callback_url, org_slug?, max_pages?, timeout_ms? }` → `202 { id, status: "queued" }` immediately; the audit runs in the background |
| GET | `/worker/audits/:id` | current state: `{ id, status, error, started_at, finished_at, scores?, grades?, findings_by_severity? }` |
| GET | `/health` | liveness only — process is up, no Chromium check |
| GET | `/health/browser` | **the one to probe** — actually launches and closes Chromium; `503` if it can't |

`status` is one of `queued`, `running`, `succeeded`, `failed` (from `src/core/db.ts`'s `RunStatus`).

When a run reaches `succeeded` or `failed`, the worker POSTs once to the `callback_url` you
submitted, with `Authorization: Bearer <the same AUDIT_WORKER_TOKEN>`, retrying a few times with
backoff on a network error or non-2xx response before giving up and logging (`src/core/callback.ts`,
default 4 attempts, capped exponential backoff). The body:

```jsonc
// succeeded
{
  "run_id": "…",
  "status": "succeeded",
  "scores": { "ai-visibility": 80, "search": 70, "build": 90, "design": 60, "readiness": 75 },
  "grades": { "ai-visibility": "B", "search": "C", "build": "A", "design": "D", "readiness": "C" },
  "findings_by_severity": { "critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4 },
  "report_html": "<!doctype html>…"   // the full self-contained report, inlined, not a path
}
// failed
{ "run_id": "…", "status": "failed", "error": "…" }
```

Your receiving endpoint should be idempotent on `run_id` (the worker's own retries, or a future
redelivery, can call it more than once) and should return a 2xx quickly — it is not the place to
do slow work.

The generic routes (`/agents/:name/runs`, `/engagements`, `/runs/:id`, …) are still there and still
unauthenticated, run synchronously, and are meant for the CLIs / local dev, not the hosted worker.
Nothing about them changed.

## Environment variables

| Variable | Set by | Purpose |
|---|---|---|
| `AUDIT_WORKER_TOKEN` | you, on **both** sides | shared secret: the caller sends it as a bearer token on `/worker/*`; the worker sends it back on the callback. Generate with `openssl rand -hex 32` or similar. Required — the worker refuses to start `/worker/*` without it. |
| `PORT` | host (usually automatic) | the worker binds `0.0.0.0:$PORT`; every platform below sets this for you |
| `LLM_PROVIDER` | you (default `none`) | keep `none` unless you are also running a local open-weight model next to the worker; there is no paid-API path (see [docs/models.md](models.md)) |
| `CHROMIUM_NO_SANDBOX` | the Dockerfile (`1`) | not something you need to set by hand; see [Why `--no-sandbox`](#why-no-sandbox-and-why-its-still-safe) |
| `AUDIT_WORKER_CONCURRENCY` | you, optional (default `2`) | how many audits this worker process runs their browser for at once; raise it with container memory, not independently — see [Memory and CPU](#memory-and-cpu) |
| `DB_PATH`, `WORKSPACE_DIR` | the Dockerfile | point at `/data/...`; mount a volume there if you want run history and reports to survive a redeploy (optional — the worker still works with an ephemeral disk, it just forgets old runs) |
| `BRAND_*` | you, optional | report letterhead; see `.env.example` |

On the **calling app's** side, set:

- `AUDIT_WORKER_URL` — the worker's base URL (e.g. `https://your-worker.up.railway.app`)
- `AUDIT_WORKER_TOKEN` — the same value you set on the worker

## Build and run locally

```bash
docker build -t ai-site-auditor-worker .
docker run --rm -p 8787:8787 \
  -e AUDIT_WORKER_TOKEN=dev-only-token-change-me \
  ai-site-auditor-worker
```

> This was written and the routes were tested against a real Fastify instance in this repo's own
> test suite (`npm test`), but the Docker image itself was **not** built or run in the environment
> this was authored in — Docker was not available there. Build it yourself before trusting it in
> production; the steps above and the curl checks below are how.

## Verify a deployment with curl

Replace `$URL` and `$TOKEN`:

```bash
# 1. Liveness (fast, no Chromium)
curl -sf "$URL/health"

# 2. Deep health: this is the one that matters. Chromium actually launches.
curl -sf "$URL/health/browser"
# {"ok":true,"chromium":true,"launch_ms":…}  — if this 503s, the deploy is not usable yet

# 3. Auth is enforced
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/worker/audits" \
  -H 'content-type: application/json' -d '{"url":"https://example.com","callback_url":"https://example.com"}'
# expect 401 (no bearer) — or 503 if you forgot to set AUDIT_WORKER_TOKEN on the worker

# 4. Submit a real audit against a local receiver (https://webhook.site/ works for a manual check)
curl -s -X POST "$URL/worker/audits" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"url":"https://example.com","callback_url":"https://<your-receiver>"}'
# {"id":"…","status":"queued"}

# 5. Poll it, and watch your receiver for the callback a few seconds/tens of seconds later
curl -s "$URL/worker/audits/<id>" -H "authorization: Bearer $TOKEN"
```

## Memory and CPU

Chromium is the whole reason this can't run on Vercel, and it is the whole sizing story:

- **RAM:** budget **≥ 1 GB** for the container. Chromium itself idles around 150–250 MB per
  browser context and grows with page weight and concurrent runs; the free/hobby tier of most
  platforms (512 MB or less) will OOM-kill mid-crawl on a page-heavy site. If your platform lets
  you pick, 1–2 GB is the comfortable range for `max_pages` up to the schema's cap of 50.
- **CPU:** 1 vCPU is enough for the deterministic checks this repo runs (no model inference in the
  default `LLM_PROVIDER=none` — see [docs/models.md](models.md)). Rendering many pages back to
  back is I/O- and render-bound more than CPU-bound.
- **Concurrency:** `POST /worker/audits` still answers `202` immediately, but the browser for the
  audit only launches once a slot is free — `AUDIT_WORKER_CONCURRENCY` (default `2`) caps how many
  run at once *per worker process*; anything past that queues in memory, in submission order (see
  `src/core/concurrency.ts`). `GET /worker/queue` reports `{ active, queued, limit }` for an
  operator deciding whether to raise the limit or run more replicas. This is a single process's
  queue: it does not survive a restart and does not coordinate across replicas — see
  [docs/ANALYZER-ARCHITECTURE.md](ANALYZER-ARCHITECTURE.md) ("Orchestration") for the point at
  which that stops being enough and a durable, cross-process queue is worth the extra moving part.
- **Disk:** each run writes `report.html`/`.md`/`.json` under `$WORKSPACE_DIR/<run_id>/` and a
  row in the SQLite file at `$DB_PATH`. Neither needs to survive a redeploy for the worker
  contract above to work (the callback carries the full report inline), so an ephemeral disk is
  fine; mount a volume at `/data` only if you want run history to persist.

## Verified end to end

The image in this repo was built and exercised on 17 September 2026 before being documented:

- `docker build` succeeds from `mcr.microsoft.com/playwright:v1.63.0-noble` (3.76 GB image).
- The container starts and `/health` answers 200 within about five seconds.
- `/health/browser` returns `{"ok":true,"chromium":true,"launch_ms":256}` — Chromium really does
  launch as the non-root user with `--no-sandbox`, which is the thing a liveness probe alone would
  not have caught.
- `/worker/audits` rejects a missing and a wrong bearer token with 401.
- A real audit of a live public site returned `202 {id, status:"queued"}` immediately, finished in
  **7.4 s**, and delivered its callback with the correct `Authorization` header, a `run_id`, all
  five area scores and grades, findings counts, and a 25 KB self-contained HTML report inlined in
  the payload. Polling `GET /worker/audits/:id` agreed with the callback.

So the contract in this document is observed behaviour, not intent.

## Why `--no-sandbox`, and why it's still safe

Chromium's own sandbox needs either a non-root process combined with a container-level seccomp
profile, or the `--no-sandbox` flag. Railway, Fly.io and Render (like most PaaS Docker runners)
run your image without letting you attach a custom seccomp profile, so the safe combination left
is: **run as a non-root user, and pass `--no-sandbox` to Chromium** — which is what this image
does (the base image's own `pwuser` account, and `CHROMIUM_NO_SANDBOX=1`). Losing Chromium's
internal sandbox is an acceptable trade here because the container itself is the sandbox boundary:
it runs as a low-privilege, non-root user with no other tenants, and every URL the auditor visits
is read-only browsing (no code executes with any elevated privilege as a result). This is the
standard, widely used pattern for headless Chrome in a generic container; see the
[Playwright Docker docs](https://playwright.dev/docs/docker) for the same trade-off spelled out
upstream. `CHROMIUM_NO_SANDBOX` is off by default everywhere except this Dockerfile — local dev,
CI and every existing test keep today's behaviour untouched.

## Per-host notes

None of the code favours one host. These are just the mechanical bits for each.

### Railway

- New project → Deploy from Dockerfile (this repo's root `Dockerfile`).
- Railway sets `PORT` automatically; the server already binds `0.0.0.0:$PORT`, nothing to change.
- Set `AUDIT_WORKER_TOKEN` (and `LLM_PROVIDER=none` if you want to be explicit) under Variables.
- Pick at least the 1 GB plan/instance size; the default 512 MB starter tier is tight for a
  multi-page crawl.
- Health check: point Railway's healthcheck path at `/health/browser`, not `/health`.

### Fly.io

- `fly launch` from this repo (it will detect the Dockerfile); say no to a Postgres/Redis add-on,
  neither is used.
- In `fly.toml`, set `[[services.tcp_checks]]` or an HTTP check against `/health/browser`, and
  size the VM with `fly scale memory 1024` (or more) — the default `shared-cpu-1x` with 256 MB will
  not hold Chromium through a real crawl.
- Set secrets with `fly secrets set AUDIT_WORKER_TOKEN=...`.
- If you want reports/history to survive restarts, `fly volumes create` and mount it at `/data`
  (matches `DB_PATH`/`WORKSPACE_DIR` in the Dockerfile); otherwise skip it.

### Render

- New → Web Service → Docker, pointed at this repo.
- Render also injects `PORT` automatically.
- Set `AUDIT_WORKER_TOKEN` under Environment.
- Choose at least the Standard plan (1 GB+); Free/Starter's memory ceiling is the same OOM risk as
  above.
- Health Check Path: `/health/browser`.
- Render's free/starter instances spin down on idle and cold-start on the next request; if the
  calling app submits rarely, expect the first audit after idle to be slower (container boot +
  Chromium download-free, since it's baked into the image — but still process startup) before the
  crawl itself begins.
