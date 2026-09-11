# The Forward Deployed Tester

**Plate 44**

> Point it at a running web app; it crawls, records findings and provisions a complete Playwright + MCP test project in one run.

## The chore

A new engagement starts and there is no test estate. Someone spends the first week clicking through the app, pasting URLs into a spreadsheet, hand-writing a `playwright.config.ts` from a blog post, inventing page objects with brittle CSS selectors, and wiring a CI workflow that nobody trusts. Meanwhile the obvious defects (a 404 in the footer, a form nobody can tab through, a console full of red) go unrecorded because "we are still setting up".

## Instead

The Forward Deployed Tester does the first week in one run. It launches a real browser, walks every same-origin page it can reach, harvests the accessibility tree, writes findings to the shared database, and leaves behind a standardized, runnable Playwright + Playwright MCP project with page objects, a smoke suite, CI, and a README. It then writes a report you can hand to the client. It needs no paid model: everything is deterministic with `LLM_PROVIDER=none`; a configured model only polishes the executive summary.

## How it works

1. **Reconnaissance.** Launch Chromium (optionally with basic-auth credentials or session cookies), crawl same-origin links breadth-first from `target_url` up to `max_pages`. For each page record URL, title, HTTP status, load time, console errors, failed network requests, element counts, presence of an `<h1>` and landmark regions, images without `alt`, unlabeled form controls, and an accessibility-tree-derived list of interactive elements with the best Playwright locator (role + name, then label, placeholder, text, test id, and only then CSS). Failures never stop the crawl; they become findings.
2. **Findings.** Persist rows for broken links (4xx/5xx), navigation failures, console errors, failed requests, slow pages (over 3 s), forms with unlabeled controls, images missing alt, pages with no `<h1>`, missing landmarks, and pages whose elements are mostly untargetable. Severity is fixed per category (5xx and navigation failures are high, 4xx and console errors medium, structure and alt text low).
3. **Infra provisioning.** Generate `infra/` in the run workspace: `package.json`, `playwright.config.ts` (base URL, trace on retry, HTML reporter, chromium/firefox/webkit plus two mobile projects), `.mcp.json` for the Playwright MCP server, `tests/fixtures.ts` (console-error collector), `tests/smoke.spec.ts` (one test per page), `pages/<Name>.page.ts` page objects, a README and a GitHub Actions workflow. Every file is registered as an artifact.
4. **Report.** Write `report.md` and `report.json` with the crawl table, findings by severity, a locator inventory, the provisioned file list and next steps.

## Under the hood

**Input** (`POST /agents/forward-deployed-tester/runs`, body `{ engagement_id, input }`):

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `target_url` | URL string | required | Start page; crawl is restricted to this origin |
| `org_slug` | string | required | Used for the generated package name and report title |
| `max_pages` | integer 1..50 | 15 | Pages rendered; broken links do not count against it |
| `auth` | `{ type: 'basic', username, password }` or `{ type: 'cookie', cookies: [{ name, value, domain }] }` | none | |
| `headless` | boolean | true | |
| `timeout_ms` | integer 1000..120000 | 15000 | Per-navigation budget |
| `mcp` | boolean | true | Emit `.mcp.json` and the `mcp` script |

**Output**:

```json
{
  "pages_crawled": 3,
  "findings_by_severity": { "critical": 0, "high": 0, "medium": 2, "low": 2, "info": 0 },
  "infra_dir": "<workspace>/<run_id>/infra",
  "report_path": "<workspace>/<run_id>/report.md",
  "locators_total": 9,
  "summary": "Crawled 3 pages ..."
}
```

Findings and artifacts are in the shared SQLite database (`GET /runs/:id`). The report is also served as `text/markdown` from `GET /agents/forward-deployed-tester/runs/:id/report`.

Source: `src/agents/forward-deployed-tester/` (`crawler.ts` drives the browser; `locators.ts`, `findings.ts`, `generators.ts` and `report.ts` are pure and unit-tested without a browser).

## Runbook

```bash
# one-time
npm install
npx playwright install chromium

# CLI: creates an engagement, runs the agent, prints the output JSON and the report path
npm run agent:fdt -- --url https://app.example.test --org acme --max-pages 10
npm run agent:fdt -- --url https://staging.example.test --org acme --basic-user qa --basic-pass secret
npm run agent:fdt -- --url https://app.example.test --org acme --cookie "session=abc123" --cookie-domain app.example.test

# REST
npm start
curl -s -X POST localhost:8787/engagements -H 'content-type: application/json' \
  -d '{"org":"acme","name":"first pass","target_url":"https://app.example.test"}'
curl -s -X POST localhost:8787/agents/forward-deployed-tester/runs -H 'content-type: application/json' \
  -d '{"engagement_id":"<id>","input":{"target_url":"https://app.example.test","org_slug":"acme","max_pages":10}}'
curl -s localhost:8787/agents/forward-deployed-tester/runs/<run_id>/report

# use what it built
cd workspace/<run_id>/infra && npm install && npx playwright install --with-deps && npm test

# tests for the agent itself
npm test
```

## Example output

Trimmed `report.md` from a run against a three-page demo site:

```markdown
# Forward Deployed Tester report: acme

- Target: https://app.example.test/
- Run: `2f1c...`
- Infra: `workspace/2f1c.../infra` (11 files)

## Executive summary

Crawled 3 pages on https://app.example.test in 2.0 s (avg load 18 ms). Recorded 4 findings:
0 critical, 0 high, 2 medium, 2 low, 0 info. 1 same-origin link answered 4xx/5xx or failed to
load. Provisioned a Playwright + MCP project with 3 page objects, 9 locators and 3 smoke tests.

## Crawl summary

| Path | Title | Status | Load (ms) | Console errors | Failed requests | Forms | Buttons | Links | Inputs | h1 | Landmark | Locators |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :-: | :-: | ---: |
| `/` | Demo Home | 200 | 28 | 0 | 0 | 0 | 1 | 3 | 0 | yes | yes | 4 |
| `/about` | About Demo | 200 | 12 | 0 | 0 | 0 | 0 | 1 | 0 | no | yes | 1 |
| `/contact` | Contact Demo | 200 | 13 | 0 | 0 | 1 | 1 | 1 | 2 | yes | yes | 4 |

### Broken links

| URL | Status | Found on |
| --- | ---: | --- |
| https://app.example.test/missing | 404 | https://app.example.test/ |

## Findings by severity

### medium (2)

- **[broken-link]** Broken link (404): https://app.example.test/missing — Linked from https://app.example.test/
- **[accessibility]** 1 form with unlabeled controls on /contact — 1 control lack a <label>, aria-label or placeholder

### low (2)

- **[accessibility]** 1 image without alt text on /about
- **[structure]** No <h1> on /about

## Locator inventory

### `/contact`

| Property | Locator | Confidence |
| --- | --- | --- |
| `firstInput` | `page.locator("input[name=\"first\"]")` | medium |
| `emailInput` | `page.getByRole("textbox", { name: "Email", exact: true })` | high |
| `sendButton` | `page.getByRole("button", { name: "Send", exact: true })` | high |

## Next steps

1. `cd workspace/2f1c.../infra && npm install && npx playwright install --with-deps && npm test`
2. Triage the critical/high findings first.
3. Replace low-confidence CSS locators with accessible names or `data-testid` attributes, then regenerate.
```
