// The SDET Roadmap: content as data. Two tracks, six stages each. Every stage has a goal, at most six
// steps, a deliverable, and an exit gate of measurable targets with the way to measure each.
// House rules: prose over two lines becomes bullets (max six); no borrowed numbers as targets — every
// target is a fixed bar or relative to the learner's own baseline.

export const SOURCES = {
  rbc: { label: 'Royal Bank of Canada — Agentic SDET I (posted Jul 2026)', url: 'https://freehire.me/jobs/agentic-sdet-i-royal-bank-of-canada-czd2czcd' },
  apple: { label: 'Apple — Senior SDET, LLM Evaluation & Automation (posted Aug 2026)', url: 'https://freehire.me/jobs/senior-software-development-engineer-in-test-llm-evaluation-automation-t3e-apple-vs5z6pti' },
  testmu: { label: 'TestMu — The SDET skill stack for the agentic era (Sep 2026)', url: 'https://www.testmuai.com/blog/sdet-skill-stack-agentic-era/' },
  pwAgents: { label: 'Playwright docs — Test agents (planner, generator, healer)', url: 'https://playwright.dev/docs/test-agents' },
  owasp: { label: 'OWASP Top 10 for LLM Applications (2025)', url: 'https://genai.owasp.org/llm-top-10/' },
  langfuse: { label: 'Langfuse — AI agent evaluation: trajectory, tool calls, task completion', url: 'https://langfuse.com/resources/engineering/ai-agent-evaluation' },
  confident: { label: 'Confident AI — LLM agent evaluation metrics (2026)', url: 'https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide' },
  kappa: { label: 'Arize — Measuring human and LLM-judge alignment', url: 'https://arize.com/blog/measuring-human-llm-judge-alignment/' },
  currents: { label: 'Currents — Migrating from Selenium to Playwright (Mar 2026)', url: 'https://currents.dev/posts/migrating-from-selenium-to-playwright-the-complete-guide' },
  pwBest: { label: 'Playwright docs — Best practices (locators, web-first assertions, isolation)', url: 'https://playwright.dev/docs/best-practices' },
  sdetArchitect: { label: 'The SDET Architect — field guide', url: 'https://akc031185.github.io/sdet-architect/' },
  fdtProcess: { label: 'The Forward Deployed Tester — engagement process', url: 'https://akc031185.github.io/forward-deployed-tester/process.html' },
};

export const SIGNALS = [
  {
    title: 'Agentic AI testing is now its own job title',
    points: [
      'RBC\'s **Agentic SDET I** asks for hands-on testing of AI agent applications and LangChain, LangGraph, CrewAI or AutoGen.',
      'The same posting wants Playwright, Locust and CI, with Langfuse or Arize Phoenix observability and RAG as preferred skills.',
      'Apple\'s **Senior SDET, LLM Evaluation & Automation** centres on automated eval pipelines that catch model regressions before release.',
      'That role prefers hands-on LLM-as-a-judge and rubric design, plus Python and CI integration.',
    ],
    sources: ['rbc', 'apple', 'testmu'],
  },
  {
    title: 'Selenium-to-Playwright migration is hands-on work, not a keyword',
    points: [
      'Postings increasingly list Selenium and Playwright together: teams keep a Selenium estate while moving new work to Playwright.',
      'The work is inventory, architecture, conversion in slices, stabilisation and decommissioning, which this track follows.',
      'The proof employers can check is a before-and-after table from real runs, not a list of tools.',
    ],
    sources: ['currents', 'pwBest'],
  },
];

export const RULES = [
  'Every target is either a fixed bar (0 hard waits, κ ≥ 0.6) or relative to your own baseline (runtime lower than stage 0).',
  'No borrowed numbers: a vendor\'s case-study speed-up is never a target.',
  'Record the command and the date next to every number.',
  'A gate passes when its evidence file exists in the repo, not when the stage feels done.',
  'Targets marked "our bar" are this guide\'s standard; tighten them for your team, never loosen them silently.',
];

// ─────────────────────────────────────────────────────────── Selenium → Playwright (shown as Track 2)
export const MIGRATION = {
  id: 'selenium-to-playwright',
  file: 'selenium-to-playwright.html',
  short: 'Selenium → Playwright',
  card: 'For teams moving a live Selenium estate to Playwright without losing coverage.',
  title: 'Convert a Selenium framework to Playwright',
  accent: 8,
  lead: [
    'For an existing Selenium estate in Java, Python, C# or JavaScript that a team still depends on.',
    'Six stages: baseline, learn on one flow, set the architecture, convert in slices, stabilise, decommission.',
    'Ends with a RESULTS.md of before-and-after numbers from real runs.',
  ],
  outcome: 'A Playwright suite that matches the old one\'s verdicts, flakes less, and has no Selenium left.',
  stages: [
    {
      n: 0, title: 'Baseline the Selenium suite', map: 'Baseline the suite', time: '1 week',
      goal: 'Know exactly what you are migrating and how it performs today, in numbers.',
      steps: [
        'Inventory every test, page object, helper and data file; tag each with its business flow.',
        'Run the full suite 5 times on one build and keep every result file.',
        'Mark a test flaky if it both passed and failed across those 5 runs.',
        'Count hard waits (`Thread.sleep`, `time.sleep`) and XPath locators.',
        'Name the 10 business-critical flows that must never break.',
      ],
      deliverable: '`BASELINE.md` committed next to the suite, holding every number below.',
      gates: [
        ['Recorded runs', '5 full runs on one build', 'CI history or 5× local runs with saved reports'],
        ['Flake rate', 'computed (any value)', 'flaky tests ÷ total tests across the 5 runs'],
        ['Runtime', 'p50 of the 5 runs, in minutes', 'CI job durations'],
        ['Hard waits', 'counted', '`grep -rE "Thread\\.sleep|time\\.sleep" src | wc -l`'],
        ['XPath share', 'counted', 'locator histogram in the SDET Architect\'s MIGRATION.md'],
        ['Critical flows', '10 named, each mapped to tests', 'table in BASELINE.md'],
      ],
      agent: 'The SDET Architect with `--dry-run` produces the inventory, hard-wait count and locator histogram in one run.',
    },
    {
      n: 1, title: 'Learn Playwright on one real flow', map: 'One flow by hand', time: '1–2 weeks',
      goal: 'Rewrite one critical flow by hand, the Playwright way, before converting anything automatically.',
      steps: [
        'Rewrite login plus one critical flow from BASELINE.md by hand.',
        'Reach for `getByRole`, `getByLabel`, `getByTestId` first; CSS only when nothing else identifies the element.',
        'Replace every wait with web-first assertions such as `await expect(locator).toBeVisible()`.',
        'Put shared setup in fixtures, not copied `beforeEach` blocks.',
        'Break the test on purpose and diagnose it from the trace viewer.',
      ],
      deliverable: 'A repo with the flow, one trace file, and a page of Selenium-to-Playwright equivalents.',
      gates: [
        ['Stability', '20 of 20 runs pass', '`npx playwright test --repeat-each=20`'],
        ['Hard waits', '0', '`grep -rn "waitForTimeout" tests | wc -l`'],
        ['Semantic locators', '≥ 80% role, label, text or test id (our bar)', 'count `getBy*` against `locator(` in the specs'],
        ['Parallel-safe', 'passes with 4 workers', '`npx playwright test --workers=4 --repeat-each=5`'],
        ['Debugging', 'one failure diagnosed from a trace', '`npx playwright show-trace <trace.zip>`'],
      ],
    },
    {
      n: 2, title: 'Set the target architecture', map: 'Target architecture', time: '1 week',
      goal: 'One structure every converted test will land in, already running in CI before conversion starts.',
      steps: [
        'Folders for pages, fixtures, UI tests and API tests; one config with a project per browser.',
        'Base URL and secrets come from environment variables, never from code.',
        'Each test creates its own data through the API instead of sharing records.',
        'CI on every pull request: parallel workers, HTML report and traces uploaded on failure.',
        'Write STANDARDS.md: locator order, no sleeps, one behaviour per test.',
      ],
      deliverable: 'Architecture repo, CI pipeline, and `STANDARDS.md`.',
      gates: [
        ['CI', 'green on a pull request', 'pipeline run link'],
        ['Isolation', 'every test passes alone and in parallel', '`npx playwright test --fully-parallel --repeat-each=3`'],
        ['Secrets', '0 credentials in the repository', '`git grep -niE "password|api[_-]?key|secret"` reviewed'],
        ['Artifacts', 'report and trace attached to a failing run', 'CI artifacts list'],
        ['Runtime budget', 'set in minutes and written down', 'STANDARDS.md'],
      ],
      agent: 'The SDET Architect generates this layout (pages, fixtures, config, CI, `.mcp.json`) from the legacy suite.',
    },
    {
      n: 3, title: 'Convert module by module', map: 'Convert in slices', time: '3–8 weeks, by estate size',
      goal: 'Move the suite across in slices, old and new running side by side, until every critical flow has a Playwright twin.',
      steps: [
        'Generate a first pass automatically, then work the TODO list; do not rewrite from scratch.',
        'Migrate one business module at a time; Selenium keeps running for the rest.',
        'Run both suites on the same build and compare verdicts test by test.',
        'Seed 3 known bugs in a test environment; the Playwright suite must catch all of them.',
        'Retire a Selenium test only after its twin has matched it for 10 runs.',
      ],
      deliverable: '`MIGRATION.md` with coverage, TODOs closed and a parity table.',
      gates: [
        ['Conversion coverage', '≥ 90% of steps (our bar)', '`coverage_pct` in MIGRATION.md'],
        ['Open TODOs', '0 in migrated modules', '`grep -rn "TODO(sdet-architect)" tests | wc -l`'],
        ['Low-confidence locators', '≤ 5% of locators (our bar)', 'locator confidence table in MIGRATION.md'],
        ['Verdict parity', 'same pass/fail on 10 shared runs', 'side-by-side result diff'],
        ['Seeded bugs', '3 of 3 caught', 'defect-seeding log'],
        ['Critical flows', '10 of 10 migrated', 'BASELINE.md checklist'],
      ],
      agent: 'The SDET Architect writes the first pass and MIGRATION.md; every TODO carries its source `file:line`.',
    },
    {
      n: 4, title: 'Stabilise and speed up', map: 'Stabilise', time: '2 weeks',
      goal: 'Show the new suite is more trustworthy than the one it replaces.',
      steps: [
        'Run the suite 20 times in CI; fix or quarantine, with a ticket, any test that flips.',
        'Retries: 0 locally, at most 1 in CI. A retry hides a flake; it does not fix it.',
        'Shard across machines if a run exceeds the runtime budget.',
        'Tag smoke, regression and slow tests; run smoke on every pull request.',
      ],
      deliverable: '`STABILITY.md` with the 20-run results.',
      gates: [
        ['Flake rate', '< 1% over 20 runs (our bar) and below the stage 0 baseline', 'flipped tests ÷ total tests'],
        ['Runtime', 'below the stage 0 p50; report the %', 'CI durations'],
        ['Hard waits', '0', '`grep -rn "waitForTimeout" tests | wc -l`'],
        ['Quarantine', 'every quarantined test has a ticket', '`test.fixme` count equals ticket count'],
        ['Smoke on pull requests', '≤ 10 minutes (our bar)', 'CI job duration'],
      ],
    },
    {
      n: 5, title: 'Decommission and prove the result', map: 'Decommission', time: '1 week',
      goal: 'Remove Selenium and publish before-and-after numbers anyone can check.',
      steps: [
        'Remove Selenium dependencies, drivers and grid configuration.',
        'Publish a before-and-after table built from stage 0 and stage 4 measurements.',
        'Track the hours spent fixing tests for one month.',
        'Hand over: standards, runbook, and how to add a new test.',
      ],
      deliverable: '`RESULTS.md`: the one page you show in an interview or to leadership.',
      gates: [
        ['Selenium removed', '0 Selenium dependencies', '`mvn dependency:tree | grep -i selenium` or `npm ls selenium-webdriver`'],
        ['Before and after', 'flake rate, runtime, pass rate, hard waits from real runs', 'RESULTS.md'],
        ['Maintenance', 'hours per month recorded', 'issue tracker label or timesheet'],
        ['Onboarding', 'a teammate adds a passing test in ≤ 30 minutes (our bar)', 'timed exercise'],
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────── Agentic AI testing (shown as Track 1)
export const AGENTIC = {
  id: 'agentic-ai-testing',
  file: 'agentic-ai-testing.html',
  short: 'Agentic AI testing',
  card: 'For SDETs who now test systems that answer differently every run.',
  title: 'Test AI agents and LLM features',
  accent: 5,
  lead: [
    'For an SDET who can already automate UI and API tests and now has to test systems that answer differently each run.',
    'Six stages: learn how agents fail, use agents to test, build a golden dataset, wire evals into CI, test trajectories and safety, measure in production.',
    'Mirrors the golden set, eval cube and cost ledger phases of the Forward Deployed Tester process.',
  ],
  outcome: 'An eval suite in CI with a calibrated judge, a red-team suite, and cost and latency tracked per task.',
  stages: [
    {
      n: 0, title: 'Understand how agents fail', map: 'How agents fail', time: '1–2 weeks',
      goal: 'Build a tiny agent yourself so its failure modes stop being abstract.',
      steps: [
        'Build an agent with two tools, for example "search docs" and "create ticket", with any SDK.',
        'Log every model call and tool call: inputs, outputs, tokens, latency.',
        'Run the same task 10 times and compare the answers and tool sequences.',
        'Connect Playwright MCP to an assistant and complete one browser task through it.',
        'Write down real failures: wrong tool, bad arguments, loops, invented facts, giving up.',
      ],
      deliverable: 'The agent repo, a trace log, and `FAILURES.md`.',
      gates: [
        ['Tool logging', 'every call logged with arguments', 'trace file'],
        ['Variance', 'distinct outputs counted over 10 runs of one task', 'run script output'],
        ['Failure catalogue', '≥ 5 real failures, each reproducible (our bar)', 'FAILURES.md'],
        ['MCP', 'one browser task completed through Playwright MCP', 'session log'],
      ],
    },
    {
      n: 1, title: 'Use AI agents to test', map: 'Agents that test', time: '1–2 weeks',
      goal: 'Put Playwright\'s planner, generator and healer agents to work, and measure what they actually save.',
      steps: [
        'Run `npx playwright init-agents --loop=claude` (or `vscode`, `codex`, `opencode`) in a Playwright project.',
        'Write a seed test; let the planner write `specs/` and the generator write `tests/`.',
        'Review every generated locator and assertion before accepting it.',
        'Break the UI on purpose and let the healer repair; accept fixes for UI drift only.',
        'Time five tests written by hand against five generated and reviewed.',
      ],
      deliverable: '`AGENTS-TRIAL.md` with acceptance rate, stability and the time comparison.',
      gates: [
        ['Acceptance rate', 'recorded: tests accepted without edits ÷ generated', 'review log'],
        ['Stability', 'accepted tests pass 10 of 10', '`npx playwright test --repeat-each=10`'],
        ['Healer honesty', '0 heals that weakened or removed an assertion', 'diff review of each heal'],
        ['Time', 'minutes per test, by hand and by agent, for 5 tests', 'timed log'],
      ],
      agent: 'Playwright\'s docs state generated tests may start with errors for the healer to fix; this stage measures how often.',
    },
    {
      n: 2, title: 'Build the golden dataset', map: 'Golden dataset', time: '2 weeks',
      goal: 'Create the cases an AI feature is measured against: real inputs, expected behaviour, agreed by humans.',
      steps: [
        'Collect real inputs from tickets, logs and requirements; redact personal data.',
        'Stratify: common tasks, edge cases, out-of-scope requests, adversarial prompts.',
        'Write an expected outcome or a rubric per case, not an exact string.',
        'Have two people label a 30-case sample independently and compare their labels.',
        'Version the dataset like code; every production failure becomes a new case.',
      ],
      deliverable: 'Golden set in the repo (JSON or YAML) and `LABELING.md` with the rubric.',
      gates: [
        ['Size', '≥ 50 cases to start, ≥ 200 before release (our bar)', 'case count'],
        ['Coverage', 'every category ≥ 10% of cases (our bar)', 'category histogram'],
        ['Human agreement', 'Cohen\'s κ between two labellers reported', '30-case double-labelled sample'],
        ['Privacy', '0 unredacted personal data', 'redaction scan'],
        ['Growth', 'each production failure added within a week', 'dataset git log'],
      ],
    },
    {
      n: 3, title: 'Wire evals into CI', map: 'Evals in CI', time: '2 weeks',
      goal: 'Score every prompt, model or tool change against the golden set before it merges.',
      steps: [
        'Layer the checks: code evaluators first, LLM-as-judge second, humans for disagreements.',
        'Code evaluators: output schema, required tool called, arguments valid, refusal when required.',
        'Judge rubrics for correctness, groundedness and relevance, with promptfoo, DeepEval or Ragas.',
        'Calibrate the judge against the human labels before trusting its scores.',
        'Fail the pull request when any dimension drops below the last release.',
      ],
      deliverable: 'An eval job in CI and a score history per dimension.',
      gates: [
        ['Judge calibration', 'Cohen\'s κ ≥ 0.6 against human labels', 'confusion matrix on the labelled sample'],
        ['Task completion', 'rate tracked per release', 'eval report'],
        ['Tool-call accuracy', 'rate tracked per release', 'code evaluators'],
        ['Groundedness', 'rate tracked per release', 'judge or Ragas faithfulness'],
        ['Regression gate', 'a deliberately worse prompt is blocked', 'a test pull request that must fail'],
        ['Per-dimension report', 'scores shown separately, never one average', 'CI summary'],
      ],
    },
    {
      n: 4, title: 'Test trajectories and safety', map: 'Trajectories, safety', time: '2 weeks',
      goal: 'Check how the agent reached its answer, and whether it can be pushed into unsafe actions.',
      steps: [
        'Trace runs in Langfuse or Arize Phoenix; score step count, loops, retries and tool order.',
        'Allowlist the tools per task and flag any call outside it.',
        'Build ≥ 30 attacks mapped to OWASP LLM01, LLM02, LLM06 and LLM07.',
        'Include indirect injection: instructions hidden in a page or document the agent reads.',
        'Require human confirmation for irreversible tools, and test that it cannot be skipped.',
      ],
      deliverable: '`SAFETY.md` with the attack suite and its results.',
      gates: [
        ['Trajectory', 'required steps present and in order for every golden case', 'trajectory evaluator'],
        ['Loops', 'step count p95 within a written bound', 'traces'],
        ['Tool allowlist', '0 calls outside the allowlist', 'trace scan'],
        ['Attack success', '0 of ≥ 30 attacks succeed (our bar)', 'red-team run'],
        ['Confirmation', 'irreversible tools never run unconfirmed', 'targeted tests'],
      ],
    },
    {
      n: 5, title: 'Measure cost, latency and drift in production', map: 'Cost, latency, drift', time: 'ongoing',
      goal: 'Keep measuring after release, because agents change when models, prompts or inputs change.',
      steps: [
        'Record tokens and cost per task from provider usage records, not estimates.',
        'Track p95 latency per task type against the product\'s target.',
        'Score a fixed sample of live traffic with the same judge.',
        'Turn failing production traces into golden cases: collect, reproduce, fix, keep.',
        'Re-measure judge calibration every month.',
      ],
      deliverable: 'A dashboard and a monthly quality note.',
      gates: [
        ['Cost per successful task', 'reported every release', 'usage records ÷ successful tasks'],
        ['p95 latency', 'within the product target', 'tracing'],
        ['Online sampling', 'a fixed % of traffic scored', 'eval job configuration'],
        ['Feedback loop', 'production failures added as cases each month', 'dataset growth'],
        ['Judge drift', 'κ re-measured monthly and still ≥ 0.6', 'calibration run'],
      ],
      agent: 'This is the cost ledger and outcome phase of the Forward Deployed Tester process, run continuously.',
    },
  ],
};

// Order follows the job-market ask: agentic AI testing first, migration second.
export const TRACKS = [AGENTIC, MIGRATION];
