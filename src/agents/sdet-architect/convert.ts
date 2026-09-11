// Pure conversion pipeline over in-memory file contents: parse -> plan -> generate.
// index.ts wraps this with disk/DB/LLM; the preview route calls it directly.
import type { InventoryEntry } from './inventory.js';
import { classifyFile } from './inventory.js';
import type { FileKind, Locator, Step, TestSuite } from './model.js';
import { parseSeleniumJava } from './parsers/selenium-java.js';
import { parseSeleniumPython } from './parsers/selenium-python.js';
import { parseSeleniumCSharp } from './parsers/selenium-csharp.js';
import { parseSeleniumJs } from './parsers/selenium-js.js';
import { parseFeature } from './parsers/cucumber.js';
import { parsePostman } from './parsers/postman.js';
import { parseTestPlan, genSpec, specFileName } from './generators/spec.js';
import { buildPlan, isUiSuite, stdOf, type Plan } from './generators/plan.js';
import { genFixtures, genPageClass } from './generators/pages.js';
import { featureBaseName, genStepDefinitions } from './generators/bdd.js';
import { apiSpecFileName, genApiSpec } from './generators/api.js';
import { genGitignore, genMcpJson, genMcpServerConfig, genPackageJson, genPlaywrightConfig, genTsconfig, genWorkflow } from './generators/project.js';
import { LOW_CONFIDENCE, locatorKey } from './locators.js';
import type { ConversionStatus } from './generators/steps.js';
import type { FileStatus, TodoItem } from './report.js';

export function parseOne(rel: string, content: string, kind: FileKind = classifyFile(rel, content)): TestSuite | undefined {
  const ext = rel.replace(/^.*\./, '').toLowerCase();
  switch (kind) {
    case 'cucumber-feature': return parseFeature(content, rel);
    case 'postman-collection': return parsePostman(content, rel);
    case 'test-plan': return ext === 'md' ? parseTestPlan(content, rel) : undefined;
    case 'selenium-java': case 'selenium-python': case 'selenium-csharp': case 'selenium-js': case 'cypress': case 'step-definitions': case 'page-object':
      if (ext === 'java') return parseSeleniumJava(content, rel, kind);
      if (ext === 'py') return parseSeleniumPython(content, rel, kind);
      if (ext === 'cs') return parseSeleniumCSharp(content, rel, kind);
      if (/^(js|mjs|cjs|ts|mts|jsx|tsx)$/.test(ext)) return parseSeleniumJs(content, rel, kind);
      return undefined;
    default: return undefined;
  }
}

export function parseEstate(entries: InventoryEntry[], contents: Map<string, string>): TestSuite[] {
  const suites: TestSuite[] = [];
  for (const e of entries) {
    const c = contents.get(e.path);
    if (c === undefined) continue;
    try { const s = parseOne(e.path, c, e.kind); if (s) suites.push(s); } catch { /* a parser crash must never sink the run; the file stays 'manual' */ }
  }
  return suites;
}

/** Most common origin among navigated URLs; falls back to the provided default. */
export function detectBaseUrl(suites: TestSuite[], fallback = 'http://localhost:3000'): string {
  const counts = new Map<string, number>();
  for (const s of suites) for (const u of s.urls) {
    try { const o = new URL(u).origin; counts.set(o, (counts.get(o) ?? 0) + 1); } catch { /* not a url */ }
  }
  const best = [...counts.entries()].filter(([o]) => !/^https?:\/\/api\./.test(o)).sort((a, b) => b[1] - a[1])[0] ?? [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? fallback;
}

export interface GenerateOptions { orgSlug: string; baseUrl?: string; hints?: Map<Step, string> }
export interface LowLocator { file: string; line: number; strategy: string; value: string; expr: string; confidence: number; note?: string }
export interface GenerateOutput {
  files: Map<string, string>;
  plan: Plan;
  baseUrl: string;
  fileStatuses: FileStatus[];
  todos: TodoItem[];
  flaky: { file: string; line: number; raw: string }[];
  noAssertion: { file: string; test: string }[];
  duplicates: { key: string; strategy: string; value: string; files: string[] }[];
  lowLocators: LowLocator[];
  uniqueLocators: number;
  histogram: Record<string, number>;
  byStrategy: Record<string, number>;
  totals: { tests: number; converted: number; partial: number; manual: number; steps: number; stepsConverted: number; coveragePct: number };
}

export function generateEstate(suites: TestSuite[], opts: GenerateOptions): GenerateOutput {
  const baseUrl = opts.baseUrl ?? detectBaseUrl(suites);
  const plan = buildPlan(suites);
  const files = new Map<string, string>();
  const fileStatuses: FileStatus[] = [];
  const todos: TodoItem[] = [];
  const flaky: GenerateOutput['flaky'] = [];
  const noAssertion: GenerateOutput['noAssertion'] = [];
  const totals = { tests: 0, converted: 0, partial: 0, manual: 0, steps: 0, stepsConverted: 0, coveragePct: 0 };
  const tally = (statuses: { status: ConversionStatus; total: number; todos: number }[]) => {
    const c = { converted: 0, partial: 0, manual: 0 };
    for (const s of statuses) { c[s.status]++; totals.steps += s.total; totals.stepsConverted += s.total - s.todos; }
    totals.tests += statuses.length; totals.converted += c.converted; totals.partial += c.partial; totals.manual += c.manual;
    return c;
  };
  const overall = (c: { converted: number; partial: number; manual: number }, n: number): FileStatus['status'] => n === 0 ? 'n/a' : c.converted === n ? 'converted' : c.manual === n ? 'manual' : 'partial';

  // page objects (detected + synthetic)
  for (const p of plan.pages) {
    const r = genPageClass(p, plan, baseUrl);
    files.set(p.file, r.code);
    todos.push(...r.todos); flaky.push(...r.flaky);
    if (!p.synthetic) {
      const c = tally(r.statuses);
      fileStatuses.push({ source: p.sourceFile, kind: 'page-object', output: p.file, status: overall(c, r.statuses.length), tests: r.statuses.length, ...c });
    }
  }
  if (plan.pages.length) files.set('src/fixtures/index.ts', genFixtures(plan.pages));

  // UI specs and test plans
  let hasUi = false;
  for (const s of suites) {
    if (!(isUiSuite(s) || s.kind === 'test-plan')) continue;
    hasUi = hasUi || isUiSuite(s);
    const r = genSpec(s, plan, baseUrl, opts.hints);
    const out = specFileName(s);
    files.set(out, r.code);
    todos.push(...r.todos); flaky.push(...r.flaky);
    for (const t of r.noAssertion) noAssertion.push({ file: s.source, test: t });
    const c = tally(r.tests);
    fileStatuses.push({ source: s.source, kind: s.kind, output: out, status: overall(c, r.tests.length), tests: r.tests.length, ...c });
  }

  // cucumber
  const featureSuites = suites.filter((s) => s.kind === 'cucumber-feature');
  const defSuites = suites.filter((s) => s.stepDefinitions?.length);
  for (const f of featureSuites) {
    const base = featureBaseName(f);
    files.set(`tests/features/${base}.feature`, f.feature ? reconstructFeature(f) : '');
    const r = genStepDefinitions(f, defSuites, plan, baseUrl);
    files.set(`tests/steps/${base}.steps.ts`, r.code);
    todos.push(...r.todos); flaky.push(...r.flaky);
    const c = tally(r.scenarios);
    fileStatuses.push({ source: f.source, kind: 'cucumber-feature', output: `tests/features/${base}.feature + tests/steps/${base}.steps.ts`, status: overall(c, r.scenarios.length), tests: r.scenarios.length, ...c });
  }
  for (const d of defSuites) fileStatuses.push({ source: d.source, kind: 'step-definitions', output: featureSuites.length ? 'tests/steps/*.steps.ts' : '(no feature file references these definitions)', status: 'kept', tests: d.stepDefinitions!.length, converted: 0, partial: 0, manual: 0 });

  // postman
  const apiSuites = suites.filter((s) => s.kind === 'postman-collection');
  for (const a of apiSuites) {
    const r = genApiSpec(a);
    const out = apiSpecFileName(a);
    files.set(out, r.code);
    todos.push(...r.todos);
    for (const t of r.noAssertion) noAssertion.push({ file: a.source, test: t });
    const c = tally(r.tests);
    fileStatuses.push({ source: a.source, kind: 'postman-collection', output: out, status: overall(c, r.tests.length), tests: r.tests.length, ...c });
  }

  // locator stats
  const seen = new Map<string, { loc: Locator; files: Set<string> }>();
  for (const s of suites) for (const l of s.locators) {
    const k = locatorKey(l);
    const e = seen.get(k) ?? { loc: l, files: new Set<string>() };
    e.files.add(l.source.file); seen.set(k, e);
  }
  const histogram: Record<string, number> = { '0.90-1.00': 0, '0.80-0.89': 0, '0.60-0.79': 0, '0.40-0.59': 0, '0.00-0.39': 0 };
  const byStrategy: Record<string, number> = {};
  const lowLocators: LowLocator[] = [];
  for (const { loc } of seen.values()) {
    const std = stdOf(plan, loc);
    byStrategy[loc.strategy] = (byStrategy[loc.strategy] ?? 0) + 1;
    const c = std.confidence;
    histogram[c >= 0.9 ? '0.90-1.00' : c >= 0.8 ? '0.80-0.89' : c >= 0.6 ? '0.60-0.79' : c >= 0.4 ? '0.40-0.59' : '0.00-0.39']++;
    if (c < LOW_CONFIDENCE) lowLocators.push({ file: loc.source.file, line: loc.source.line, strategy: loc.strategy, value: loc.value, expr: std.expr, confidence: c, note: std.note });
  }
  const duplicates = [...seen.entries()].filter(([, e]) => e.files.size > 1).map(([key, e]) => ({ key, strategy: e.loc.strategy, value: e.loc.value, files: [...e.files].sort() }));

  // project scaffolding
  const po = { orgSlug: opts.orgSlug, baseUrl, hasBdd: featureSuites.length > 0, hasApi: apiSuites.length > 0, hasUi: hasUi || plan.pages.length > 0, testIdAttribute: plan.stdOptions.testIdAttribute };
  files.set('package.json', genPackageJson(po));
  files.set('playwright.config.ts', genPlaywrightConfig(po));
  files.set('.mcp.json', genMcpJson());
  files.set('playwright-mcp.config.json', genMcpServerConfig(po));
  files.set('tsconfig.json', genTsconfig());
  files.set('.gitignore', genGitignore());
  files.set('.github/workflows/playwright.yml', genWorkflow(po));

  totals.coveragePct = totals.steps ? Math.round((totals.stepsConverted / totals.steps) * 1000) / 10 : 0;
  return { files, plan, baseUrl, fileStatuses, todos, flaky, noAssertion, duplicates, lowLocators, uniqueLocators: seen.size, histogram, byStrategy, totals };
}

/** The .feature is kept verbatim when we have the original text; the parser keeps enough to rebuild otherwise. */
function reconstructFeature(s: TestSuite): string {
  const f = s.feature!;
  const L: string[] = [];
  if (f.tags.length) L.push(f.tags.join(' '));
  L.push(`Feature: ${f.name}`);
  if (f.background.length) { L.push('', '  Background:'); for (const st of f.background) L.push(`    ${st.keyword} ${st.text}`); }
  for (const sc of f.scenarios) {
    L.push('');
    if (sc.tags.length) L.push(`  ${sc.tags.join(' ')}`);
    L.push(`  ${sc.outline ? 'Scenario Outline' : 'Scenario'}: ${sc.name}`);
    for (const st of sc.steps) L.push(`    ${st.keyword} ${st.text}`);
    if (sc.examples) {
      L.push('', '    Examples:');
      L.push(`      | ${sc.examples.headers.join(' | ')} |`);
      for (const r of sc.examples.rows) L.push(`      | ${r.join(' | ')} |`);
    }
  }
  return L.join('\n') + '\n';
}

/** Collect every `unknown` step across suites (for optional model assistance). */
export function unknownSteps(suites: TestSuite[]): { step: Step; file: string }[] {
  const out: { step: Step; file: string }[] = [];
  for (const s of suites) {
    if (s.kind === 'cucumber-feature' || s.kind === 'test-plan' || s.kind === 'postman-collection') continue;
    const bodies = [...s.tests.map((t) => t.steps), ...s.hooks.map((h) => h.steps), ...s.pageObjects.flatMap((p) => p.methods.map((m) => m.steps)), ...(s.stepDefinitions ?? []).map((d) => d.steps)];
    for (const steps of bodies) for (const st of steps) if (st.kind === 'unknown') out.push({ step: st, file: s.source });
  }
  return out;
}
