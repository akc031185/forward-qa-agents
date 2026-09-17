# Progress log

Daily record of what was accomplished, newest day on top. Every working session must read this
file first and update it before ending. Run `npm run progress` to stamp a new day with measured
numbers, then fill in the Done / Decided / Open sections by hand.

Entries marked **reconstructed** were rebuilt after the fact from commit timestamps, file
modification times, run logs and the SQLite database, not written live. Treat their narrative as
best-effort and their numbers as exact.

---

## 2026-09-17 (Thursday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 21 (11 today, head `5b5154b`) |
| Pushed to origin | no (ahead 7, behind 0) |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 119 pass, 0 fail (11 suites) |
| Source lines (src/) | 7141 across 47 files |
| Test lines (tests/) | 1789 across 18 files |
| Agent runs in DB | 12 (forward-deployed-tester, sdet-architect, ai-site-auditor ×10; all succeeded) |

**Done**

- Read the log, checked all five folders against it: state matched. Put the overnight publish
  decision to the user, who chose to publish both sites, round the mascot value first, and
  cross-link all four mastheads.
- 00:45 Cross-linked every field guide site so a reader landing on one can reach the rest.
  Each masthead now carries the other three plus the QA Agents hub; footers and READMEs list the
  same set. The FDT thesis link moved from the nav to the footer to hold the bar at seven items.
  `assets/site.css`: nav wraps on desktop, scrolls horizontally under 560px, so it never overflows.
- Rounded two generated pixel values that were leaking float noise into published HTML: the hero
  mascot (`106.39999999999999px` → `106px`, `_build/build-catalog.ts`) and the confidence-ladder
  bars (`115.49999999999999` → 0.1px precision, `_build/author/diagrams.mjs`).
- 01:02 Gates green, committed `27f552f` (9 files, +28/−20) and pushed.
- **Published two new public GitHub Pages sites**, both built · live · verified:
  `akc031185/ai-site-auditor` (commit `4733f00`) at https://akc031185.github.io/ai-site-auditor/
  and `akc031185/sdet-roadmap` (commit `abfbbbb`) at https://akc031185.github.io/sdet-roadmap/.
  Each got a README pointing back at the generator and the MIT LICENSE from the FDT repo.
- Pushed the rebuilt FDT (`56297c1`) and SDET Architect (`92710b2`) sites, which carried the
  mascot fix that had sat uncommitted since 09-14.
- Verified live: all eight cross-link targets return 200, and the fetched mastheads on all four
  sites serve the new nav.
- Made `forward-qa-agents` **public** after a full audit of the working tree and all history:
  no secrets in any blob, no client or colleague names, fixtures all on reserved test domains,
  emails all `example.*`. Scrubbed three internal references from this log first (two other
  internal guides by name, defects found on unrelated personal builds, a hint at a second GitHub
  account) — commit `72372ac`. History still holds them; accepting that was the user's call.
  Every deep link from the four public sites now resolves for an anonymous visitor.
- README: linked the four live guides, repaired the stale table (two were listed as unpublished)
  and corrected counts left from when there were two agents (`27664e3`).
- **Plate 46 grew from 51 checks to 87**, from three creator checklists the user supplied
  (pre-launch, legal, and "20 reasons why your app looks vibecoded"):
  - `a7f5bf5` **Design originality**, 19 checks — the violet-to-blue gradient, gradient hero text,
    emoji headings, scaffold fonts, glassmorphism, the three-icon row, badge above the headline,
    Lucide icons, untouched shadcn, fade-on-scroll, cursor beam, opacity-only hover, off-scale
    spacing, italic serif accents, buzzword copy, em-dash density, WCAG AA contrast, grain over
    gradient. Same architecture as the rest: an in-page script measures, pure functions judge.
  - `4cb36de` **Launch readiness**, 17 checks — policies, consent before tracking, third-party
    inventory, forms, spam protection, analytics, CTA, contact and legal identity, dead-end 404,
    focus outline, divs wired to click.
  - `29f7613` the report now leads with a prioritised fix plan; `1094b33` findings fold into the
    plan rows and evidence renders as evidence; `b60371d` client-facing header and branded footer.
- Two false positives found by running against real sites, both fixed before any client saw them:
  `0b01c59` a form with no `action` is unverifiable, not broken (a React `onSubmit` form is fine),
  and `5b5154b` `noindex` on `/login` or `/auth/register` is correct practice, not a defect.
  The second was caught on the user's own site and moved its search score from 32 to 50.
- Scoring bug caught by an integration test: design tells are mostly info-weight, so a site could
  trip all nineteen and still score 100. Design is now scored by accumulation, 6 points per tell.
- Ran the tool on three real sites with the owner's consent: two belonging to a contact who asked
  for feedback, and the user's own. All three fail launch readiness hardest (no privacy policy,
  no terms, no analytics, unprotected forms), while building and AI visibility are fine.

- **Afternoon, a second repo: `ai-tool-dashboard` (investoraiclub.com).** The user asked for the
  auditor's findings fixed there and for the tool to be offered on that site. Found and fixed, in
  order of severity:
  - Every `<title>` on 11 pages rendered as `About | <!-- -->InvestorAI Club` to crawlers.
    `<title>Text | {EXPR}</title>` gives React two children and its SSR writes a `<!-- -->`
    separator; comments are not parsed inside `<title>` (RCDATA), so that is the literal string
    Google and every AI crawler received. Eleven titles across ten files.
  - **Deployments had failed since February.** `vercel.json` declared an hourly cron and the
    account had moved Pro -> Hobby, which permits daily at most, so Vercel rejected every push
    before building. The site was serving February's code. Moved the hourly email drip to a
    GitHub Actions workflow calling the same route with the same `CRON_SECRET` bearer header,
    keeping a daily Vercel call as a backstop. First successful deploy in 209 days.
  - **Eight production environment variables carried a literal `\n`** from one bad paste. That
    silently broke: the Stripe webhook secret (paid proposals never marked paid), the Stripe
    publishable key, all four S3 variables, `ADMIN_EMAILS` (locking the owner out of admin), the
    Calendly URL, the GHL token and location/pipeline ids, and the GHL chat widget's location id.
    Nine integrations, no error anywhere: these all fail silently by design. The GHL token was
    never expired — stripped of the escape it returned 200 immediately.
  - Also added: privacy and terms pages, security headers (no `next.config.js` existed), llms.txt,
    og:image, canonical host fix, published support address.
- Three parallel subagents in git worktrees added analytics (Plausible, env-gated), honeypot and
  time-trap spam protection on the three public forms, and `/api/health/integrations` with an
  `envCheck` module that specifically detects the trailing-`\n` class. First run against
  production found a ninth problem: the AWS IAM key no longer exists (`InvalidAccessKeyId`), so
  uploads are down.
- **Worktree isolation lesson:** `isolation: "worktree"` creates a worktree of *this session's*
  repo, not of the repo the task concerns. All three agents landed in `forward-qa-agents` and one
  correctly refused to improvise. Re-dispatched against hand-made worktrees of the right repo with
  `node_modules` symlinked.

**Decided**

- Publish both remaining sites now rather than hold them: four sites, one masthead set, one hub.
- Nav caps at seven items; anything beyond that goes to the footer. The thesis was the first casualty.
- Generated pixel values get rounded at the generator, not patched in output.
- Make the source repo public and accept the five scrubbed lines remaining in history, rather than
  rewrite history and break the log's own commit citations and two published site references.
- Design is scored by accumulation, not severity: no single tell is a defect, the pattern is.
- Seven legal items stay out of the tool — dark patterns, hidden fees, unsupported claims, fake
  reviews, licensing, age consent, whether collected data is necessary. A deterministic checker
  cannot rule on them and pretending otherwise would be worse than saying nothing.
- Report branding lives in the environment (`BRAND_*`), never in source: the house rule keeps real
  company names out of the repo, and one checkout can then serve more than one brand.
- Declined to build an Instagram scraper. Meta's Graph API genuinely cannot return text burned into
  reel frames, so the official API was not an answer — but a scraper is fragile ground for a paid
  service. The sanctioned route that does work is "download your information", then OCR locally.

**Open / next**

1. **Handed back to the user on investoraiclub.com:** Stripe is in *test* mode so no card can be
   charged (the webhook secret is per-mode, so the live endpoint's secret is needed, not the test
   one repaired today); the AWS IAM key must be reissued before uploads work; and
   `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` switches analytics on. The health endpoint returns 503 while any
   of these fail, so it is worth pointing an uptime monitor at it.
2. The GHL replacement question is now much smaller than estimated: the account holds 1 contact,
   1 opportunity, 1 pipeline, 0 custom fields and 0 calendars (booking is Calendly). There is no
   CRM to migrate. `scripts/ghlInventory.ts` in that repo enumerates it; workflow and form scopes
   are missing from the token if a fuller picture is wanted.
3. The auditor integration design for that site is still unwritten — the user chose plan-first.
2. **Auditor slice three, still outstanding and approved:** image weight and compression, page load
   speed, and the 390px mobile pass (horizontal overflow, tap targets). Needs a performance
   collector; the design and readiness collectors are the pattern to follow.
3. **investoraiclub.com is its own thread.** Next.js, nine pages, already has `/login`,
   `/auth/register` and `/forgot-password`, so accounts exist. No billing, no Stripe, no pricing
   page anywhere. Worst findings: no privacy policy, no terms, no contact details, four forms whose
   submissions cannot be traced, no analytics, `/booking` shipping 2.3 MB of JavaScript, a canonical
   on `/how-it-works` pointing at the non-www host, and `/auth/register` with no `<title>`.
   The user wants the auditor added to that site as a tool with account and billing pages. The repo
   for it is not on this machine — ask for it before starting.
4. Add a clear next step (run it, contact, engagement offer) to the FDT and SDET sites.
5. Plate 44 redesign: ledger schema in `src/core/db.ts` first.
6. Bump `actions/checkout` and `actions/setup-node` to v5.

---

## 2026-09-14 (Monday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 8 (0 today, head `bf46c26`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 6 (CLAUDE.md, README.md, _build/author/diagrams.mjs, package.json, _build/author/roadmap-data.mjs, _build/author/roadmap.mjs) |
| Typecheck | pass |
| Tests | 99 pass, 0 fail (10 suites) |
| Source lines (src/) | 6023 across 45 files |
| Test lines (tests/) | 1431 across 16 files |
| Agent runs in DB | 4 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

- Crawled a comparison site (an SDET interview-prep business) at the user's request with a polite
  content-only crawler (1 req/s, no security probes; the AI Site Auditor was deliberately not used on
  a third-party site). 175 pages, 83,190 unique prose words vs our FDT site's 3 pages / 3,806 words.
  Theirs: far more content, 35% boilerplate, 412 calls to action, almost no citations. Ours: denser
  and more directive, but no calls to action. No FDT coverage on their side.
- User then asked for a dedicated space for what SDET openings ask for: agentic AI testing and
  Selenium-to-Playwright migration, with workflow, steps and measurables. Researched real 2026
  postings (RBC "Agentic SDET I", Apple "Senior SDET, LLM Evaluation & Automation"), Playwright test
  agents docs, OWASP LLM Top 10 (2025), Langfuse's evaluation layers, judge calibration (κ ≥ 0.6).
- Built **The SDET Roadmap**: `_build/author/roadmap-data.mjs` + `roadmap.mjs` → `../sdet-roadmap`
  (`npm run catalog:roadmap`). Track 1 agentic AI testing (6 stages, 29 gates), Track 2 Selenium →
  Playwright (6 stages, 31 gates). Each stage: goal, ≤ 6 steps, deliverable, exit gate table of
  metric · target · how to measure, with a browser-local checklist. Five diagrams. Checked at desktop
  and phone width: no overflow, no bullet over two lines, checklist persists across reloads.
- Session closed for the night. Local-only state to know about: `../ai-site-auditor` and
  `../sdet-roadmap` are built but not git repos; `../forward-deployed-tester` and
  `../sdet-architect` each have one uncommitted `index.html` (mascot size fix). Preview servers stopped.

**Decided**

- Track order follows the user's list (agentic first); new-to-Playwright learners do Track 2 stages
  0–2 first.
- No borrowed numbers as targets: case-study speed-ups (unverifiable) are excluded; targets are fixed
  bars or relative to the learner's own stage-0 baseline, and "our bar" is labelled.

**Open / next**

1. **Decide first thing in the morning (user said "make a call tomorrow"):** publish three sites? `akc031185/ai-site-auditor`, `akc031185/sdet-roadmap`,
   plus the mascot fix already rebuilt into the FDT and SDET site repos. Then cross-link all mastheads.
2. Add a clear next step (run it, contact, engagement offer) to the FDT and SDET sites; the comparison
   showed ours has none.
3. Plate 44 redesign: ledger schema in `src/core/db.ts` first.
4. Bump `actions/checkout` and `actions/setup-node` to v5.

---

## 2026-09-13 (Sunday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 7 (5 today, head `61115bd`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 16 (CLAUDE.md, README.md, _build/author/diagrams.mjs, _build/author/plates.mjs, _build/build-catalog.ts, package.json, src/api/server.ts, src/core/db.ts, tests/db.test.ts, tsconfig.json, .claude/agents/ai-site-auditor.md, _build/sites/audit/, docs/agents/the-ai-site-auditor.md, fixtures/ai-site-auditor/, src/agents/ai-site-auditor/, tests/ai-site-auditor/) |
| Typecheck | pass |
| Tests | 99 pass, 0 fail (10 suites) |
| Source lines (src/) | 6023 across 45 files |
| Test lines (tests/) | 1431 across 16 files |
| Agent runs in DB | 4 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

**Done**

- 16:55 Verified no TCC / EPERM blockers: file writes, git, GitHub auth, Node 24, SQLite all fine.
- 16:57 Gates green (typecheck, 89 tests). Committed all of Friday's work as `a160f25`
  (16 files, +2680): CI workflow, progress tooling, CLAUDE.md, field guide, README.
- 16:58 First push rejected: the `gh` OAuth token lacked the `workflow` scope needed to add
  `.github/workflows/ci.yml`. User ran `gh auth refresh -h github.com -s workflow`; pushed.
- 17:00 First GitHub Actions run `34770175543` completed **success** on ubuntu-latest, Node 24:
  npm ci, Chromium install, typecheck, tests. One annotation: checkout@v4 and setup-node@v4
  target Node 20 and are forced onto Node 24 (harmless for now).

- 17:30–19:00 Reworked the plates diagram-first at the user's request: at-a-glance pipeline SVG,
  short flowchart titles (full text + code behind the click), mechanism figures (crawl loop,
  locator ladder, severity map; normalisation trace, confidence ladder, status decision), examples
  collapsed. Then the bullet rule: any prose over two lines is a list of at most six bullets,
  enforced by the generator. Authoring source moved into `_build/author/{plates,diagrams}.mjs`
  (`npm run catalog:author`). Committed `dd39196`, pushed.
- 19:00–19:40 Added both plates to the shared field guide hub `akc031185/qa-agents` (GitHub Pages)
  as **Section 09 · Landing in a new environment**, plus the process page as **Guide 05**. Ported
  the v5 generator features into the hub's `build-catalog.ts`; all 38 existing plates rebuilt with
  only the code-modal markup changed; every link verified. Committed `2532c13` on branch
  `add-plates-44-45` and pushed the branch. **Not merged**: main deploys the live site.

- 19:40–20:30 User chose **two separate sites, one per agent**, not a hub section. Generator now
  takes `--site <config dir> --out <site dir>` and absolute `repoUrl` links; content split into
  `_build/sites/{fdt,sdet}/`; generated output removed from this repo. New public repos
  `akc031185/forward-deployed-tester` (plate 44 + process page) and `akc031185/sdet-architect`
  (plate 45), each a GitHub Pages site holding output only. Fixed a link bug: source and test
  folders drop the plate's `the-` prefix. Hub branch `add-plates-44-45` deleted, hub back on main.

- Evening: built **plate 46, The AI Site Auditor** (`src/agents/ai-site-auditor/`) at the user's
  request: an evaluator for sites built with AI tools. Sees each page twice (raw HTML with JavaScript
  off, as GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot get it, and rendered), checks robots.txt per
  AI agent (RFC 9309 matcher), requests the home page with each crawler's real user agent, scans
  bundles for keys (redacted), and runs 51 checks in three scored areas (AI visibility, Search,
  Build quality). Deliverable: a self-contained `report.html`, plus md/json, findings, artifacts.
  Grounded in vendor docs (OpenAI bots page, Anthropic crawler docs, Google "AI features",
  Vercel/MERJ crawler study); `llms.txt` absence is info only.
- DB: `AGENT_NAMES` drives the runs CHECK constraint; `Db` migrates old databases in place (tested).
- Validated before release on three real local builds (two CRA, one Next.js). Found and fixed three
  bugs: a render timeout that scored a site 100 while auditing nothing (now render never waits for
  the load event, failures are findings, empty audits are critical), a 50-word threshold that
  skipped small app shells (now 10 words, raw < max(5, 30%)), and a form label read as placeholder
  copy. Also: sitemaps on other hosts are no longer fetched. **Disclosure:** before that fix, one
  validation run followed a production sitemap URL and made up to six requests to that live site.
- Fixture sites (`npm run fixture:audit-sites`) and recorded demo runs: SPA `a70d48e1` 0·F / 46·D /
  23·F, 20 findings; server-rendered `23fed86c` 100·A / 97·A / 97·A, 2 low. 99 tests green.
- Plate 46 authored (`_build/sites/audit`, four diagrams, report screenshot) and built locally into
  `../ai-site-auditor`. Fixed the oversized single mascot on every generated home page; the two
  published sites are rebuilt locally with that fix but **not pushed**.

**Decided**

- The `gh` token for `akc031185` now carries `workflow` scope; no more push blockers for CI edits.
- The auditor is plate 46 in this repo, one folder like the others; its field guide gets its own
  site like plates 44 and 45 once the user approves publishing.
- Three field guides stay separate (QA Agents hub, SDET Architect, Forward Deployed Tester), each
  with its own home and cross-links in the masthead. No landing page for now.
- forward-qa-agents is the single source and generator for both sites; the site repos are output
  only (`npm run catalog:author` writes into the sibling checkouts, then commit and push there).

**Open / next**

1. Ask the user: publish `akc031185/ai-site-auditor` as a GitHub Pages site (public repo, output of
   `_build/sites/audit`), and push the mascot fix to the two existing site repos. Then add the audit
   site to the other two sites' mastheads.
2. Report the validation findings back privately (see the scratch reports); no secrets were found.
3. Start the plate 44 redesign: ledger schema in `src/core/db.ts` first (Baseline, Eval cube,
   Cost, Outcome, Verdict keyed on a unit of work), since every phase writes rows there. Then the
   Discover phase, folding the existing crawler in as one probe.
4. Update the README so plate 44 is described by the thesis definition, not as a crawler.
5. Bump `actions/checkout` and `actions/setup-node` to v5 when convenient to clear the Node 20
   deprecation annotation.

---

## 2026-09-11 (Friday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| Commits on main | 2 |
| Pushed to origin | yes, in sync |
| Uncommitted files | 12 (CI workflow, progress tooling, field guide: `_build/`, `assets/`, `agents/`, `index.html`, `process.html`, README/CLAUDE.md edits) |
| Typecheck | pass |
| Tests | 89 pass, 0 fail (10 suites) |
| Source lines (src/) | 4633 across 36 files |
| Test lines (tests/) | 1161 across 14 files |
| Agent runs in DB | 2 (forward-deployed-tester succeeded, sdet-architect succeeded) |

**Done**

- 04:22–04:57 Built the whole repo from scratch: core (config, SQLite db, local-only LLM adapter,
  agent contract, runner), Fastify REST API, both agents, fixtures, tests, field-guide plates,
  Claude Code subagent definitions. Committed as `bbc1413` at 04:57.
- 04:32 First live run of the Forward Deployed Tester against a local 3-page demo site on
  port 4711. Crawled 3 pages in 2.0 s, recorded 4 findings (1 broken link, 1 unlabeled form
  control, 2 low), provisioned 11 Playwright + MCP files. Run id `049b95fd`.
- 04:27 Wrote the GitHub Actions CI workflow (Node 24, Chromium, typecheck, test). Never committed.
- Morning to 10:03 Four-thread market research on the Forward Deployed Tester idea (FDE playbook,
  eval/observability tooling, AI assurance standards, local-model feasibility). Written up as
  `docs/forward-deployed-tester-thesis.md` and committed as `3e8c6fe` at 10:03.
- 18:31 Resumed with no session notes. Verified typecheck and tests green. Created this
  progress log, the `npm run progress` measurement script, and `CLAUDE.md` so future sessions
  keep the log current.
- 19:00–19:30 Built the field guide in the house catalog format (same generator and stylesheet as
  the earlier guides in this format, adapted for ESM and this repo's `src/agents/<slug>/` layout):
  `index.html`, `agents/the-forward-deployed-tester.html` (plate 44), `agents/the-sdet-architect.html`
  (plate 45), and a hand-written `process.html` covering the seven phases, five ledgers, working
  rules, session loop and cheat-sheet. Every code block is sliced from the real source by line
  range and annotated (116 annotations); every number comes from run `049b95fd` (FDT, 04:32) or
  run `46f19623` (SDET on the fixture estate, this evening: 12 files, 28 tests, 91.7% coverage,
  38 locators, 3 low, 26 files). Rendered and checked with Playwright at 1280 and 400 px; fixed an
  inherited stylesheet overflow in the example panels. Added `npm run catalog`.

**Decided**

- The category is unoccupied: nobody independently validates what a vendor's FDE delivered.
- Plate 44 as built is only a surface probe. The real Forward Deployed Tester is redefined around
  seven phases (Discover, Baseline, Golden set, Eval cube, Cost ledger, Pilot with causal design,
  Verdict and handover) writing to five ledgers keyed on a unit of work.
- Plate 45 (SDET Architect) stays as is; it is the deterministic regression layer.
- Principles hold: deterministic first, local open-weight models only, one agent one folder, no
  real client or colleague names anywhere.

**Open / next**

1. **Commit and push.** Nothing from today is in git yet: the CI workflow, `PROGRESS.md`,
   `CLAUDE.md`, `scripts/progress.mjs`, the field guide (`_build/`, `assets/`, `agents/`,
   `index.html`, `process.html`) and the README / package.json edits are all only in the working
   tree. Review the pages first (serve with `python3 -m http.server 8790` from the repo root,
   Chrome will not open `file://`), then one commit, push, and confirm the first Actions run is green.
2. Start the plate 44 redesign: ledger schema in `src/core/db.ts` first, since every phase writes
   rows there. Then the Discover phase, folding the existing crawler in as one probe.
3. Update the README so plate 44 is described by the thesis definition, not as a crawler.

*Entry reconstructed on 2026-09-11 evening from git log, file mtimes, `workspace/*/run.log` and
`data/forward-qa.db`; the 18:31 onward items were written live. Session closed shortly after midnight.*

---

<!-- Template for a new day (npm run progress inserts the header and snapshot for you)

## YYYY-MM-DD (Weekday)

**Snapshot at end of day**

| Metric | Value |
|---|---|
| ... | ... |

**Done**

- HH:MM What was built, fixed, run, or written. Reference commit hashes and run ids.

**Decided**

- Decisions and why. Link to the doc or commit that records them.

**Open / next**

1. Ordered list of what to pick up next session.

---
-->
