# Analyzer architecture: multi-browser, responsiveness, orchestration

Scope of this document: finalising how The AI Site Auditor runs at scale, and the responsiveness
capability that extends what it judges. It covers four things, in the order they were built:

- **D. A concrete bug fix** — the honeypot false negative (fixed first, because everything after
  it should be measured against a codebase that isn't quietly wrong).
- **B. Responsiveness** — the substantial new capability: seven checks, a new scored area.
- **A. Multi-browser** — what running more than one engine actually buys, and what was rejected.
- **C. Orchestration** — a job queue, concurrency, and the scaling ladder from one container to
  Kubernetes, with runnable config for both ends.

Everything below is checked against the numbers this session actually produced: 159 tests passing
(`npm test`), `npm run typecheck` clean, and specific fixture/integration runs cited where a claim
needs one. Nothing here is an invented figure.

## D. The honeypot false negative

`src/agents/ai-site-auditor/essentials.ts`'s in-page script decided a form field was a honeypot
(a hidden field used to catch bots — see `readiness.no-spam-protection`) by reading
`getComputedStyle(control)` on the control itself and checking for `display:none`,
`visibility:hidden`, or `opacity:0`.

The bug: **CSS `opacity` is not an inherited property.** `visibility` is — so a honeypot hidden by
wrapping it in a `visibility:hidden` container was already caught. But the far more common pattern
— wrap the field in a container styled `opacity:0` (often combined with taking it off-canvas) —
was invisible to this check, because `getComputedStyle(control).opacity` reports `1` regardless of
what an ancestor's opacity is. **A site with a real, working honeypot was reported as having no
spam protection at all**, which is the worst kind of false negative for a launch-readiness tool:
it tells an owner to add a defence they already have, and it silently misreads real spam
protection as absent across every audit of a site built this way.

**Fix** (`essentials.ts`): walk the ancestor chain from the control up to the document root,
checking each ancestor's own `display`/`visibility`/`opacity` (not the control's), and additionally
flag a control positioned more than 5000px off-canvas (`left`/`top ≤ -5000px`) — the other common
honeypot idiom, which doesn't rely on any hiding style at all.

**Tests** (`tests/ai-site-auditor/essentials.test.ts`): three new cases — opacity:0 wrapper, off-
canvas positioning, and a plainly visible extra field that must *not* be flagged. Verified the
regression is real, not theoretical: reverted the fix, ran the suite, and both positive cases
failed (`false !== true`); restored the fix, all three pass. This is the standard this repo already
holds itself to (deterministic, testable, no invented figures) — the same standard the rest of
this document tries to meet.

## B. Responsiveness

### Why this is worth a new scored area, not folding into Design

Design (`design.ts`) is intentionally scored by **accumulation**: no single tell (an Inter font, a
violet gradient) is a defect, so each one costs a small fixed amount and the pattern is what
matters. Responsiveness checks are different in kind: a page either scrolls sideways on a phone or
it does not. That is a real, binary functional defect with a severity that doesn't depend on how
many other responsiveness problems exist alongside it — the same shape as `search`/`build`/
`readiness`, which are severity-weighted (`WEIGHTS`: critical -40, high -18, medium -8, low -3).
Responsiveness (`rules.ts`'s `responsive()`) is scored the same way. Folding seven functional
defects into design's "N tells cost N×6 points" model would have under-priced a page that
genuinely does not work on a phone, and over-priced a page that merely uses a fashionable font.

### Measurement: reflow, not reload

The auditor already renders every page once in Chromium at the default viewport. Re-navigating
five to seven more times per page to check other widths would multiply page-load cost by that
factor. Instead, `collect.ts`'s `measureResponsive()` **resizes the already-loaded page**
(`page.setViewportSize`) and re-runs a measurement script — a reflow, not a navigation, so the
network and JS-execution cost of loading the page is paid once regardless of how many viewports
are checked afterward.

To bound total cost on a large crawl, the responsiveness pass runs on only the first
`RESPONSIVE_MAX_PAGES` (5) pages of a crawl (`responsive.ts`), not all `max_pages` (up to 50): a
site's layout defects come from its shared template, not from each individual page, so auditing
every page buys little additional signal for a real multiplier in render time.

### The seven viewports, and why two of them are "wrong" on purpose

```
360   small phone       ┐
390   phone             ├─ the five widths asked for
768   tablet            │
1280  laptop            │
1440  desktop           ┘
480   between phone/tablet   ← deliberately in the gap
1024  between tablet/laptop  ← deliberately in the gap
```

The five named widths are the ones a design normally gets checked at. 480 and 1024 sit
deliberately in the gaps between them. This exists specifically to implement "layout that breaks
between breakpoints rather than at them": a page can be clean at 360, clean at 768, and still be
broken at 480 if its CSS handles `max-width:400px` and `min-width:600px` but has nothing covering
401–599px — a `@media` rule with a hole in it that nobody would find by only ever resizing to the
named widths. `breaksBetweenBreakpoints()` reports this only when *both* named neighbours of the
gap width are clean — overflow at a named width too is just ordinary overflow, already reported by
the horizontal-overflow check, not a "the gap specifically" story.

### The seven checks

All thresholds live in pure, unit-tested functions in `src/agents/ai-site-auditor/responsive.ts`
(`tests/ai-site-auditor/responsive.test.ts`); `rules.ts`'s `responsive()` turns their output into
scored findings. Every check has a fixed severity, per this repo's rule that severity is never
decided at run time.

| Check | Threshold | Severity | Why |
|---|---|---|---|
| `responsive.horizontal-overflow` | `scrollWidth − viewportWidth > 2px` (tolerance for sub-pixel rounding) | **high** | Forces sideways scrolling; reads as a broken page, not a design choice |
| `responsive.breaks-between-breakpoints` | overflow at 480/1024 only, both named neighbours clean | **medium** | The design was verified at fixed numbers, not the range a real window can be |
| `responsive.small-tap-targets` | any dimension `< 44px` at 390px width (Apple HIG / Google Material's shared minimum) | **medium** | A thumb misses and hits the wrong control |
| `responsive.overlapping-tap-targets` | two tap targets' boxes genuinely intersect at 390px | **high** | A visitor cannot reliably choose between two controls occupying the same space |
| `responsive.clipped-text` | `overflow:hidden` and `scrollWidth/Height − client > 2px`, **and no `text-overflow:ellipsis`** | **medium** | Content is silently gone with no indication there was more — the ellipsis case is a deliberate, readable UI pattern and is not flagged |
| `responsive.disappearing-content` | a link reachable at 1440px, absent at 360px, same href not present elsewhere | **high** | Content simply gone on a phone with nothing in its place |
| `responsive.oversized-images` | `naturalWidth / renderWidth ≥ 2` (low band) / `≥ 4` (medium band), measured at 360px | **low**/**medium** | Full download weight for a fraction of the display; 2× is a legitimate retina pull, so that exact ratio is the floor, not itself a hit |

Two deliberate false-positive guards, found and fixed against a real fixture during this session
(not hypothetical):

- **Tap-target sizing excludes plain inline text links** (`<a>` with computed `display:inline`).
  The first version flagged every ordinary prose/nav link — `<a href="/">Home</a>` in a plain
  `<nav>` with no styling is `display:inline`, ~20px tall, and would fail a flat 44px rule on
  nearly every page on the web. Real audits (Lighthouse's tap-target check included) treat a link
  flowing inside text differently from a discrete button or icon link; this repo's version of that
  distinction is the `display:inline` exclusion. Caught by the "clean fixture trips nothing"
  integration test (`tests/ai-site-auditor/responsive-integration.test.ts`) against the existing
  plain SSR fixture, before it shipped.
- **Disappearing-content excludes `nav`/`header` regions.** A link folding behind a mobile
  hamburger toggle is ordinary, correct responsive design; a static check cannot tell "gone" from
  "one tap away inside the toggle", so it does not try, and only flags content outside the
  navigation.

### Verification

- `tests/ai-site-auditor/responsive.test.ts` — every pure function, no browser.
- `tests/ai-site-auditor/units.test.ts` — one `evaluate()`-level test with a hand-built
  `ResponsiveRaw[]` fixture exercising all seven checks together, confirming severities and that a
  clean capture trips nothing; plus the "not-measured never reads as a pass" regression extended to
  the new area.
- `tests/ai-site-auditor/responsive-integration.test.ts` — **real browser**, real HTTP server
  (`fixtures/ai-site-auditor/responsive-site.ts`, fabricated, no real names): a page wearing one of
  every defect on purpose (a CSS gap between two `@media` rules, two overlapping 26px buttons, a
  `nowrap`/`overflow:hidden` paragraph, an SVG with a 2000×1000 intrinsic size shown at 200×100, and
  a non-nav link removed below 480px), driven through `collect.ts`'s actual viewport-resize pass
  end to end, and a matching negative test against the existing plain SSR fixture. Both pass.

## A. Multi-browser

**Recommendation: Chromium is the only engine that runs automatically. WebKit and Firefox are a
full re-run on request (`engine: 'chromium' | 'firefox' | 'webkit'`), never an automatic second or
third pass.**

The honest version of "what does another engine buy":

- **Layout and CSS rendering are genuinely engine-dependent.** Every responsiveness check, the
  design-tell checks that read computed styles (`design.ts`), and to a lesser extent things like
  focus-visible behaviour, can legitimately differ between Chromium/Blink, WebKit and Gecko.
  WebKit is the only one of the three that is a real proxy for Safari and iOS — and a real share of
  traffic to most sites is iPhone Safari, which does not share Chromium's rendering engine at all.
- **Most of the 87+ checks are not engine-dependent in any way that matters.** robots.txt parsing,
  sitemap fetching, HTML structure (title, meta description, JSON-LD, canonical, heading count),
  secret-scanning in JavaScript bundles, and the bot user-agent probes are plain HTTP/text
  operations or read the DOM after parsing — Chromium's DOM, Gecko's DOM and WebKit's DOM agree on
  what `document.title` is. Running these through three engines is three times the cost for
  identical output.
- **Running all three by default was rejected.** It roughly triples wall-clock time (three browser
  launches, three full page-render passes) and triples peak memory (three Chromium-class processes
  instead of one) for a signal that only a fraction of the checks can even produce differently.
  Against `docs/DEPLOYING-THE-WORKER.md`'s own sizing numbers (a browser context costs 150–250MB
  and up), that is a real cost, not a rounding error, paid on every single audit whether or not the
  site has any WebKit-specific issue at all.
- **A single switchable engine, run on request, gets the actual value at near-zero default cost.**
  `collect.ts` now accepts `engine` (`CollectOptions.engine`, threaded through the agent's
  `inputSchema`, the worker's `SubmitBody`, and the CLI's `--engine` flag). An operator who cares
  about the Safari-specific signal — because the responsiveness or design areas are borderline, or
  because the site's traffic is known to skew iOS — re-runs the same audit with `engine: 'webkit'`
  and reads that report instead. Firefox exists for the same reason as a third opinion, without
  ever being the default. Nothing about the primary crawl path changed cost; the 138 tests that
  existed before this session, plus every test added in it, all still pass with Chromium as the
  implicit default they've always assumed.

What was explicitly **not** built, and why: an automatic Chromium-plus-WebKit dual pass with a
"these two engines disagree" diff finding. It's a reasonable idea and was considered, but it
doubles cost on every audit to catch a comparatively rare class of engine-specific layout bug, and
it needed a new `CheckResult` shape (per-engine evidence) and a new fixture proving a genuine
cross-engine divergence to be worth trusting — more surface area than this session's budget could
verify properly. The `engine` switch gets most of the value (the operator explicitly asks for the
WebKit-rendered report when they have a reason to) for a fraction of the implementation and
runtime cost, and is the honest "not a foregone conclusion" answer: running a page in more than one
engine buys real signal for a minority of checks, and that is worth a deliberate re-run, not a
default multiplier.

## C. Orchestration

### What exists today (before this session)

- `src/api/worker.ts`: `POST /worker/audits` returns `202` immediately; `finishRun` runs in the
  background (fire-and-forget); a callback POSTs the result. Bearer-authed.
- No queue, no concurrency limit: **every** submission launched its own Chromium instance
  immediately (this was explicit, documented behaviour in `docs/DEPLOYING-THE-WORKER.md`).
- Timeouts exist per-page (`timeout_ms`, 1s–120s) and the crawl is bounded (`max_pages`, ≤50);
  response bodies are capped at 3MB and scanned script bytes at 8MB (`collect.ts`'s `MAX_BODY`/
  `MAX_SCRIPT_BYTES`) — enormous pages were already handled.
- Hostile pages: dialogs (`alert`/`confirm`/`prompt`) are now handled explicitly
  (`autoDismissDialogs` in `collect.ts`) rather than relying on one engine's implicit default —
  see the note on this in the responsiveness section's neighbour; verified to not regress behaviour
  either way, and now pinned by a test so it can't regress silently if a future engine is less
  forgiving.
- Callback delivery already retries (`src/core/callback.ts`: 4 attempts, capped exponential
  backoff, 500ms–8s) — that part of "retries" was already solid.

### What this session added: an in-process concurrency gate

`src/core/concurrency.ts`'s `Gate` is a plain counting semaphore with a FIFO wait queue — no
timers, no external dependency, fully unit-tested with manually-controlled promises
(`tests/api/concurrency.test.ts`). `AUDIT_WORKER_CONCURRENCY` (default **2**) caps how many audits
one worker process runs their browser for at once; the request still answers `202` immediately,
but `finishRun` only actually starts once a slot is free (`worker.ts`'s `gate.run(...)`). A new
`GET /worker/queue` reports `{ active, queued, limit }` for an operator deciding whether to raise
the limit or the replica count. Verified in `tests/api/worker.test.ts` with a controllable fake
agent: submitting past the limit measurably delays the second audit's start and is visible on the
queue endpoint, and releasing the first frees the second in submission order.

Why **2** by default: `docs/DEPLOYING-THE-WORKER.md`'s own numbers put a Chromium context at
150–250MB idle, growing with page weight, on a documented 1GB-minimum container. Two concurrent
contexts plus the Node process itself fits comfortably; raising the limit without raising memory
is exactly the OOM risk the whole feature exists to prevent, which is why the Kubernetes
Deployment ties `AUDIT_WORKER_CONCURRENCY=2` to `1536Mi` limits, not to the CPU request.

Why an **in-process** semaphore rather than a durable, cross-process queue (Redis/BullMQ/SQS) from
the start: it doesn't survive a restart and doesn't coordinate across replicas, and that is a real
limitation — but it is the correct amount of machinery for "one worker, don't let it OOM itself,"
and every rung above it (more replicas, then Kubernetes) is a horizontal-scaling answer, not a
queue-durability one. A durable queue earns its cost when a submission must survive a worker crash
or must be load-balanced fairly across many workers by something smarter than "whichever pod's
Service round-robin happened to land the request" — see the ladder below for exactly where that
is.

### Isolation between audits

Each audit gets its own `BrowserContext` (`collect.ts`: separate `renderCtx`/`rawCtx` per crawl,
new for each `collect()` call) — no cookies, storage or state leak between two audits' pages, even
concurrent ones sharing the same `Browser` process. Two concurrent audits under the `Gate` share a
process's memory and CPU but never share page state. Full process-level isolation (one container
per audit) was considered and rejected as unnecessary: the cost of a `Browser` launch (hundreds of
ms) many times a day is worse than the isolation gap it would close, given `BrowserContext` already
prevents the actual cross-contamination risk (one site's cookies or `localStorage` leaking into
another's audit).

### The scaling ladder, and where each rung stops being enough

| Rung | What it is | Run it until… |
|---|---|---|
| **1. One container** | `docker build` + `docker run` (already existed: the Dockerfile, verified 7.4s real audit) | You are the only caller, or load is bursty and rare enough that an occasional queued audit waiting behind `AUDIT_WORKER_CONCURRENCY=2` is fine. |
| **2. `docker compose`** (`deploy/docker-compose.yml`, new) | One box, resource limits (`mem_limit`/`cpus`), restart policy, healthcheck | You need those guardrails on a single host (a VM, a small box you already run other things on) and can tolerate that host being a single point of failure. `docker compose up --scale audit-worker=N` even gets you more replicas *on that one box* — still no load balancing across them and still one box's outage takes all of them down. |
| **3. Kubernetes** (`deploy/k8s/`, new) | Deployment + Service + HPA + PodDisruptionBudget, multi-node | **You need more than one node** (one box's failure must not take the worker down), **or** load is variable enough that autoscaling actually saves meaningful cost/capacity over a fixed replica count, **or** you already run Kubernetes for other services and adding one more Deployment is marginal cost rather than a new thing to operate. |

**Do not reach for Kubernetes before you need multiple nodes or real autoscaling.** A single box
running `docker compose` with `AUDIT_WORKER_CONCURRENCY` sized to its memory handles a genuinely
large amount of traffic — Chromium audits are I/O/render-bound, not CPU-bound (already documented),
so a 2–4 vCPU / 4–8GB box with concurrency raised to match comfortably serves many audits an hour
before a second box is the right next step. Kubernetes buys self-healing, horizontal autoscaling
and multi-node resilience — real things — at the cost of a control plane, manifests to maintain,
and an operational surface this repo's own principles (deterministic first, no over-engineering)
say not to pay for until the first rung's ceiling is actually the problem.

### The Kubernetes manifests (`deploy/k8s/`)

- **`deployment.yaml`**: `replicas: 2` floor (a redeploy or crash should never mean zero capacity);
  `RollingUpdate` with `maxUnavailable: 0` and a 60s `terminationGracePeriodSeconds` (an audit takes
  tens of seconds — a naive rolling update sending `SIGTERM` mid-crawl is a real failure mode, not
  a hypothetical one); resource requests/limits sized to `AUDIT_WORKER_CONCURRENCY=2` (768Mi
  request / 1536Mi limit, 250m/1000m CPU); `livenessProbe` on cheap `/health` (never flaps under
  load); `readinessProbe` on `/health/browser` (the one that actually proves Chromium launches —
  same reasoning `docs/DEPLOYING-THE-WORKER.md` already gives for Railway/Fly/Render — with a
  longer period than liveness because it genuinely costs a browser launch every time it's called);
  non-root `securityContext` matching the image's own `pwuser`; an `emptyDir` for `/data`, ephemeral
  on purpose because the callback carries the full report inline (same reasoning the existing
  per-host docs already give).
- **`service.yaml`**: plain `ClusterIP` — this worker is meant to sit behind the calling app's own
  ingress/gateway, not be reachable directly.
- **`hpa.yaml`**: scales on **memory first, CPU second** (`averageUtilization: 75`/`80`), not CPU
  alone — because the documented "I/O/render-bound, not CPU-bound" reality means a fully-booked
  worker (both concurrency slots busy, requests queueing) may never trip a CPU threshold. Slow
  scale-down (5 minutes' stabilization) so a pod mid-audit is not pulled out from under it the
  moment load dips. The better long-run signal — actual queue depth from `GET /worker/queue` — needs
  a metrics adapter (Prometheus + `prometheus-adapter`, or KEDA) reading that endpoint; deliberately
  not set up here, noted in the manifest as the next rung once memory/CPU autoscaling stops being
  precise enough.
- **`pdb.yaml`**: `minAvailable: 1`, so a node drain or cluster upgrade cannot evict every replica
  in the same voluntary-disruption window.
- **`configmap.yaml`/`secret.example.yaml`**: `AUDIT_WORKER_CONCURRENCY` and `LLM_PROVIDER=none`
  as config; the bearer token as a template, never a real value, with a comment steering towards
  `kubectl create secret` over committing one.
- **`kustomization.yaml`**: `kubectl apply -k deploy/k8s` after supplying a real secret. Rendered
  and validated with `kubectl kustomize` during this session (no live cluster available to apply
  against, but the manifests build cleanly and every `apiVersion`/`kind` is current — `apps/v1`,
  `autoscaling/v2`, `policy/v1`).

`deploy/docker-compose.yml` was validated with `docker compose config` in this session and parses
correctly (image build context, environment substitution, healthcheck, resource limits all render
as expected).

## What was rejected, in one place

- **Automatic multi-engine (Chromium + WebKit every audit).** Triples cost for a minority-of-checks
  signal; a switchable `engine` gets the value on request instead. See "A. Multi-browser".
- **Folding responsiveness into Design's accumulation scoring.** These are functional defects with
  fixed severities, not aesthetic tells; folding them in would have mispriced both areas.
- **Checking every page of a crawl at every viewport.** Bounded to the first 5 pages
  (`RESPONSIVE_MAX_PAGES`) — a shared template's defects repeat across pages, so the marginal page
  buys little for a real multiplier in render time.
- **A flat 44px tap-target rule with no exception.** Caught its own false positive (plain inline
  text links) against a real fixture before shipping; excluded `display:inline` anchors.
- **Judging "content disappears on mobile" inside `<nav>`.** A hamburger-collapsed nav is normal,
  correct responsive design that a static check cannot distinguish from actually-gone content, so
  it doesn't try.
- **A durable, cross-process job queue (Redis/BullMQ/SQS) from the start.** An in-process `Gate`
  solves the actual documented risk (one worker OOMing itself) at far lower operational cost;
  durability and cross-replica fairness are real needs, but they are the Kubernetes rung's problem,
  not day one's.
- **Reaching for Kubernetes by default.** Not worth it below "need multiple nodes or real
  autoscaling" — see the scaling ladder above.
- **An automatic Chromium/WebKit divergence-diff finding.** Considered, rejected for this session:
  needed a new evidence shape and a proven cross-engine fixture to trust, more than the budget for
  this change could verify properly; the plain `engine` switch gets most of the value already.
