# forward-qa-agents

Four standalone agents that an organisation can drop into its own environment. No paid model,
no SaaS dependency: everything runs deterministically, and any model enrichment comes from an
open-weight model (DeepSeek, Kimi, Qwen) running locally. See [docs/models.md](docs/models.md).

| Plate | Agent | What it does |
|------:|-------|--------------|
| 44 | **The Forward Deployed Tester** (`forward-deployed-tester`) | Point it at a running web app. It crawls it, records findings (broken links, console errors, a11y gaps, slow pages), and provisions a complete Playwright + Playwright MCP test project with page objects, smoke specs, fixtures, CI workflow, and a report. Testing infrastructure delivered the way a forward-deployed engineer delivers software. |
| 45 | **The SDET Architect** (`sdet-architect`) | Point it at an existing test estate (Selenium in Java / Python / C# / JS, Cucumber, Postman). It inventories every artifact, extracts tests, locators, and assertions, standardises locators into robust Playwright forms, and generates one standardised Playwright + MCP architecture with a migration report listing every leftover. |
| 46 | **The AI Site Auditor** (`ai-site-auditor`) | Point it at a site built with an AI tool (Lovable, Bolt, v0, Replit, a Vite or CRA export). It compares what AI crawlers receive with what a browser renders, checks robots rules and firewalls per AI bot, search SEO, and builder mistakes including secrets in the JavaScript bundle, then writes a self-contained evaluation page with three scores. |
| 47 | **The Architecture Dossier** (`architecture-dossier`) | Point it at a git repository. From the committed HEAD only, it records the stack and versions, routes and API surface, data models, integrations and webhooks (and which verify signatures), auth and security signals, environment variable names, jobs, deploy, tests, docs and git history, merges the owner's stated facts (domains, hosting, costs, accounts, handover), and writes a private, buyer-grade dossier page plus `dossier.json`. A second command builds a portfolio index over several dossiers. |

Each agent is its own folder under `src/agents/`, has its own CLI, its own REST routes, its own
tests, and (plates 44 to 46) its own field-guide plate under `docs/agents/`. All four persist to the same SQLite
database and are exposed through one REST API.

**Live field guides:** [The Forward Deployed Tester](https://akc031185.github.io/forward-deployed-tester/) ·
[The SDET Architect](https://akc031185.github.io/sdet-architect/) ·
[The AI Site Auditor](https://akc031185.github.io/ai-site-auditor/) ·
[The SDET Roadmap](https://akc031185.github.io/sdet-roadmap/) — all generated from this repo, details
[below](#field-guides-one-site-per-agent-one-source). The thesis behind plate 44 is
[docs/forward-deployed-tester-thesis.md](docs/forward-deployed-tester-thesis.md); the working log is
[PROGRESS.md](PROGRESS.md).

## Quick start

```bash
npm install
npx playwright install chromium          # needed by the Forward Deployed Tester
npm run db:init                          # creates data/forward-qa.db

# Forward Deployed Tester against any web app
npm run agent:fdt -- --url https://shop.example.test --org acme --max-pages 10

# SDET Architect against an existing Selenium estate (fixture estate included)
npm run agent:sdet -- --src ./fixtures/sdet-architect --org acme --base-url https://shop.example.test

# AI Site Auditor against any site (two fabricated sites included)
npm run fixture:audit-sites                                   # SPA on :4801, server-rendered on :4802
npm run agent:audit -- --url http://127.0.0.1:4801/ --org acme  # then open workspace/<run_id>/report.html

# Architecture Dossier for any git repo (committed HEAD only; synthetic fixture and facts included)
npm run agent:dossier -- --repo ../some-app --out dossiers/some-app --facts some-app.facts.json
npm run agent:dossier:index -- --in dossiers --out dossiers --portfolio portfolio.json

# REST API
npm start                                # http://localhost:8787
```

Optional local model (free, offline once pulled):

```bash
./scripts/setup-local-llm.sh             # Ollama + deepseek-r1:8b
```

## REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/health` | liveness, active model provider, agent list |
| GET  | `/health/browser` | deep health: launches and closes a real Chromium instance |
| GET  | `/agents` | agent catalogue |
| POST | `/engagements` | `{ org, name, target_url? }` → engagement |
| GET  | `/engagements`, `/engagements/:id` | list / read |
| POST | `/agents/:name/runs` | `{ engagement_id, input }` → runs the agent synchronously, returns `{ run, output }` |
| GET  | `/runs?engagement_id=`, `/runs/:id` | run with its findings and artifacts |
| GET  | `/runs/:id/findings`, `/runs/:id/artifacts` | findings / generated files |
| GET  | `/agents/forward-deployed-tester/runs/:id/report` | report.md |
| GET  | `/agents/sdet-architect/runs/:id/migration` | MIGRATION.md |
| GET  | `/agents/ai-site-auditor/runs/:id/report` | report.html (the evaluation page) |
| GET  | `/agents/architecture-dossier/runs/:id/dossier` | index.html (the dossier page) |
| POST | `/agents/sdet-architect/preview` | `{ language, code }` → converted Playwright spec (no disk, no DB) |

Everything above is synchronous and unauthenticated — meant for the CLIs and local dev. Running
this repo as a standalone worker behind another app (Chromium doesn't run on Vercel) is a separate,
bearer-authenticated, asynchronous contract: `POST`/`GET /worker/audits[/:id]`, with a callback on
completion. See [docs/DEPLOYING-THE-WORKER.md](docs/DEPLOYING-THE-WORKER.md) for the full contract,
the Dockerfile, environment variables, and per-host notes (Railway/Fly.io/Render).

Example:

```bash
curl -s -X POST localhost:8787/engagements -H 'content-type: application/json' \
  -d '{"org":"acme","name":"checkout","target_url":"https://shop.example.test"}'
curl -s -X POST localhost:8787/agents/sdet-architect/runs -H 'content-type: application/json' \
  -d '{"engagement_id":"<id>","input":{"source_dir":"/abs/path/to/tests","org_slug":"acme"}}'
```

## Database

SQLite via Node's built-in `node:sqlite` (no server, no native build). Schema in `src/core/db.ts`:

- `engagements` — one per org / application
- `runs` — one per agent execution, with input and output JSON
- `findings` — severity-graded observations produced by a run
- `artifacts` — every file an agent generated, with its path and metadata

## Layout

```
src/core/        config, db, llm adapter (local models only), agent contract, runner
src/api/         Fastify REST server
src/agents/forward-deployed-tester/
src/agents/sdet-architect/
src/agents/ai-site-auditor/
src/agents/architecture-dossier/
docs/agents/     field-guide plates (the-forward-deployed-tester.md, the-sdet-architect.md, the-ai-site-auditor.md)
docs/models.md   model policy and tested local models
fixtures/        fabricated legacy test estate and fabricated sites used by tests and demos
tests/           node:test suites, one folder per agent
.claude/agents/  Claude Code subagent definitions for driving each agent
```

## The Architecture Dossier (plate 47)

The record a buyer's due diligence asks for, generated from the code rather than written from memory.

- **Input:** a git repository (or a subdirectory of one). It is snapshotted with `git archive` at HEAD into a
  temporary directory; the working tree is never read, so work in progress elsewhere cannot leak in.
- **Measured vs stated:** everything read from the commit or git history is labelled *measured*. An optional,
  hand-written facts file (zod-validated; see `fixtures/architecture-dossier/facts.json`) adds domains,
  hosting, owning entity, monthly costs, accounts to transfer, known gaps, handover steps and cross-app
  contracts, all labelled *stated*.
- **Secrets:** `.env`, `.env.*`, `*.pem`, key and credential files are deleted from the snapshot unread and only
  named (a committed one is a high-severity gap). `.env.example` is read for names. Values are never recorded,
  and a facts file containing anything shaped like a credential is refused.
- **Output:** `index.html` (static, no scripts, light and dark, phone-width safe, print-friendly, `noindex`) and
  `dossier.json` (schema in `src/agents/architecture-dossier/schema.ts`). `agent:dossier:index` turns a folder
  of dossiers plus a stated `portfolio.json` into one portfolio page (`index.html`, plus `portfolio.summary.json`)
  with a diagram of how the apps connect; the stated input is never overwritten.
- **Private by default:** the files stay where `--out` puts them. Nothing is uploaded or published.

## Field guides (one site per agent, one source)

Each agent has a field guide of its own, published from its own repo through GitHub Pages:

| Site | Live | Repo |
|---|---|---|
| The Forward Deployed Tester (plate 44) + the engagement process page | https://akc031185.github.io/forward-deployed-tester/ | `akc031185/forward-deployed-tester` |
| The SDET Architect (plate 45) | https://akc031185.github.io/sdet-architect/ | `akc031185/sdet-architect` |
| The AI Site Auditor (plate 46) | https://akc031185.github.io/ai-site-auditor/ | `akc031185/ai-site-auditor` |
| The SDET Roadmap (agentic AI testing, Selenium → Playwright) | https://akc031185.github.io/sdet-roadmap/ | `akc031185/sdet-roadmap` |

All four are **generated from this repo**; the site repos hold output only.

```
_build/build-catalog.ts        the generator (--site <config dir> --out <site dir>)
_build/sites/fdt/              site.json, categories.json, content/, process.html
_build/sites/sdet/             site.json, categories.json, content/
_build/sites/audit/            site.json, categories.json, content/, report-sample.png
_build/author/plates.mjs       plate text, code slices by line range, annotations
_build/author/diagrams.mjs     the inline SVG figures
assets/site.css                the shared stylesheet, copied into each site
```

```bash
npm run catalog:roadmap  # the SDET Roadmap from _build/author/roadmap-data.mjs → ../sdet-roadmap
npm run catalog:author   # author → JSON → all three sites (../forward-deployed-tester, ../sdet-architect, ../ai-site-auditor)
FDT_SITE_DIR=/path SDET_SITE_DIR=/path AUDIT_SITE_DIR=/path npm run catalog   # build only, custom site checkouts
```

Then commit and push inside each site repo. Edit `plates.mjs` and `diagrams.mjs`, never the JSON or HTML.

## Development

```bash
npm run typecheck
npm test
npm run dev          # API with reload
```

## Principles

1. Deterministic first. Every deliverable exists with `LLM_PROVIDER=none`.
2. Open-weight, local models only. The adapter rejects non-local endpoints.
3. One agent, one folder, one owner. Agents never import from each other.
4. No client, product, or colleague names in code, fixtures, or docs. Fabricated examples only.

MIT licensed.

## Known limitations

- The SDET Architect's parsers are line-oriented. A class minified onto a single line is
  classified as a page object and yields no tests; normal multi-line source converts as expected.
- The Forward Deployed Tester crawls same-origin links only and does not submit forms.
- The AI Site Auditor cannot observe prerendering served only to verified crawler IP addresses, and its
  secret scan matches known key shapes rather than every credential.
- The Architecture Dossier reads source statically. Route, auth, tenant and rate-limit signals are per handler
  file (a Fastify file with one guarded route marks all its routes as guarded), Fastify `register` prefixes
  are not applied, framework detection covers Next.js, Fastify, Express, Hono and Koa, and data models cover
  Mongoose, SQL `CREATE TABLE` and Prisma. Test cases are counted, not run, unless a saved run is supplied.
