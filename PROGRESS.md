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
| Commits on main | 11 (1 today, head `27f552f`) |
| Pushed to origin | yes, in sync |
| Uncommitted files | 0 |
| Typecheck | pass |
| Tests | 99 pass, 0 fail (10 suites) |
| Source lines (src/) | 6023 across 45 files |
| Test lines (tests/) | 1431 across 16 files |
| Agent runs in DB | 4 (forward-deployed-tester:succeeded,sdet-architect:succeeded,ai-site-auditor:succeeded,ai-site-auditor:succeeded) |

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

**Decided**

- Publish both remaining sites now rather than hold them: four sites, one masthead set, one hub.
- Nav caps at seven items; anything beyond that goes to the footer. The thesis was the first casualty.
- Generated pixel values get rounded at the generator, not patched in output.

**Open / next**

1. **`forward-qa-agents` is a private repo, and all four public sites link into it.** Every
   "source", "tests", "docs", "Thesis" and "Progress log" link 404s for anyone but the owner
   (verified unauthenticated). Either make the repo public or drop those links from the sites.
   Pre-existing, now multiplied across four public sites. User's call.
2. Add a clear next step (run it, contact, engagement offer) to the FDT and SDET sites; the
   09-14 comparison showed ours has none.
3. Plate 44 redesign: ledger schema in `src/core/db.ts` first.
4. Bump `actions/checkout` and `actions/setup-node` to v5.

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

- 16:55 Verified no TCC / EPERM blockers: file writes, git, both GitHub logins, Node 24, SQLite all fine.
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
2. Tell the user privately what the validation runs found on their own builds (see the scratch
   reports), especially the "React App" title and the soft 404s; no secrets were found.
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
  the QA, OSCAR and FinOps guides, adapted for ESM and this repo's `src/agents/<slug>/` layout):
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
