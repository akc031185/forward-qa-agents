# forward-qa-agents

Two standalone QA agents that an organisation can drop into its own environment. No paid model,
no SaaS dependency: everything runs deterministically, and any model enrichment comes from an
open-weight model (DeepSeek, Kimi, Qwen) running locally. See [docs/models.md](docs/models.md).

| Plate | Agent | What it does |
|------:|-------|--------------|
| 44 | **The Forward Deployed Tester** (`forward-deployed-tester`) | Point it at a running web app. It crawls it, records findings (broken links, console errors, a11y gaps, slow pages), and provisions a complete Playwright + Playwright MCP test project with page objects, smoke specs, fixtures, CI workflow, and a report. Testing infrastructure delivered the way a forward-deployed engineer delivers software. |
| 45 | **The SDET Architect** (`sdet-architect`) | Point it at an existing test estate (Selenium in Java / Python / C# / JS, Cucumber, Postman). It inventories every artifact, extracts tests, locators, and assertions, standardises locators into robust Playwright forms, and generates one standardised Playwright + MCP architecture with a migration report listing every leftover. |

Each agent is its own folder under `src/agents/`, has its own CLI, its own REST routes, its own
tests, and its own field-guide plate under `docs/agents/`. Both persist to the same SQLite
database and are exposed through one REST API.

## Quick start

```bash
npm install
npx playwright install chromium          # needed by the Forward Deployed Tester
npm run db:init                          # creates data/forward-qa.db

# Forward Deployed Tester against any web app
npm run agent:fdt -- --url https://shop.example.test --org acme --max-pages 10

# SDET Architect against an existing Selenium estate (fixture estate included)
npm run agent:sdet -- --src ./fixtures/sdet-architect --org acme --base-url https://shop.example.test

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
| GET  | `/agents` | agent catalogue |
| POST | `/engagements` | `{ org, name, target_url? }` → engagement |
| GET  | `/engagements`, `/engagements/:id` | list / read |
| POST | `/agents/:name/runs` | `{ engagement_id, input }` → runs the agent synchronously, returns `{ run, output }` |
| GET  | `/runs?engagement_id=`, `/runs/:id` | run with its findings and artifacts |
| GET  | `/runs/:id/findings`, `/runs/:id/artifacts` | findings / generated files |
| GET  | `/agents/forward-deployed-tester/runs/:id/report` | report.md |
| GET  | `/agents/sdet-architect/runs/:id/migration` | MIGRATION.md |
| POST | `/agents/sdet-architect/preview` | `{ language, code }` → converted Playwright spec (no disk, no DB) |

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
docs/agents/     field-guide plates (the-forward-deployed-tester.md, the-sdet-architect.md)
docs/models.md   model policy and tested local models
fixtures/        fabricated legacy test estate used by tests and demos
tests/           node:test suites, one folder per agent
.claude/agents/  Claude Code subagent definitions for driving each agent
```

## Field guide (design and process pages)

The same illustrated catalog format as the earlier QA, OSCAR and FinOps agent guides:

- `index.html` — contents: the two plates, one card each
- `agents/the-forward-deployed-tester.html`, `agents/the-sdet-architect.html` — one plate per agent:
  why it exists, a clickable flowchart with the real code behind every step, worked examples from
  real runs, a runbook, and an under-the-hood carousel
- `process.html` — how a Forward Deployed Tester engagement runs: seven phases, five ledgers,
  where the two agents sit, the repo's working rules, the session loop and a cheat-sheet

The HTML is generated. Content lives in `_build/content/<agent>.json`, the site title and hero in
`_build/site.json`, the section blurbs in `_build/categories.json`, the stylesheet in
`assets/site.css`. Edit the JSON, then:

```bash
npm run catalog          # rewrites index.html and agents/*.html
```

`process.html` is hand-written on the same stylesheet. Open any page straight from disk.

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
