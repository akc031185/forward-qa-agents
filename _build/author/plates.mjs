// Authoring script: assembles _build/content/*.json for plates 44 and 45 (run: npm run catalog:author).
// Prose rule: anything longer than two lines is a bullet list, six bullets at most.
// Code blocks are sliced from the real source files by line range and annotated, so the
// page shows the code that is in the repo, not a paraphrase.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './diagrams.mjs';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').split('\n');
const lines = (f, a, b) => read(f).slice(a - 1, b).join('\n');
/** Append `// note` to the first line matching each pattern. */
function ann(code, notes) {
  const used = new Set();
  return code.split('\n').map((l) => {
    for (const [re, c] of notes) { if (!used.has(re) && re.test(l)) { used.add(re); return `${l}   // ${c}`; } }
    return l;
  }).join('\n');
}
/** Lines from the first match of `start` through the next line matching `end` (inclusive). Survives edits above it. */
function block(f, start, end) {
  const ls = read(f);
  const i = ls.findIndex(l => start.test(l));
  if (i < 0) throw new Error(`block: ${start} not found in ${f}`);
  const j = ls.findIndex((l, k) => k > i && end.test(l));
  if (j < 0) throw new Error(`block: ${end} not found after ${start} in ${f}`);
  return ls.slice(i, j + 1).join('\n');
}
const join = (...parts) => parts.join('\n\n');
const GAP = '  // …';

// ────────────────────────────────────────────────────────────────────── plate 44
const FDT = 'src/agents/forward-deployed-tester';
const fdt = {
  slug: 'the-forward-deployed-tester',
  plate: 44,
  name: 'The Forward Deployed Tester',
  techName: 'src/agents/forward-deployed-tester/ — crawler.ts · locators.ts · findings.ts · generators.ts · report.ts · index.ts',
  category: 'probe',
  oneLiner: 'Point it at a running web app; it crawls, records findings and provisions a complete Playwright + MCP test project in one run.',
  lead: [
    'Launches a real Chromium through Playwright and crawls every same-origin page from `target_url`, breadth-first.',
    'Harvests the accessibility tree and picks one Playwright locator per element, each with a confidence.',
    'Writes severity-graded findings to the shared SQLite database.',
    'Provisions a runnable Playwright + Playwright MCP project: page objects, smoke suite, `consoleErrors` fixture, CI, README, `.mcp.json`.',
    'Writes `report.md` and `report.json`. The 2026-09-11 04:32 run: 3 pages in 2.0 s, 4 findings, 9 locators, 11 files.',
    'Needs no model. On the [process page](../process.html) it is the surface probe of the Discover phase.',
  ],
  chore: [
    'A week of clicking through the app and pasting URLs into a spreadsheet.',
    'A config copied from a blog post, page objects with brittle CSS, a CI job nobody trusts.',
    'Obvious defects go unrecorded because "we are still setting up".',
  ],
  instead: [
    'One command, one run id.',
    'A crawl table, findings by severity with evidence, a locator inventory with confidences.',
    'A project you can `npm test` on the first run, and a report you can hand to the client.',
  ],
  whyItMatters: [
    'Vendors\' forward-deployed engineers deliver the AI; nobody independently measures what they delivered.',
    'Measurement needs a deterministic regression layer that exists **before** the pilot starts.',
    'This agent makes that layer exist on day one, from the running app alone.',
  ],
  howItWorks: [
    {
      step: 'Validates the request with a zod schema: a URL, an org slug, and defaults for the page budget (15), the per-navigation timeout (15 s), headless mode and MCP output; optional basic-auth or session cookies.',
      short: 'Validate the request',
      fn: 'inputSchema — index.ts',
      explain: [
        'The runner parses before a run row exists, so a bad request never creates a run.',
        '`max_pages` is capped at 50 and counts rendered pages only; broken links are free.',
        '`auth` is a discriminated union: `basic` becomes `httpCredentials`, `cookie` becomes `addCookies`.',
        'The schema applies defaults, so its input type is wider than `Input`; the contract only calls `.parse()`.',
      ],
      code: ann(lines(`${FDT}/index.ts`, 15, 26), [
        [/max_pages/, 'rendered pages only; 404s and navigation failures are free'],
        [/discriminatedUnion/, 'basic → httpCredentials, cookie → context.addCookies'],
        [/timeout_ms/, 'per navigation, also used as the context default timeout'],
        [/mcp: z/, 'false = no .mcp.json and no `mcp` npm script in the generated project'],
      ]),
    },
    {
      step: 'Normalises the start URL, fixes the origin, and walks a breadth-first queue: every rendered page\'s links are normalised, deduplicated and admitted only when same-origin and not an asset.',
      short: 'Queue same-origin pages',
      fn: 'crawl() + normaliseUrl() + isCrawlable() — crawler.ts',
      explain: [
        '`normaliseUrl` drops the hash and a trailing slash, so `/about/` and `/about#top` are one entry.',
        '`isCrawlable` rejects other origins and asset extensions (images, css, js, pdf, docx …).',
        'Two budgets: `maxPages` rendered pages, and `maxPages + 100` total visits, so dead-link farms terminate.',
        'Leftover queue entries are reported as `skipped`; the browser is always closed in `finally`.',
        'The 2026-09-11 run: 4 visits, 3 pages, 1 broken, 0 skipped, 1986 ms.',
      ],
      code: join(
        ann(lines(`${FDT}/crawler.ts`, 12, 28), [
          [/u\.hash = ''/, '/about#top and /about are the same page'],
          [/endsWith\('\/'\)/, 'and so are /about/ and /about'],
          [/ASSET_EXT\.test/, 'never render a PDF or a stylesheet as a "page"'],
        ]),
        ann(lines(`${FDT}/crawler.ts`, 225, 269), [
          [/pages\.length >= opts\.maxPages/, 'budget 1: rendered pages'],
          [/MAX_BROKEN_LINK_VISITS/, 'budget 2: total visits, so dead-link farms terminate'],
          [/seen\.add\(n\)/, 'dedupe before enqueue, not after visit'],
          [/browser\.close\(\)\.catch/, 'always: a crash mid-crawl must not leak Chromium'],
        ]),
      ),
    },
    {
      step: 'Visits one URL with listeners for console errors, page errors and 4xx/5xx responses, waits for `load` and then up to 2 s of network idle, and runs the harvest script inside the page.',
      short: 'Visit one page',
      fn: 'visit() — crawler.ts',
      explain: [
        'Status ≥ 400 returns `{ broken }` before the harvest, so a custom 404 page is never catalogued as a page.',
        'A thrown navigation error (DNS, timeout, TLS) becomes `broken` with `status: 0` and the first error line.',
        'The response listener skips the page\'s own URL, so a 404 page counts once, as a broken link.',
        'Network idle is capped at `min(2000, timeout)` and its rejection is swallowed.',
        'Listeners are removed in `finally`, so page N\'s errors never leak into page N+1.',
      ],
      code: ann(lines(`${FDT}/crawler.ts`, 174, 223), [
        [/r\.url\(\) !== url/, 'the page\'s own 404 is a broken link, not a failed request'],
        [/if \(status >= 400\) return/, 'error pages are never harvested as pages'],
        [/networkidle/, 'let SPA hydration settle, but never past the budget'],
        [/page\.evaluate\(`\(\$\{HARVEST_SCRIPT\}\)/, 'plain JS string, see next step'],
        [/status: 0, referrer, error: message/, 'DNS / timeout / TLS → high-severity navigation finding'],
        [/page\.off\('console'/, 'listeners never outlive the visit'],
      ]),
    },
    {
      step: 'Harvests the DOM in the browser as plain JavaScript: accessible names, labels, placeholders, test ids, counts of unlabeled controls, images without alt, the h1 and landmarks; capped at 60 visible interactive elements.',
      short: 'Harvest the DOM in the browser',
      fn: 'HARVEST_SCRIPT — crawler.ts',
      explain: [
        'A `String.raw` template, not a TS function: transpiler helpers like esbuild\'s `__name` do not exist inside the page.',
        '`isVisible` drops hidden, `aria-hidden`, `display:none`, `visibility:hidden` and zero-rect elements.',
        '`accName` follows the accessible-name precedence: `aria-labelledby`, `aria-label`, label, value/alt/title/placeholder.',
        'Test ids come from `data-testid`, `data-test-id`, `data-test` and `data-cy`.',
        '"Unlabeled" means exactly the conditions under which `getByLabel()` cannot target the control.',
      ],
      code: join(
        ann(lines(`${FDT}/crawler.ts`, 30, 42), [[/String\.raw/, 'plain JS: no esbuild helpers leak into the page']]),
        ann(lines(`${FDT}/crawler.ts`, 58, 66), [[/aria-labelledby/, 'precedence 1'], [/aria-label'\)/, 'precedence 2']]),
        GAP,
        ann(lines(`${FDT}/crawler.ts`, 93, 102), [[/const selector/, 'what counts as interactive'], [/maxElements/, '60 per page'], [/data-testid/, 'four test-id conventions']]),
        GAP,
        ann(lines(`${FDT}/crawler.ts`, 119, 128), [[/const unlabeled/, 'exactly the controls getByLabel() cannot reach'], [/formsWithoutLabels/, 'medium finding when > 0'], [/hasLandmark/, 'low finding when false']]),
      ),
    },
    {
      step: 'Picks a Playwright locator per element in Playwright\'s own priority order: role + name, label, placeholder, text, test id, and only then CSS by id, name attribute, stable classes or tag, each with a confidence.',
      short: 'Pick a locator per element',
      fn: 'deriveLocator() — locators.ts',
      explain: [
        '`implicitRole` maps HTML to ARIA (`<a href>` → link, `<input type=email>` → textbox, `<select>` → combobox), so most elements get `getByRole` at high confidence with no test ids.',
        '`looksGenerated` refuses ids and classes that look like framework output (`ember123`, `css-1x2y3z`, `:r1:`, hashes).',
        'The demo\'s `<input name="first">` had no label, so it fell to `locator("input[name=\\"first\\"]")` at medium; the labelled email field became `getByRole("textbox", { name: "Email" })` at high.',
        'A page where half the elements end up low gets an `info` testability finding.',
      ],
      code: ann(lines(`${FDT}/locators.ts`, 75, 122), [
        [/function looksGenerated/, 'ember123, css-1x2y3z, :r1:, hashes, long digit runs'],
        [/if \(role && name\)/, 'Playwright\'s first choice, and the demo\'s 8 of 9'],
        [/if \(label\)/, 'a <label> with no computed role'],
        [/if \(placeholder\)/, 'placeholder-only inputs'],
        [/if \(testId\)/, 'medium: test ids are stable but say nothing to a reader'],
        [/el\.nameAttr\)/, 'the demo\'s firstInput: medium, and an accessibility finding'],
        [/stableClasses/, 'at most two classes, none generated-looking'],
      ]),
    },
    {
      step: 'Turns the crawl into findings with fixed severities: navigation failures and 5xx high; 4xx links, console errors, slow pages, unlabeled forms medium; alt text, h1 and landmarks low; mostly untargetable pages info; nothing rendered critical.',
      short: 'Turn the crawl into findings',
      fn: 'deriveFindings() — findings.ts',
      explain: [
        'Pure function: crawl in, drafts out. `index.ts` persists each draft, then reads the rows back for the report.',
        'Severity is decided per category, never by a model. `SLOW_PAGE_MS` is 3000; three times that is high.',
        'Evidence (the broken link record, the console text, the counts) is stored as JSON next to the row.',
      ],
      code: join(
        ann(lines(`${FDT}/findings.ts`, 7, 45), [
          [/SLOW_PAGE_MS = 3000/, '> 3 s medium, > 9 s high'],
          [/b\.status === 0/, 'DNS / timeout / TLS'],
          [/b\.status >= 500 \? 'high' : 'medium'/, '5xx high, 4xx medium'],
          [/category: 'console-error'/, 'first 3 messages in detail, all in evidence'],
        ]),
        GAP,
        ann(lines(`${FDT}/findings.ts`, 74, 89), [
          [/lowConfidence \/ p\.elements\.length >= 0\.5/, 'half or more fell back to CSS → info'],
          [/severity: 'critical'/, 'the only critical: no page rendered at all'],
        ]),
      ),
    },
    {
      step: 'Provisions the project as pure strings: package.json, a config with three desktop and two mobile projects, a `consoleErrors` fixture, one smoke test and one page object per page, README, CI workflow, .gitignore and .mcp.json; every file becomes an artifact row.',
      short: 'Provision the Playwright project',
      fn: 'generateInfra() + generateSmokeSpec() + generatePageObject() — generators.ts',
      explain: [
        'Class names come from the path (`/` → `HomePage`, `/about-us` → `AboutUsPage`), made unique with a numeric suffix.',
        'Each smoke test asserts status < 400, the title, the h1 text (or leaves a `NOTE` when recon found none, as on `/about`), and an empty console.',
        'Page-object getters carry a comment with tag, type, role, strategy and confidence, so low-confidence ones are one grep away.',
        'All of it is unit-tested without a browser from in-memory page records.',
      ],
      code: join(
        ann(lines(`${FDT}/generators.ts`, 129, 163), [
          [/toBeLessThan\(400\)/, 'the only assertion every page gets'],
          [/toHaveTitle/, 'only when recon saw a title'],
          [/NOTE: recon found no <h1>/, 'the /about test carries this line'],
          [/expect\(consoleErrors/, 'the fixture from tests/fixtures.ts'],
        ]),
        GAP,
        ann(lines(`${FDT}/generators.ts`, 165, 190), [
          [/const desc = /, 'doc comment: tag, type, role, strategy, confidence'],
          [/get \$\{el\.property\}\(\): Locator/, 'one getter per harvested element'],
        ]),
        GAP,
        ann(lines(`${FDT}/generators.ts`, 285, 302), [
          [/kind: 'infra\/spec'/, 'every file becomes an artifacts row with its kind'],
          [/if \(opts\.mcp\)/, '.mcp.json only when requested'],
        ]),
      ),
    },
    {
      step: 'Writes report.md and report.json with an executive summary that is deterministic by default and only rewritten by a local model when one answers, and kept only if the rewrite is between 40 and 1200 characters.',
      short: 'Write the report',
      fn: 'run() phase 4 — index.ts · deterministicSummary() — report.ts',
      explain: [
        '`maybeLlm(fn, fallback)` resolves the provider once per process: Ollama on 11434, then an OpenAI-compatible server on 8080, then `none`.',
        'No model, or a model that throws, means the fallback sentence built from counts.',
        'The prompt forbids new facts and demands every number be kept; the length guard rejects a runaway answer.',
        'Both report files are artifacts; the markdown one is served by `GET /agents/forward-deployed-tester/runs/:id/report`.',
      ],
      code: join(
        ann(lines(`${FDT}/index.ts`, 70, 92), [
          [/const fallback = deterministicSummary/, 'always computed first'],
          [/maybeLlm\(async/, 'no model reachable → fallback, model throws → fallback'],
          [/Keep every number exactly as given/, 'the model may only rephrase'],
          [/cleaned\.length > 40 && cleaned\.length < 1200/, 'length guard'],
        ]),
        GAP,
        ann(lines(`${FDT}/report.ts`, 29, 44), [[/Provisioned a Playwright/, 'every figure comes from the crawl result']]),
      ),
    },
  ],
  examples: [
    {
      caption: 'Three pages, four findings, eleven files: the 2026-09-11 04:32 run',
      input: '`npm run agent:fdt -- --url http://127.0.0.1:4711/ --org demo-org --max-pages 5` against a local three-page demo site with a footer link to `/missing` that answers 404. `LLM_PROVIDER=none`.',
      output: [
        'Run `049b95fd`, succeeded. 4 visits, 3 pages rendered (`/` 28 ms, `/about` 12 ms, `/contact` 13 ms), 1 broken link, 1986 ms.',
        'medium: broken link 404 `/missing`, linked from `/`.',
        'medium: 1 form with unlabeled controls on `/contact`.',
        'low: 1 image without alt on `/about`; low: no `<h1>` on `/about`.',
        '11 files in `workspace/049b95fd…/infra`: config, fixtures, smoke spec, 3 page objects, README, CI, .gitignore, .mcp.json.',
        'Summary: "Crawled 3 pages on http://127.0.0.1:4711 in 2.0 s (avg load 18 ms). Recorded 4 findings … 3 page objects, 9 locators and 3 smoke tests."',
      ],
    },
    {
      caption: 'One form, three locators of two different qualities',
      input: 'The demo contact page: `<input name="first">` with no label or placeholder; `<label>Email <input type="email"></label>`; `<button type="submit">Send</button>`; a `Home` link.',
      output: [
        '`firstInput` → `page.locator("input[name=\\"first\\"]")`, css, medium: no accessible name, so it fell past role, label, placeholder, text and test id.',
        '`emailInput` → `page.getByRole("textbox", { name: "Email", exact: true })`, role, high: the wrapping label gave a name, `type=email` gave the role.',
        '`sendButton` and `homeLink` → `getByRole("button" | "link", …)`, both high.',
        'The same unlabeled control produced the medium accessibility finding on `/contact`.',
        'Locator inventory: 8 role, 1 css.',
      ],
    },
    {
      caption: 'A 404 in the footer becomes a finding, not a crash, and not a page',
      input: 'The home page links to `/missing`. The server answers 404 with an HTML error page.',
      output: [
        '`visit()` sees status 404 and returns `{ broken }` before the harvest: no page object, no smoke test. The suite has 3 tests, not 4.',
        'The visit does not count against `max_pages`.',
        'A medium `broken-link` finding with the referrer in `detail` and the record in `evidence_json`.',
        '`report.md` gets a "Broken links" table: `/missing | 404 | http://127.0.0.1:4711/`.',
        'A host that does not resolve would give `status: 0` and a high `navigation` finding instead.',
      ],
    },
  ],
  underHood: [
    { heading: 'Queue and budgets', whenRuns: 'Phase 1 of 4, once per run.', input: '`target_url`, `max_pages`, `timeout_ms`, `headless`, optional `auth`.', output: 'A `CrawlResult`: rendered `pages`, `brokenLinks`, `skipped` URLs and `durationMs` — via `crawl()`, `normaliseUrl()`, `isCrawlable()`.' },
    { heading: 'In-page harvest', whenRuns: 'Inside every successful visit, after `load` and up to 2 s of network idle.', input: 'The live DOM, and `maxElements = 60`.', output: 'A `HarvestResult`: title, h1, landmark flag, alt and label counts, element counts, same-origin links, up to 60 descriptors — via `HARVEST_SCRIPT`.' },
    { heading: 'Locator derivation', whenRuns: 'Back in Node, for every harvested descriptor.', input: 'Tag, type, role, accessible name, label, placeholder, text, test id, id, name attribute, classes.', output: 'A `DerivedLocator` with strategy, Playwright code and confidence, plus a unique camelCase property name — via `deriveLocator()`, `toPropertyName()`, `uniqueNames()`.' },
    { heading: 'Findings', whenRuns: 'Phase 2, after the crawl, before anything is written.', input: 'The `CrawlResult`.', output: 'Rows in `findings` with severity, category, title, detail and evidence JSON — via `deriveFindings()` and `Db.addFinding()`.' },
    { heading: 'Provisioning and persistence', whenRuns: 'Phases 3 and 4.', input: 'The page records and the run options.', output: '11+ files under `workspace/<run_id>/infra`, one `artifacts` row each; `report.md`, `report.json`, `run.log`; the `runs` row marked `succeeded` — via `generateInfra()`, `renderReportMarkdown()`, `buildReportJson()`, `executeAgent()`.' },
    { heading: 'Optional local model', whenRuns: 'Only in phase 4, only if a local server answers within 800 ms.', input: 'The deterministic summary and a prompt that forbids new facts.', output: 'A rephrased summary, or the original — via `maybeLlm()`; `assertLocalEndpoint()` rejects any non-local host unless `LLM_ALLOW_REMOTE=1`.' },
  ],
  diagrams: [
    { heading: 'Pipeline', after: 'lead', svg: D.fdtPipeline, caption: 'Four phases, one run id. Solid arrows are data; dashed ones are writes. The model box is optional and only touches the summary text.' },
    { heading: 'The crawl loop', after: 'flow', svg: D.fdtCrawlLoop, caption: 'Steps 2 and 3 as a loop. Error pages never reach the harvest and never consume the page budget.' },
    { heading: 'Locator decision ladder', after: 'flow', svg: D.fdtLocatorLadder, caption: 'Step 5. Playwright\'s own priority order; the first rung that matches wins.' },
    { heading: 'Finding severity map', after: 'flow', svg: D.fdtSeverityMap, caption: 'Step 6. Severity is fixed per category, never decided by a model.' },
  ],
  status: 'toolkit',
  runbook: {
    runnable: true,
    prerequisites: [
      'Node 24 (the built-in `node:sqlite` driver needs it).',
      'A clone of the repo and `npm install`: Playwright, Fastify and zod, nothing else.',
      'Any running web app you are allowed to crawl. Same-origin links only; forms are never submitted.',
    ],
    steps: [
      { label: 'Install and fetch a browser', cmd: 'npm install\nnpx playwright install chromium', why: 'The crawler launches Chromium through Playwright. The generated project installs all three engines later with `--with-deps`.', firstRun: 'Done on 2026-09-11 while building the repo.' },
      { label: 'Create the database', cmd: 'npm run db:init', why: 'Creates `data/forward-qa.db` with `engagements`, `runs`, `findings`, `artifacts`. Idempotent; every run applies the same schema on open.', rerun: 'Safe to repeat; nothing is dropped.' },
      { label: 'Run it against a URL', cmd: 'LLM_PROVIDER=none npm run agent:fdt -- --url https://app.example.test --org acme --max-pages 10\n\n# behind basic auth, or with a session cookie\nnpm run agent:fdt -- --url https://staging.example.test --org acme --basic-user qa --basic-pass secret\nnpm run agent:fdt -- --url https://app.example.test --org acme --cookie "session=abc123" --cookie-domain app.example.test', why: [
        'Creates an engagement, runs the agent, prints the output JSON and the run id.',
        '`LLM_PROVIDER=none` makes the run reproducible; unset, the adapter probes for a local Ollama.',
      ], firstRun: '2026-09-11 04:32 against a local three-page site: 3 pages, 4 findings, 9 locators, 11 files, 2.0 s.', rerun: 'A new run id, workspace directory and rows; earlier runs are never modified.' },
      { label: 'Read the report', cmd: 'cat workspace/<run_id>/report.md\ncat workspace/<run_id>/run.log', why: 'Summary, crawl table, broken links, findings by severity, locator inventory per page, provisioned files, next steps. `run.log` has one timestamped line per phase and visit.' },
      { label: 'Run what it built', cmd: 'cd workspace/<run_id>/infra\nnpm install\nnpx playwright install --with-deps\nnpm test\nBASE_URL=https://staging.example.test npm test', why: 'Green on the first run against the same environment; a red test is a regression or one of the findings. `BASE_URL` points the suite at another environment.', firstRun: 'The `/about` test carries a `NOTE` instead of an h1 assertion because recon found no heading.' },
      { label: 'Same thing through the REST API', cmd: 'npm start   # http://localhost:8787\ncurl -s -X POST localhost:8787/engagements -H \'content-type: application/json\' \\\n  -d \'{"org":"acme","name":"first pass","target_url":"https://app.example.test"}\'\ncurl -s -X POST localhost:8787/agents/forward-deployed-tester/runs -H \'content-type: application/json\' \\\n  -d \'{"engagement_id":"<id>","input":{"target_url":"https://app.example.test","org_slug":"acme","max_pages":10}}\'\ncurl -s localhost:8787/agents/forward-deployed-tester/runs/<run_id>/report', why: 'Synchronous: the POST returns `{ run, output }` when the crawl is done. Invalid input is a 400 with zod issues.' },
      { label: 'Hand the MCP config to a client', cmd: 'cd workspace/<run_id>/infra\ncat .mcp.json\nnpm run mcp    # or let Claude Code / Cursor launch it from .mcp.json', why: '`.mcp.json` registers the Playwright MCP server with `BASE_URL` set to the crawled site. The generated README lists three prompts to start with.' },
      { label: 'Run the agent\'s own tests', cmd: 'npm run typecheck\nnpm test', why: '89 tests across both agents; `integration.test.ts` drives the real crawler through Chromium against an in-process server.', firstRun: '89 pass, 0 fail, 2.9 s on 2026-09-11.' },
    ],
    inputs: [
      { name: '--url / target_url', desc: 'Start page; the crawl never leaves its origin.' },
      { name: '--org / org_slug', desc: 'Letters, digits, `-` and `_`. Names the generated package and the report.' },
      { name: '--max-pages / max_pages', desc: '1–50, default 15. Rendered pages only.' },
      { name: '--timeout-ms / timeout_ms', desc: '1000–120000, default 15000. Per navigation.' },
      { name: '--basic-user + --basic-pass, or --cookie + --cookie-domain', desc: 'Optional auth. Cookies are `name=value;name2=value2`.' },
      { name: '--headed, --no-mcp', desc: 'Watch the browser; skip the MCP files.' },
    ],
    outputs: [
      { name: 'workspace/<run_id>/infra/', desc: 'The provisioned project: 8 fixed files plus one page object per page.' },
      { name: 'workspace/<run_id>/report.md and report.json', desc: 'Human and machine forms of the same report.' },
      { name: 'workspace/<run_id>/run.log', desc: 'Timestamped phase and visit log.' },
      { name: 'Rows in runs, findings, artifacts', desc: 'Queryable through `GET /runs/:id`, `/runs/:id/findings`, `/runs/:id/artifacts`.' },
    ],
    rerun: [
      'Nothing is cached or overwritten: every run gets a fresh run id, directory and rows.',
      'Re-run after a deploy and diff the two `report.json` files: new broken links, console errors or locator changes are the regression signal.',
      'Raise `max_pages` when the report says links were skipped.',
    ],
    integrate: [
      'Commit `workspace/<run_id>/infra` into the application repo as its `e2e/` folder; the workflow runs on push, PR, nightly and manual dispatch.',
      'Set `BASE_URL` per environment through repository variables.',
      'In the engagement on the [process page](../process.html), this run is the Discover-phase probe; its findings and smoke suite are the baseline later phases measure against.',
      'To add a probe of your own, follow the same shape: a pure `derive*()` function, rows through `ctx.db`, files through string builders, registered in `src/api/server.ts`.',
    ],
  },
};

// ────────────────────────────────────────────────────────────────────── plate 45
const SA = 'src/agents/sdet-architect';
const sdet = {
  slug: 'the-sdet-architect',
  plate: 45,
  name: 'The SDET Architect',
  techName: 'src/agents/sdet-architect/ — inventory.ts · parsers/{common,cfamily,selenium-*,cucumber,postman}.ts · locators.ts · generators/{plan,steps,pages,spec,bdd,api,project}.ts · convert.ts · report.ts · index.ts',
  category: 'standardise',
  oneLiner: 'Inventories any legacy test estate (Selenium in any language, Cucumber, Postman, test plans) and rebuilds it as one standardised Playwright + Playwright MCP architecture, offline.',
  lead: [
    'Point it at a folder. Selenium in Java, Python, C# or JavaScript, Cypress, Cucumber, Postman and markdown test plans all parse into one model.',
    'Regex and line-based parsers only: no AST libraries, no language runtimes.',
    'Standardises every locator into the most robust Playwright form, with a confidence score.',
    'Generates one project: page objects, fixtures, specs, playwright-bdd steps, API specs, config, CI, `.mcp.json`.',
    'Writes `MIGRATION.md` with every line it could not convert and its source `file:line`.',
    'Fixture estate, run `46f19623` on 2026-09-11: 12 files, 28 tests, 24 / 2 / 2, 99 of 108 steps (**91.7%**), 38 locators, 3 low, 26 files. Deterministic with no model.',
  ],
  chore: [
    'A Selenium module nobody has run since the last Chrome upgrade; a .NET project that builds on one laptop.',
    'A `.feature` file whose steps drifted; a Postman collection with the real expectations in `pm.test` scripts.',
    'Three weeks of reading; a locator spreadsheet stale the day it is finished.',
  ],
  instead: [
    'One run, one architecture.',
    'A per-file status table, a TODO list with `file:line` on every row, a confidence histogram.',
    'The human work is the TODO list, not the reading.',
  ],
  whyItMatters: [
    'The [process page](../process.html) puts this agent under the eval cube as the deterministic regression layer.',
    'An organisation cannot tell whether an AI deployment broke something unless its existing tests run, and they usually do not.',
    'The same page objects serve an MCP client for exploratory checks.',
  ],
  howItWorks: [
    {
      step: 'Walks the estate, skipping build output by default, reads every text file under 2 MB, and classifies it from extension plus content: .feature, config names, Java / Python / C# / JS by annotations and imports, JSON only with a Postman schema, markdown only if it looks like a test plan.',
      short: 'Inventory and classify files',
      fn: 'inventory() + classifyFile() — inventory.ts',
      explain: [
        'Classification is a pure function on `(path, content)`, unit-tested without a filesystem.',
        'Java: `@Given/@When/@Then` → step-definitions; `@Test` → selenium-java; only Selenium imports → page-object. Same split for Python and C#.',
        'Binary files are detected by a NUL byte in the first 512 bytes; a `.docx` named like a test plan is still inventoried.',
        'Fixture result: java 2, python 1, csharp 1, js 1, feature 1, step-definitions 1, page-object 1, postman 1, test-plan 1, config 2.',
      ],
      code: join(
        ann(lines(`${SA}/inventory.ts`, 13, 18), [[/DEFAULT_EXCLUDE/, 'never read node_modules, target, bin, obj, dist, venv…'], [/TEST_PLAN_NAME/, 'a markdown file earns test-plan by name or by shape']]),
        GAP,
        ann(lines(`${SA}/inventory.ts`, 43, 59), [
          [/\.feature'\) return/, 'extension alone is enough here'],
          [/case '\.java': return classifyJava/, 'step-definitions → selenium-java → page-object → unknown'],
          [/isPostmanCollection/, 'JSON must carry the getpostman schema URL'],
          [/TEST_PLAN_NAME\.test\(base\)/, 'or: a heading mentioning test/scenario/case plus a numbered list'],
        ]),
      ),
    },
    {
      step: 'Parses brace languages structurally without an AST: strips comments preserving line numbers, finds classes with a string-aware brace matcher, collects @FindBy / By fields and constants, and splits each method body into statements.',
      short: 'Parse classes without an AST',
      fn: 'parseClasses() + buildSuite() — parsers/cfamily.ts',
      explain: [
        '`stripCComments` replaces block comments with the same number of newlines, so every `[file:line]` on a TODO is real.',
        'Annotations decide the kind: test annotation → `TestCase`, hook → `Hook`, step → `StepDefinition` with its Cucumber expression compiled to a regex, other public methods in a page object → `PageMethod`.',
        'Class-level fields seed the `Scope` each method body is parsed with, so `usernameInput.sendKeys(user)` knows the field is `By.id("username")`.',
      ],
      code: join(
        ann(lines(`${SA}/parsers/cfamily.ts`, 31, 49), [[/stripCComments/, 'newlines preserved: line numbers stay honest'], [/matchBrace/, 'string-aware, so a "}" inside a literal does not end the class']]),
        GAP,
        ann(lines(`${SA}/parsers/cfamily.ts`, 168, 202), [
          [/suite\.locators\.push\(\.\.\.c\.fieldLocators\)/, '@FindBy and By fields, with their alias'],
          [/TEST_ANN\.test/, '@Test, @ParameterizedTest, [Fact], [TestMethod]…'],
          [/HOOK_ANN\[a\]/, '@BeforeMethod / [SetUp] → beforeEach, @BeforeClass → beforeAll'],
          [/cucumberToRegex/, '{string} → "([^"]*)", {int} → (-?\\d+)'],
          [/m\.isPublic && steps\.length > 0/, 'a public method with browser steps is a page method'],
        ]),
      ),
    },
    {
      step: 'Normalises one statement into a token string: string literals become «S0», By(...) locators «L0», findElement(...) wrappers «E0», scope variables are substituted, and browser reads (getText, getTitle, isDisplayed, size()) become typed values «V0».',
      short: 'Normalise a statement into tokens',
      fn: 'normalize() — parsers/common.ts',
      explain: [
        'One engine for Java, C#, JavaScript and Python: it matches Selenium shapes, not syntax. `By.id("x")`, `(By.ID, "x")`, `find_element_by_id("x")`, `$("css")`, `cy.get("css")` all become «L».',
        'Strings are tokenised first, so a locator containing `;` or `(` cannot confuse later regexes.',
        '`cartBadge.getText()` becomes «V0» with `{ type: text, locator: #cart-count }`, so the assertion two lines later can be typed.',
        '`resolveConcat` folds `BASE_URL + "/catalog"` using class constants; the spec ends up with `page.goto(\'/catalog\')`.',
      ],
      code: join(
        ann(lines(`${SA}/parsers/common.ts`, 224, 246), [
          [/STRING_RE, \(m\)/, 'strings first: nothing inside a literal can confuse later regexes'],
          [/\\bBy\\\.\(\\w\+\)/, 'Java / C# / JS By.xxx("…") → «L»'],
        ]),
        GAP,
        ann(lines(`${SA}/parsers/common.ts`, 254, 275), [
          [/find_elements\?_by_/, 'python legacy finders'],
          [/cy\\\.get/, 'Cypress reads the same engine'],
          [/scope\.byVars\)/, 'By variables and @FindBy fields substituted by name'],
          [/findElement\|FindElement\|find_element/, 'driver.findElement(«L0») → «E0»'],
        ]),
        GAP,
        ann(lines(`${SA}/parsers/common.ts`, 277, 290), [
          [/getText\\\(\\\)/, 'el.getText() → «V» of type text, carrying its locator'],
          [/getTitle/, 'driver.getTitle() → «V» of type title'],
        ]),
      ),
    },
    {
      step: 'Classifies the normalised statement into a Step: an assignment updates scope and emits nothing; lifecycle noise is dropped; then navigate, click / fill / select / press / hover, hard or explicit wait, assertion, typed return, page-object call, or unknown.',
      short: 'Classify the tokens into a Step',
      fn: 'parseStatement() + parseAssertion() — parsers/common.ts',
      explain: [
        '`WebElement cartBadge = driver.findElement(…)` binds `cartBadge` and produces no step; `driver.manage().window().maximize()` matches `NOISE_RE` and is dropped.',
        '`Thread.sleep(2000)` is a hard wait (2000 ms; Python `time.sleep(3)` scales to 3000): a NOTE plus a flakiness finding.',
        '`WebDriverWait…until(visibilityOfElementLocated(…))` becomes `waitFor({ state: \'visible\' })`.',
        '`parseAssertion` understands TestNG/JUnit, NUnit `Assert.That`, pytest `assert`, chai `expect`, node `assert`, Cypress `.should`, and maps typed values to `toHaveText`, `toHaveTitle`, `toHaveCount`, `toBeVisible`.',
        'Anything else is `unknown` and becomes a TODO.',
      ],
      code: join(
        ann(lines(`${SA}/parsers/common.ts`, 320, 342), [
          [/const assign = /, 'declaration keywords optional: Java, C#, JS and Python all match'],
          [/scope\.elements\.set\(name, locOf\(r\)!\); return none/, 'WebElement x = findElement(…): bind, emit nothing'],
          [/scope\.constants\[name\] = s/, 'String BASE_URL = "…" feeds resolveConcat'],
          [/NOISE_RE\.test\(n\)/, 'driver.quit(), maximize(), implicitlyWait(): dropped'],
        ]),
        GAP,
        ann(lines(`${SA}/parsers/common.ts`, 379, 392), [
          [/Thread\\\.sleep/, 'hard wait → NOTE + flakiness finding'],
          [/value: hidden \? 'hidden' : 'visible'/, 'explicit wait → locator.waitFor'],
        ]),
        GAP,
        ann(lines(`${SA}/parsers/common.ts`, 394, 421), [
          [/parseAssertion\(n, dialect/, 'TestNG, JUnit, NUnit, pytest, chai, node assert, cypress'],
          [/scope\.objects\.has\(m\[1\]\)/, 'loginPage.login(QA_USER, QA_PASS) → call step'],
          [/return unknown\(\)/, 'everything else: a TODO with the original line'],
        ]),
      ),
    },
    {
      step: 'Standardises every locator into the most robust Playwright form with a 0–1 confidence: ids 0.95 (0.5 when they look generated), name 0.85, linkText → getByRole(\'link\') 0.9, simple xpaths reduced to css / getByText / getByRole, absolute xpaths kept as xpath= at 0.20; under 0.60 becomes a finding.',
      short: 'Standardise every locator',
      fn: 'standardize() + standardizeXpath() — locators.ts',
      explain: [
        'The xpath reducer walks segment by segment: `//div[@class=\'product-card\'][1]//button[contains(text(),\'Add to cart\')]` → `div[class="product-card"]:nth-of-type(1) button:has-text("Add to cart")` at 0.50, "positional index in xpath".',
        '`//p[text()=\'Your cart is empty\']` → `getByText(…, { exact: true })`; `//a[text()=…]` → `getByRole(\'link\')` because `ROLE_TAGS` knows `a`.',
        '`/html/body/div[2]/…` is never reduced: `xpath=` at 0.20, and a high-severity locator finding.',
        '`chooseTestIdAttribute` looks at the whole estate first; `[data-qa=…]` everywhere means `testIdAttribute: \'data-qa\'` in the generated config.',
        'Fixture: 15 at 0.90+, 17 at 0.80–0.89, 3 at 0.60–0.79, 2 at 0.40–0.59, 1 below 0.40.',
      ],
      code: join(
        ann(lines(`${SA}/locators.ts`, 37, 76), [
          [/looksLikeTestId\(v\)\) return base\(`page\.getByTestId/, 'ids named like test ids become getByTestId'],
          [/id looks auto-generated/, 'gwt-uid, ember12, react-select-3, 3+ digit runs'],
          [/case 'linkText'/, 'link text is an accessible name: role locator, 0.9'],
          [/utility\/layout class names/, 'col-, btn-, mt-… are not stable'],
          [/positional\/deeply chained css/, ':nth-child and > a > b > c chains'],
        ]),
        GAP,
        ann(lines(`${SA}/locators.ts`, 88, 103), [
          [/absolute xpath is brittle/, '/html/body/… stays xpath= at 0.20'],
          [/ROLE_TAGS\[m\[1\]\]/, '//a[text()=…] → getByRole(\'link\'), //button → getByRole(\'button\')'],
          [/getByText\(\$\{q\(m\[3\]\)\}, \{ exact: true \}\)/, '//p[text()=…] → getByText exact'],
        ]),
      ),
    },
    {
      step: 'Plans the architecture: one page class per detected page object plus one synthetic page per test class with inline locators, unique class and file names, camelCase field names from each locator, and one fixture per page so specs destructure them.',
      short: 'Plan pages and fixtures',
      fn: 'buildPlan() — generators/plan.ts · genFixtures() — generators/pages.ts',
      explain: [
        '`LoginPage.java` is a real page object → `src/pages/Login.page.ts` with five fields and four methods.',
        '`CheckoutTest.java` used `By.id("search-box")` and friends inline → a synthetic `CheckoutPage` with exactly those locators, deduplicated by `strategy:value`.',
        'Field names from `fieldNameFor`: `search-box` → `searchBox`, linkText `Cart` → `cartLink`, `.cart-line` → `cartLine`, `//p[text()=\'Your cart is empty\']` → `yourCartIsEmptyText`.',
        'Fixture parameter lists are filled after the bodies are emitted, when it is known which pages a test touched.',
      ],
      code: ann(lines(`${SA}/generators/plan.ts`, 33, 90), [
        [/chooseTestIdAttribute\(all\)/, 'decided once, from the whole estate'],
        [/const uniqueClass/, 'two LoginPage classes → LoginPage, LoginPage2'],
        [/if \(\/\^\(page\|constructor\|goto\)\$\/\.test\(name\)\)/, 'never shadow the Page itself'],
        [/\/\/ 1\. detected page objects/, 'LoginPage.java → Login.page.ts'],
        [/\/\/ 2\. one synthetic page/, 'CheckoutTest.java → Checkout.page.ts from its inline locators'],
        [/\(Tests\?\|Specs\?\|IT\|Steps\?/, 'CheckoutTest → CheckoutPage, LoginSteps → LoginStepsPage'],
      ]),
    },
    {
      step: 'Emits each Step as one line of Playwright, or as `// TODO(sdet-architect): <original>  [file:line]` when a value, target or page object cannot be resolved; hard waits become a NOTE plus a flakiness finding; a test that is half TODOs gets test.fixme.',
      short: 'Emit Playwright, or a TODO',
      fn: 'emitStep() + statusOf() — generators/steps.ts',
      explain: [
        '`fill` needs a literal or a method parameter; `select` knows text, value or index; `assert` knows the typed target and negation.',
        '`navigate` strips the detected base URL so specs use `baseURL` from config.',
        '`call` resolves the page-object class to its fixture: `loginPage.login(QA_USER, QA_PASS)` → `await loginPage.login(\'qa.buyer@example.test\', \'Secret123!\')`.',
        '`statusOf`: 0 TODOs converted, under half partial, half or more manual with `test.fixme`.',
        'Fixture: `legacyHelperOnly` has 1 TODO in 3 steps → partial; both markdown test plans are all TODO → manual.',
      ],
      code: join(
        ann(lines(`${SA}/generators/steps.ts`, 21, 32), [[/const todo = /, 'original line + [file:line], plus a model hint if one was given']]),
        GAP,
        ann(lines(`${SA}/generators/steps.ts`, 39, 73), [
          [/url = url\.slice\(ctx\.baseUrl\.length\)/, 'https://shop.example.test/catalog → /catalog'],
          [/setInputFiles/, 'sendKeys on a file input is an upload'],
          [/selectOption\(\{ label: /, 'selectByVisibleText → label, selectByValue → value'],
          [/removed hard wait/, 'Thread.sleep → NOTE, flaky: true'],
          [/waitFor\(\{ state:/, 'WebDriverWait.until(visibility…) → waitFor'],
        ]),
        GAP,
        ann(lines(`${SA}/generators/steps.ts`, 142, 150), [[/todos \* 2 >= total/, 'half or more TODO → manual → test.fixme']]),
      ),
    },
    {
      step: 'Assembles the whole estate in memory (page classes, fixtures, UI specs, .feature files kept verbatim with playwright-bdd steps, Postman → request specs, config, CI), records findings in five categories, and writes MIGRATION.md last.',
      short: 'Assemble, record findings, report',
      fn: 'generateEstate() — convert.ts · run() — index.ts',
      explain: [
        '`generateEstate` is pure: a `Map<string,string>` of files, statuses, TODOs, flaky waits, duplicate and low-confidence locators, totals.',
        '`index.ts` alone touches disk, database and the optional model: writes the map (unless `dry_run`), one `artifacts` row per file, findings by category.',
        'Findings: `locator` (high under 0.40, else medium), `conversion` (medium), `flakiness`, `duplication`, `quality` (low).',
        'The report is built from the same objects, so `MIGRATION.md` and `GET /runs/:id/findings` cannot disagree. Fixture: 9 / 4 / 9 / 3 / 3.',
        'The `preview` route runs the same pipeline on one file with no disk and no database.',
      ],
      code: join(
        ann(lines(`${SA}/convert.ts`, 76, 103), [
          [/detectBaseUrl\(suites\)/, 'most common navigated origin, api.* hosts excluded'],
          [/const tally = /, 'per-file status and the global 99/108 step count'],
          [/genPageClass\(p, plan, baseUrl\)/, 'detected and synthetic pages alike'],
          [/genFixtures\(plan\.pages\)/, 'one fixture per page class'],
        ]),
        GAP,
        ann(lines(`${SA}/convert.ts`, 119, 131), [[/reconstructFeature/, 'the .feature is kept, only the steps are regenerated'], [/status: 'kept'/, 'step-definition files are consumed, not converted']]),
        GAP,
        ann(lines(`${SA}/index.ts`, 84, 90), [
          [/l\.confidence < 0\.4 \? 'high' : 'medium'/, 'absolute xpath at 0.20 → high'],
          [/category: 'conversion'/, 'one per TODO'],
          [/category: 'flakiness'/, 'one per removed sleep'],
          [/category: 'quality'/, 'a passing test that asserts nothing proves nothing'],
        ]),
      ),
    },
  ],
  examples: [
    {
      caption: 'CheckoutTest.java → tests/CheckoutTest.spec.ts (status: partial)',
      input: `Lines 42–57 of addItemToCartAndCheckout() in a TestNG class whose @BeforeMethod logs in through a LoginPage:\n\ndriver.get(BASE_URL + "/catalog");\ndriver.findElement(By.id("search-box")).sendKeys("wireless mouse");\ndriver.findElement(By.cssSelector("button.search-submit")).click();\nThread.sleep(2000);\ndriver.findElement(By.xpath("//div[@class='product-card'][1]//button[contains(text(),'Add to cart')]")).click();\nWebElement cartBadge = driver.findElement(By.id("cart-count"));\nAssert.assertEquals(cartBadge.getText(), "1");\ndriver.findElement(By.linkText("Cart")).click();\nnew WebDriverWait(driver, Duration.ofSeconds(10))\n    .until(ExpectedConditions.visibilityOfElementLocated(By.id("checkout-button")));\ndriver.findElement(By.id("checkout-button")).click();\nSelect shipping = new Select(driver.findElement(By.name("shippingMethod")));\nshipping.selectByVisibleText("Express (1-2 days)");\ndriver.findElement(By.id("place-order")).click();\nAssert.assertTrue(driver.findElement(By.cssSelector(".order-confirmation")).isDisplayed());\nAssert.assertEquals(driver.getTitle(), "Order confirmed - Fabricated Shop");`,
      output: `import { test, expect } from '../src/fixtures';\n\ntest.describe('CheckoutTest', () => {\n  test.beforeEach(async ({ page, checkoutPage, loginPage }) => {\n    await loginPage.open();\n    await loginPage.login('qa.buyer@example.test', 'Secret123!');\n  });\n\n  test('addItemToCartAndCheckout', async ({ page, checkoutPage, loginPage }) => {\n    await page.goto('/catalog');\n    await checkoutPage.searchBox.fill('wireless mouse');\n    await checkoutPage.searchSubmit.click();\n    // NOTE(sdet-architect): removed hard wait 2000ms (Thread.sleep(2000)); Playwright auto-waits on actions and expect().  [src/test/java/com/fabricated/shop/tests/CheckoutTest.java:45]\n    await checkoutPage.cartElement.click();\n    await expect(checkoutPage.cartCount).toHaveText('1');\n    await checkoutPage.cartLink.click();\n    await checkoutPage.checkoutButton.waitFor({ state: 'visible' });\n    await checkoutPage.checkoutButton.click();\n    await checkoutPage.shippingMethod.selectOption({ label: 'Express (1-2 days)' });\n    await checkoutPage.placeOrder.click();\n    await expect(checkoutPage.orderConfirmation).toBeVisible();\n    await expect(page).toHaveTitle('Order confirmed - Fabricated Shop');\n  });\n  …\n  test('legacyHelperOnly', async ({ page, checkoutPage, loginPage }) => {\n    await page.goto('/account');\n    // TODO(sdet-architect): takeScreenshotAndUpload(driver, "account")  [src/test/java/com/fabricated/shop/tests/CheckoutTest.java:71]\n    await checkoutPage.li4AElement.click();\n  });\n});\n\n• partial: legacyHelperOnly has 1 TODO in 3 steps\n• QA_USER / QA_PASS inlined; BASE_URL detected and stripped from every goto\n• cartElement = the positional xpath (0.50, low-confidence table); li4AElement = the absolute xpath (0.20, high finding)`,
    },
    {
      caption: 'LoginPage.java (PageFactory) → src/pages/Login.page.ts (status: converted, 4/4)',
      input: `@FindBy(id = "username")   private WebElement usernameInput;\n@FindBy(name = "password") private WebElement passwordInput;\n@FindBy(css = "button[type='submit']") private WebElement signInButton;\nprivate final By errorBanner = By.xpath("//div[@class='alert alert-danger']");\nprivate final By forgotPasswordLink = By.linkText("Forgot your password?");\n\npublic void login(String user, String pass) {\n    usernameInput.clear();\n    usernameInput.sendKeys(user);\n    passwordInput.sendKeys(pass);\n    signInButton.click();\n}\npublic String errorText() { return driver.findElement(errorBanner).getText(); }`,
      output: `export class LoginPage {\n  readonly usernameInput: Locator;\n  readonly passwordInput: Locator;\n  readonly signInButton: Locator;\n  readonly errorBanner: Locator;\n  readonly forgotPasswordLink: Locator;\n\n  constructor(readonly page: Page) {\n    this.usernameInput = page.locator('#username');                       // id → 0.95\n    this.passwordInput = page.locator('[name="password"]');                // name → 0.85\n    this.signInButton = page.locator('button[type="submit"]');             // css, quotes normalised → 0.80\n    this.errorBanner = page.locator('div[class="alert alert-danger"]');    // xpath reduced → 0.60, on the line, not flagged\n    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot your password?', exact: true });   // linkText → 0.90\n  }\n\n  async open(): Promise<void> { await this.page.goto('/login'); }\n\n  async login(user: string, pass: string): Promise<void> {\n    await this.usernameInput.clear();\n    await this.usernameInput.fill(user);\n    await this.passwordInput.fill(pass);\n    await this.signInButton.click();\n  }\n\n  async errorText(): Promise<string> {\n    return (await this.errorBanner.textContent()) ?? '';\n  }\n\n  async goToForgotPassword(): Promise<void> { await this.forgotPasswordLink.click(); }\n}\n\n• field names are the Java aliases, kept\n• user / pass stayed parameters; Promise<string> derived from the trailing read step\n• PageFactory.initElements and the WebDriver field dropped as noise`,
    },
    {
      caption: 'The migration report for the fixture estate: run 46f19623, 2026-09-11',
      input: '`LLM_PROVIDER=none npm run agent:sdet -- --src "$PWD/fixtures/sdet-architect" --org fabricated-shop`',
      output: [
        'Output JSON: files 12, tests 28, converted 24, partial 2, manual 2, locators 38, low 3, coverage 91.7.',
        'Per-file table, 10 rows: LoginPage.java 4/4; AccountTests.cs, profile.test.js, test_cart.py, SearchTest.java 3/3 each; CheckoutTest.java 2+1; login.feature 3 scenarios with LoginSteps.java kept; Postman 3+1; test plan 0/2.',
        'TODO list of 9: seven from the two markdown test cases, `takeScreenshotAndUpload(driver, "account")`, and the Postman body assertion.',
        'Locator confidence 15 / 17 / 3 / 2 / 1; by strategy id 11, css 9, xpath 7, linkText 4, name 3, className 2, partialLinkText 1, tagName 1.',
        'Findings: conversion 9, flakiness 4, duplication 9, quality 3, locator 3.',
        '26 files, including `tests/features/login.feature` verbatim, `tests/steps/login.steps.ts` from `createBdd`, and `tests/api/shop-api.spec.ts` with env-overridable collection variables.',
      ],
    },
  ],
  underHood: [
    { heading: 'Inventory', whenRuns: 'Phase a, the only part that reads the filesystem.', input: '`source_dir`, optional `include` / `exclude` globs, `language_hint`.', output: 'One `InventoryEntry` per file (path, kind, bytes, lines, language) and a `Map` of contents — via `inventory()`, `globToRegExp()`, `classifyFile()`.' },
    { heading: 'The intermediate model', whenRuns: 'Phase b, every parser targets it.', input: 'Source text.', output: 'A `TestSuite`: `tests[]`, `pageObjects[]`, `hooks[]`, `locators[]`, `urls[]`, `constants`, plus `feature`, `stepDefinitions` or `requests`; every `Step` carries `kind`, `locator`, `value` / `valueExpr`, `assertion`, `raw`, `line` — see `model.ts`.' },
    { heading: 'Normalisation and scope', whenRuns: 'Per statement, inside every method body.', input: 'One statement and the method\'s `Scope` (elements, By variables, typed values, page-object variables, parameters, constants).', output: 'A token string such as `«E0».sendKeys(«S1»)` and the side tables that resolve the tokens — via `normalize()`, `resolveConcat()`.' },
    { heading: 'Locator confidence', whenRuns: 'Once per unique `strategy:value`, cached in the plan.', input: 'A `Locator` and the estate-wide `testIdAttribute` decision.', output: 'A `StdLocator` with `expr`, `confidence` and a `note` when under 0.60 — via `standardize()`, `standardizeXpath()`, `chooseTestIdAttribute()`.' },
    { heading: 'Plan, pages, fixtures', whenRuns: 'Phase c, before any code is emitted.', input: 'All suites.', output: 'Planned pages with unique class names, files, fixture names and fields; `src/fixtures/index.ts` extending `test` with one fixture per page — via `buildPlan()`, `genFixtures()`.' },
    { heading: 'Findings and MIGRATION.md', whenRuns: 'Phase d, after generation, before the write.', input: 'The `GenerateOutput`.', output: 'Rows in `findings` (locator, conversion, flakiness, duplication, quality) and the eight-section report — via `run()` and `buildMigrationReport()`.' },
    { heading: 'Preview, no disk, no database', whenRuns: 'On `POST /agents/sdet-architect/preview`.', input: '`{ language?, code, filename?, base_url? }`.', output: '`{ kind, output_file, spec, tests_found, todos, coverage_pct }` for that one file — via `preview()`, nothing written.' },
  ],
  diagrams: [
    { heading: 'Pipeline', after: 'lead', svg: D.sdetPipeline, caption: 'Seven input dialects, one intermediate model, one generated project. Phases a–d map to steps 1–8 below.' },
    { heading: 'One statement through normalisation', after: 'flow', svg: D.sdetNormalize, caption: 'Steps 3 and 4 on a real line from the fixture estate. Tokens replace syntax, so Java, C#, JavaScript and Python share one classifier.' },
    { heading: 'Locator confidence ladder', after: 'flow', svg: D.sdetConfidence, caption: 'Step 5. Bar length is the confidence; the dashed line is the review threshold.' },
    { heading: 'From steps to a status', after: 'flow', svg: D.sdetStatus, caption: 'Step 7. This is what the Status column in MIGRATION.md means.' },
  ],
  status: 'toolkit',
  runbook: {
    runnable: true,
    prerequisites: [
      'Node 24 and `npm install` in the repo. No Java, Python or .NET toolchain: the parsers read text.',
      'A folder with the legacy estate, as an **absolute** path. The bundled `fixtures/sdet-architect` is a fabricated one to try first.',
      'Optionally the application\'s base URL; otherwise the most common navigated origin is detected.',
    ],
    steps: [
      { label: 'Install and initialise', cmd: 'npm install\nnpm run db:init', why: 'Same database as the Forward Deployed Tester; both agents write to `data/forward-qa.db`.' },
      { label: 'Run it on the bundled fabricated estate', cmd: 'LLM_PROVIDER=none npm run agent:sdet -- --src "$PWD/fixtures/sdet-architect" --org fabricated-shop', why: [
        'Twelve files: Java, Python, C# and JavaScript Selenium, a `.feature`, a Postman collection, a markdown test plan, two config files.',
        'Prints the output JSON and the path of `MIGRATION.md`.',
      ], firstRun: 'Run `46f19623` on 2026-09-11: 12 files, 28 tests, 24 / 2 / 2, 38 locators, 3 low, 91.7% coverage, 26 files written.', rerun: 'Byte-for-byte identical output under `LLM_PROVIDER=none`; a new run id and directory each time.' },
      { label: 'Run it on a real estate', cmd: 'npm run agent:sdet -- --src /abs/path/to/legacy-tests --org acme --base-url https://app.acme.example.test\nnpm run agent:sdet -- --src /abs/path/to/legacy-tests --org acme --include "**/*.java" --exclude "**/archive/**"\nnpm run agent:sdet -- --src /abs/path/to/legacy-tests --org acme --dry-run', why: [
        '`--include` / `--exclude` are globs relative to `source_dir`, added to the default excludes.',
        '`--dry-run` computes everything, writes nothing, and still returns the full `MIGRATION.md` text in the output JSON.',
      ] },
      { label: 'Read MIGRATION.md top-down', cmd: 'cat workspace/<run_id>/playwright/MIGRATION.md', why: 'Eight sections: header numbers, inventory, per-file status, TODO list, locator confidence, findings, generated tree, next steps, MCP. `grep -rn "TODO(sdet-architect)"` in the output gives the same TODO list.' },
      { label: 'Typecheck and run the generated project', cmd: 'cd workspace/<run_id>/playwright\nnpm install\nnpx playwright install --with-deps\nnpm run typecheck\nBASE_URL=https://staging.acme.example.test npm test -- --project=chromium', why: [
        'The repo\'s end-to-end test already compiles the generated project with `tsc`, so `typecheck` is the first gate.',
        'The fabricated estate targets `https://shop.example.test`, which does not exist, so `npm test` there fails at navigation by design.',
        'Against a real estate, run one spec at a time and work the TODO list.',
      ], firstRun: 'On the fixture estate `typecheck` passes; the specs cannot pass because the site is fictional.' },
      { label: 'Convert one file without touching disk', cmd: 'npm start\ncurl -s -X POST localhost:8787/agents/sdet-architect/preview -H \'content-type: application/json\' \\\n  -d "{\\"language\\":\\"java\\",\\"code\\":$(jq -Rs . < LoginTest.java)}" | jq -r .spec', why: 'Classifies, parses, plans and generates for one file and returns the spec plus `tests_found`, `todos`, `coverage_pct`. Nothing written, no run row.' },
      { label: 'Drive the generated pages from an MCP client', cmd: 'cd workspace/<run_id>/playwright\nnpm run mcp    # mcp-server-playwright --config playwright-mcp.config.json', why: '`.mcp.json` and `playwright-mcp.config.json` come with the project; `src/pages/*.page.ts` is the vocabulary for exploratory checks.' },
      { label: 'Run the agent\'s own tests', cmd: 'npm test', why: 'Parsers for every dialect, the locator table, the emitters, the inventory, and one end-to-end run over the fixture that also `tsc`-compiles the output.', firstRun: 'Part of the 89 green tests on 2026-09-11.' },
    ],
    inputs: [
      { name: '--src / source_dir', desc: 'Absolute path to the legacy estate.' },
      { name: '--org / org_slug', desc: 'Names the generated package (`<org>-playwright`) and the report.' },
      { name: '--include, --exclude', desc: 'Globs relative to the estate; `**`, `*`, `?`, `{a,b}` supported.' },
      { name: '--base-url / base_url', desc: 'Optional; else detected from the most common navigated origin, ignoring `api.*` hosts.' },
      { name: '--language-hint / language_hint', desc: '`java` `python` `csharp` `javascript` `typescript` `auto` (default).' },
      { name: '--dry-run / dry_run', desc: 'Compute everything, write nothing.' },
    ],
    outputs: [
      { name: 'workspace/<run_id>/playwright/', desc: 'The standardised project: `src/pages`, `src/fixtures`, `tests`, `tests/features`, `tests/steps`, `tests/api`, config, CI, `.mcp.json`, `MIGRATION.md`.' },
      { name: 'Output JSON', desc: '`inventory`, `files_scanned`, `tests_found`, `tests_converted`, `tests_partial`, `tests_manual`, `locators_total`, `locators_low_confidence`, `coverage_pct`, `output_dir`, `migration_report`.' },
      { name: 'Rows in findings and artifacts', desc: 'Five finding categories; one artifact per generated file with its kind.' },
      { name: 'GET /agents/sdet-architect/runs/:id/migration', desc: '`MIGRATION.md` as `text/markdown`, straight from the run\'s output JSON.' },
    ],
    rerun: [
      'Deterministic: same estate, same options, same bytes. A second run after someone edits the legacy code is a clean diff of the generated project.',
      'Runs are never overwritten.',
      'With a local model, only the `suggestion:` comments next to TODOs can differ; the code lines cannot.',
    ],
    integrate: [
      'Move `workspace/<run_id>/playwright` into the application repo; keep `MIGRATION.md` at its root as the work list; wire the workflow into CI.',
      'Work the TODO list top-down; delete the `NOTE(sdet-architect)` lines once the specs are green three runs in a row.',
      'To support another dialect: one parser returning a `TestSuite` (see `parsers/selenium-python.ts`, ~110 lines) plus one `case` in `classifyFile` and `parseOne`.',
      'In the engagement on the [process page](../process.html), this project is the regression layer that runs on every change during and after the pilot.',
    ],
  },
};

// ────────────────────────────────────────────────────────────────────── plate 46
const AU = 'src/agents/ai-site-auditor';
const audit = {
  slug: 'the-ai-site-auditor',
  plate: 46,
  name: 'The AI Site Auditor',
  techName: 'src/agents/ai-site-auditor/ — bots.ts · robots.ts · parse.ts · collect.ts · rules.ts · report.ts · index.ts',
  category: 'audit',
  oneLiner: 'Point it at a site built with an AI tool; it scores whether AI assistants can read and cite it, whether search engines will index it, and which build mistakes were left behind, then writes an evaluation page.',
  lead: [
    'Built for sites made with Lovable, Bolt, v0, Replit or a Vite/CRA export: they look finished in a browser and are often empty to a crawler.',
    'Sees every page twice: the raw HTML with JavaScript off, which is all OpenAI, Anthropic and Perplexity crawlers get, and the page rendered in Chromium.',
    'Checks robots.txt per AI agent, requests the site with each crawler\'s real user agent to catch firewall blocks, and scans the JavaScript bundle for leaked keys.',
    '51 deterministic checks in three areas, each scored 0–100: **AI visibility**, **Search**, **Build quality**.',
    'Writes one self-contained `report.html` for the site owner, plus markdown, JSON and database findings.',
    'Fixture runs on 2026-09-13: the AI-builder SPA scores 0 · F for AI visibility with 97 words in a browser and 0 for crawlers; the server-rendered site scores 100 · A.',
  ],
  chore: [
    'Nobody checks what a crawler receives; an empty shell goes unnoticed.',
    'SEO tools ignore AI assistants and never open the bundle.',
    'Scaffold titles, placeholders and API keys ship because the preview looked right.',
  ],
  instead: [
    'One command against the URL.',
    'Three grades and a crawler-versus-browser comparison.',
    'Each finding says why it matters, how to fix it, which pages, and cites its source.',
  ],
  whyItMatters: [
    'A growing share of discovery happens inside ChatGPT, Claude, Perplexity and AI Overviews.',
    'Those assistants can only cite what their crawlers can read, and most of those crawlers do not run JavaScript.',
    'A site can rank in Google and still be invisible to every assistant that answers without rendering.',
  ],
  howItWorks: [
    {
      step: 'Probes the site over plain HTTP before any browser starts: robots.txt, same-origin sitemaps, llms.txt, a random URL, /.env, the http redirect and security headers.',
      short: 'Probe the site without a browser',
      fn: 'collect() site facts + fetchText() — collect.ts',
      explain: [
        '`fetchText` never throws: timeouts and DNS failures come back as status 0 with the error, so one dead probe cannot sink the audit.',
        'An HTML page served at `/robots.txt` is recorded as status -1: the SPA catch-all answering every path.',
        'Sitemaps on another host are recorded and never fetched, so auditing a staging copy never touches production.',
        'A random `/ai-site-auditor-<id>-not-a-page` path answering 200 is a soft 404.',
      ],
      code: join(
        ann(block(`${AU}/collect.ts`, /^export async function fetchText/, /^}/), [
          [/AbortSignal\.timeout/, 'every request is bounded'],
          [/MAX_BODY/, '3 MB cap per response'],
          [/status: 0, headers: \{\}/, 'failures are data, not exceptions'],
        ]),
        GAP,
        ann(block(`${AU}/collect.ts`, /status -1 = an HTML page/, /const robots = /), [[/robotsIsHtml =/, 'SPA fallback detection']]),
        GAP,
        ann(block(`${AU}/collect.ts`, /Only this origin is ever fetched/, /const sitemapPages/), [[/offHost = /, 'recorded, never followed']]),
      ),
    },
    {
      step: 'Requests the home page with the real user-agent strings of OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot and PerplexityBot, and compares the answers with a browser\'s.',
      short: 'Knock as each AI crawler',
      fn: 'looksBlocked() + botProbes — collect.ts · AI_BOTS — bots.ts',
      explain: [
        'robots.txt can allow a crawler while a CDN or firewall rule still turns it away; only a request with its user agent shows that.',
        'Blocked means 401, 403, 429, 5xx or a challenge page, and only when the browser request itself was fine.',
        'User-agent strings come from the vendors\' own documentation.',
        'Prerendering served only to verified crawler IPs cannot be seen from outside; the report says so.',
      ],
      code: join(
        ann(block(`${AU}/bots.ts`, /^export const AI_BOTS/, /^\];/), [
          [/token: 'OAI-SearchBot'/, 'search: decides whether ChatGPT search cites you'],
          [/token: 'GPTBot'/, 'training: blocking it is a policy choice'],
          [/token: 'Googlebot'/, 'the only one here that renders JavaScript'],
          [/token: 'Google-Extended'/, 'a robots.txt token, never a request'],
        ]),
        GAP,
        ann(block(`${AU}/collect.ts`, /^function looksBlocked/, /^}/), [[/cf-chl\|challenge-platform/, 'Cloudflare-style challenge pages']]),
      ),
    },
    {
      step: 'Fetches each page\'s raw HTML once, then loads it into Chromium twice: with JavaScript disabled and that exact response fulfilled into the page, and normally.',
      short: 'See each page twice',
      fn: 'rawView() + renderedView() — collect.ts',
      explain: [
        'The raw view is not a second request: `page.route` fulfils the bytes already fetched, so both views describe the same response.',
        'With JavaScript off, Chromium still parses the HTML and lays it out, so one extraction script reads both views identically.',
        'The rendered view does not wait for the load event; one slow image can hold it forever. It waits up to 8 s, then reads the page anyway.',
        'If rendering fails, the raw view stands in and the failure becomes a finding.',
      ],
      code: join(
        ann(block(`${AU}/collect.ts`, /^async function rawView/, /^}/), [
          [/page\.route/, 'serve the fetched bytes, do not refetch'],
          [/waitUntil: 'domcontentloaded'/, 'no scripts run: javaScriptEnabled is false on this context'],
        ]),
        GAP,
        ann(block(`${AU}/collect.ts`, /Do not wait for the load event/, /return \{ rendered: view/), [
          [/waitForLoadState\('load'/, 'bounded: 8 s, then carry on'],
          [/networkidle/, 'give client rendering a moment'],
        ]),
      ),
    },
    {
      step: 'Extracts the same fields from both views: title, description, canonical, robots meta, h1s, readable words, links, hash routes, images and alt text, JSON-LD types, Open Graph, favicon.',
      short: 'Read both views the same way',
      fn: 'EXTRACT_SCRIPT — collect.ts',
      explain: [
        'Plain JavaScript source, not a TypeScript function, so no transpiler helpers leak into the page.',
        'JSON-LD blocks are parsed and walked, including `@graph`; a block that is not valid JSON is counted as an error.',
        'The copy used for placeholder checks strips forms, labels and controls: "Company Name" on a field is not placeholder text.',
      ],
      code: ann(block(`${AU}/collect.ts`, /^export const EXTRACT_SCRIPT/, /^}`;/), [
        [/const words = /, 'the number the AI-visibility verdict rests on'],
        [/querySelectorAll\('form,label,input/, 'regression fix: field labels are not placeholder copy'],
        [/if \(node\['@graph'\]\)/, 'walk @graph'],
        [/hashRouteLinks:/, '#/ routes are invisible to every crawler'],
      ]),
    },
    {
      step: 'Scans every same-origin script for credentials: OpenAI, Anthropic, Stripe, AWS and GitHub keys, private keys, and Supabase JWTs decoded to tell anon from service_role.',
      short: 'Scan the bundle for secrets',
      fn: 'findSecrets() + redact() — parse.ts',
      explain: [
        'AI builders often call an API straight from the browser with a real key; everything in a bundle is public.',
        'Supabase anon keys are expected in the browser and ignored; a `service_role` key bypasses row-level security and is critical.',
        'Google browser keys are reported as info: normal for Maps or Firebase when restricted.',
        'Values are redacted to six characters everywhere: database, report, JSON.',
      ],
      code: join(
        ann(block(`${AU}/parse.ts`, /^const SECRET_PATTERNS/, /^\];/), [[/severity: 'info'/, 'restricted browser keys are normal']]),
        GAP,
        ann(block(`${AU}/parse.ts`, /^export function findSecrets/, /^}/), [
          [/role === 'service_role'/, 'decode the JWT: role decides the severity'],
          [/preview: redact\(v\)/, 'never the value itself'],
        ]),
      ),
    },
    {
      step: 'Decides robots.txt access per AI agent the way RFC 9309 does: the most specific user-agent group, the longest matching rule, allow winning ties, * and $ wildcards.',
      short: 'Decide access per crawler',
      fn: 'parseRobots() + isAllowed() — robots.ts',
      explain: [
        'A crawler with its own group ignores the `*` group entirely; a common surprise when "User-agent: GPTBot" blocks were added.',
        'Blocking search or user-fetch agents is a high finding; blocking training agents is never a finding.',
        'Every decision carries the rule that made it, shown in the report\'s access table.',
      ],
      code: ann(block(`${AU}/robots.ts`, /^export function isAllowed/, /^}/), [
        [/groupFor\(robots, token\)/, 'exact token group, else *, else none'],
        [/r\.path\.length > best\.path\.length/, 'longest rule wins'],
        [/r\.allow && !best\.allow/, 'allow wins a tie'],
      ]),
    },
    {
      step: 'Runs 51 checks with fixed severities and aggregates across pages: one root cause on fifty pages is one finding listing the fifty pages.',
      short: 'Apply the rules',
      fn: 'evaluate() + jsOnly() + integrity() — rules.ts',
      explain: [
        'The central verdict: rendered words ≥ 10 and raw words below max(5, 30% of rendered) means the content needs JavaScript. Critical on the home page.',
        'Integrity checks run first: a page that could not render is a finding, and no audited page means a critical in every area, never a silent 100.',
        'Local, private-network and preview hosts downgrade production canonicals to info; they are expected there.',
      ],
      code: join(
        ann(block(`${AU}/rules.ts`, /^export const MIN_RENDERED_WORDS/, /^}/), [
          [/MIN_RENDERED_WORDS = 10/, 'regression fix: was 50, and skipped small app shells'],
          [/Math\.max\(RAW_FLOOR, ren \* RAW_SHARE\)/, 'the whole verdict in one line'],
        ]),
        GAP,
        ann(block(`${AU}/rules.ts`, /^function integrity/, /^  const failed = /), [[/audit\.nothing-audited'/, 'regression fix: a failed audit once scored 100']]),
      ),
    },
    {
      step: 'Scores each area as 100 minus 40 per critical, 18 per high, 8 per medium and 3 per low finding, grades A to F, and writes the evaluation page, markdown and JSON.',
      short: 'Score and write the page',
      fn: 'scores() + grade() — rules.ts · renderReportHtml() — report.ts',
      explain: [
        'The page is self-contained HTML with inline CSS, light and dark, printable, and runs no JavaScript.',
        'It leads with the three grades, then the crawler-versus-browser comparison, the AI access table, findings by area, pages and site files.',
        'The summary is built from counts; a local model may only rephrase it, and the footer says whether one did.',
      ],
      code: join(
        ann(block(`${AU}/rules.ts`, /^export const WEIGHTS/, /^export function grade/), [[/critical: 40/, 'one critical drops an area to 60']]),
        GAP,
        ann(block(`${AU}/report.ts`, /^export function deterministicSummary/, /^}/), [[/in the HTML that AI crawlers receive/, 'the sentence a site owner remembers']]),
      ),
    },
  ],
  examples: [
    {
      caption: 'The fixture AI-builder SPA: run a70d48e1, 2026-09-13',
      input: '`npm run agent:audit -- --url http://127.0.0.1:4801/ --org acme-robotics` against a Vite-style SPA: empty `<div id="root">`, catch-all server, "Vite + React" title, a Lovable badge, an OpenAI-shaped key in the bundle, PerplexityBot answered with 403.',
      output: [
        'Scores: AI visibility 0 · F, search 46 · D, build quality 23 · F. 20 findings: 2 critical, 5 high, 7 medium, 6 low. 2 pages in 1.6 s.',
        'critical: content only after JavaScript on 2 of 2 pages (home: 97 words rendered, 0 raw).',
        'critical: OpenAI API key in /assets/index.js, shown as sk-pro…(56 chars).',
        'high: title set by JavaScript, h1 set by JavaScript, PerplexityBot blocked by user agent, soft 404, scaffold title "Vite + React".',
        'medium: no sitemap, duplicate titles and descriptions, placeholder copy (John Doe, 555 number, example email), console errors.',
      ],
    },
    {
      caption: 'The fixture server-rendered site: run 23fed86c, 2026-09-13',
      input: '`npm run agent:audit -- --url http://127.0.0.1:4802/ --org acme-robotics` against the same content served as HTML, with a robots.txt that blocks only GPTBot, a sitemap, llms.txt, JSON-LD, canonicals, and one image request that never finishes.',
      output: [
        'Scores: AI visibility 100 · A, search 97 · A, build quality 97 · A. 2 low findings.',
        'Home page: 126 words raw, 126 rendered.',
        'GPTBot blocked by its own robots group; OAI-SearchBot still allowed; no finding, because blocking training is a choice.',
        'low: the load event never fired (the hanging image), yet both pages were fully audited.',
        'low: robots.txt lists a sitemap on another host; recorded, not fetched.',
      ],
    },
    {
      caption: 'Validation on three real builds, before release',
      input: 'Two Create React App builds and one Next.js build from this machine, served locally with the SPA fallback that Vercel and Netlify apply.',
      output: [
        'CRA build 1: AI visibility D, 0 of 18 words visible without JavaScript.',
        'CRA build 2: AI visibility F, 9 of 435 words on the home page; "React App" title on 8 pages; soft 404; 1.3 MB of JavaScript.',
        'Next.js build: AI visibility A, 192 of 193 words; no canonical and no og:image, both confirmed in the raw HTML.',
        'Found and fixed three bugs: a render timeout that scored a site 100 while auditing nothing, a threshold that skipped small shells, a form label read as placeholder copy.',
      ],
    },
  ],
  underHood: [
    { heading: 'Site facts', whenRuns: 'First, over plain HTTP, in parallel.', input: 'The start URL.', output: 'robots.txt (or -1 for an HTML fallback), same-origin sitemaps, llms.txt, soft-404 status, http redirect, /.env, security headers, one response per AI user agent — via `collect()`, `fetchText()`, `parseRobots()`, `parseSitemap()`.' },
    { heading: 'Two views', whenRuns: 'Per page, up to `max_pages`.', input: 'The raw response, fetched once.', output: 'A `PageView` with JavaScript off and one with JavaScript on, plus console errors, failed requests, mixed content and script sizes — via `rawView()`, `renderedView()`, `EXTRACT_SCRIPT`.' },
    { heading: 'Bundle scan', whenRuns: 'For each same-origin script, up to 8 MB in total.', input: 'Script text.', output: 'Redacted secret hits and public source maps — via `findSecrets()`, `redact()`.' },
    { heading: 'Rules and scores', whenRuns: 'After collection; pure.', input: '`SiteFacts`.', output: 'Sorted `CheckResult[]` with area, severity, why, fix, pages, evidence and source; three scores and grades — via `evaluate()`, `scores()`, `grade()`.' },
    { heading: 'Evaluation page', whenRuns: 'Last.', input: 'Facts, results, summary.', output: '`report.html`, `report.md`, `report.json`; one findings row per result and one artifact row per file — via `renderReportHtml()`, `renderReportMarkdown()`, `buildReportJson()`.' },
  ],
  outputSample: { heading: 'The evaluation page', whenRuns: 'Written at the end of every run.', input: 'The fixture SPA audit.', output: 'Three grades, the crawler-versus-browser comparison, the AI access table and findings by area.', img: 'report-sample.png', imgAlt: 'Top of the evaluation page: grades F, D, F and the AI crawler versus browser comparison', caption: 'report.html for the fixture SPA' },
  diagrams: [
    { heading: 'Pipeline', after: 'lead', svg: D.auditPipeline, caption: 'Probes, two views, rules, report. Only the audited host is ever fetched.' },
    { heading: 'One page, two views', after: 'flow', svg: D.auditTwoViews, caption: 'Steps 3 and 4 on the fixture SPA home page. The comparison, not either view alone, is the finding.' },
    { heading: 'Who reads what', after: 'flow', svg: D.auditBots, caption: 'Steps 2 and 6. Blocking a search or user-fetch agent costs citations; blocking a training agent does not.' },
    { heading: 'How the scores work', after: 'flow', svg: D.auditScore, caption: 'Step 8. Fixed weights, no model, same result every run.' },
  ],
  status: 'toolkit',
  runbook: {
    runnable: true,
    prerequisites: [
      'Node 24 and `npm install` in the forward-qa-agents repo; `npx playwright install chromium` once.',
      'A site you own or are authorised to test: the audit sends about a dozen probes, including a request for `/.env`.',
    ],
    steps: [
      { label: 'Start the two fixture sites', cmd: 'npm run fixture:audit-sites', why: 'An AI-builder SPA on :4801 and a server-rendered site on :4802, so the first run needs no real site.' },
      { label: 'Audit the SPA', cmd: 'LLM_PROVIDER=none npm run agent:audit -- --url http://127.0.0.1:4801/ --org acme-robotics', why: 'Prints scores, grades, finding counts and the path to `report.html`.', firstRun: 'Run a70d48e1 on 2026-09-13: 0 · F, 46 · D, 23 · F; 20 findings in 1.6 s.' },
      { label: 'Open the evaluation page', cmd: 'open workspace/<run_id>/report.html', why: 'Self-contained: email it, attach it to a ticket, or print it.' },
      { label: 'Audit a real site', cmd: 'npm run agent:audit -- --url https://www.example.com/ --org acme --max-pages 20', why: [
        'Start on the production domain to judge production; on a preview host, canonicals pointing at production are reported as info.',
        'Raise `--timeout-ms` for slow sites; a page that cannot render is reported, never silently skipped.',
      ] },
      { label: 'Same thing through the REST API', cmd: 'npm start\ncurl -s -X POST localhost:8787/agents/ai-site-auditor/runs -H \'content-type: application/json\' \\\n  -d \'{"engagement_id":"<id>","input":{"target_url":"https://www.example.com/","org_slug":"acme"}}\'\ncurl -s localhost:8787/agents/ai-site-auditor/runs/<run_id>/report > report.html', why: 'The report route serves the evaluation page as HTML.' },
      { label: 'Run its tests', cmd: 'npm test', why: 'Robots matching, secret detection, rules on synthetic facts, five regression tests, and both fixture sites end to end.', firstRun: 'Part of 99 green tests on 2026-09-13.' },
    ],
    inputs: [
      { name: '--url / target_url', desc: 'Start page; only its host is fetched.' },
      { name: '--org / org_slug', desc: 'Label for the report.' },
      { name: '--max-pages / max_pages', desc: '1–50, default 10.' },
      { name: '--timeout-ms / timeout_ms', desc: 'Per request and navigation, default 15000.' },
    ],
    outputs: [
      { name: 'workspace/<run_id>/report.html', desc: 'The evaluation page.' },
      { name: 'report.md, report.json', desc: 'The same results for tickets and pipelines; JSON includes the per-bot access table and per-page word counts.' },
      { name: 'Rows in findings and artifacts', desc: 'Category is the area; evidence holds the check id, pages and source.' },
    ],
    rerun: [
      'Deterministic: same site, same results. Re-run after each fix and compare grades.',
      'Runs are never overwritten; every run gets its own directory.',
    ],
    integrate: [
      'Run it in CI against each preview deployment and fail the build on any critical finding (`findings_by_severity.critical > 0`).',
      'Hand `report.html` to whoever owns the site; each finding carries its own fix and source.',
    ],
  },
};

for (const a of [fdt, sdet, audit]) {
  for (const ex of a.examples) {
    const strip = (v) => Array.isArray(v) ? v.map((s) => s.replace(/\*\*/g, '')) : v.replace(/\*\*/g, '');
    ex.input = strip(ex.input); ex.output = strip(ex.output);
  }
}

// Two sites, one source. The SDET site has no process page of its own, so its links go to the FDT site.
const FDT_SITE = 'https://akc031185.github.io/forward-deployed-tester/';
const sdetOut = JSON.parse(JSON.stringify(sdet).replace(/\.\.\/process\.html/g, FDT_SITE + 'process.html'));
for (const [site, content] of [['fdt', fdt], ['sdet', sdetOut], ['audit', audit]]) {
  const dir = path.join(R, '_build/sites', site, 'content');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${content.slug}.json`), JSON.stringify(content, null, 1) + '\n');
}
console.log('wrote _build/sites/{fdt,sdet,audit}/content');
