// Collector: tests. Test files and test cases counted by static parse (no test is run), the
// frameworks in use, and, when the owner supplies the output of a real run, its pass/fail totals.
import { RepoFiles, depsOf, isTestPath, readPackages } from './files.js';

export type TestKind = 'unit' | 'integration' | 'e2e';
export interface TestFile { path: string; cases: number; kind: TestKind }
export interface IngestedRun { file_name: string; format: string; passed: number; failed: number; skipped: number; total: number }
export interface TestsResult {
  files: TestFile[]; total_files: number; total_cases: number;
  by_kind: Record<TestKind, { files: number; cases: number }>;
  frameworks: string[]; config_files: string[]; ingested?: IngestedRun;
}

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.(py|go)$/;

export function countCases(rel: string, src: string): number {
  if (rel.endsWith('.py')) return (src.match(/^\s*(?:async\s+)?def\s+test_\w+\s*\(/gm) ?? []).length;
  if (rel.endsWith('.go')) return (src.match(/^func\s+Test\w+\s*\(/gm) ?? []).length;
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return (noComments.match(/(?:^|[^\w.$])(?:it|test)(?:\.(?:only|skip|todo|concurrent|fails|serial))?\s*\(\s*['"`]/g) ?? []).length
    + (noComments.match(/(?:^|[^\w.$])(?:it|test)\.each\s*[(`]/g) ?? []).length;
}

// Import detection is anchored to a real import line, so a test that merely asserts on generated
// Playwright code (the string "from '@playwright/test'" inside a literal) stays a unit test; and a
// file that imports a unit runner (node:test, Vitest, Jest globals) is never a Cypress spec, even
// when it feeds `cy.visit(...)` to a parser as a string.
const UNIT_RUNNER_IMPORT = /^\s*import\b[^\n]*\bfrom\s+['"](?:node:test|vitest|@jest\/globals)['"]/m;
export const kindOf = (rel: string, src: string): TestKind =>
  /(^|\/)(e2e|playwright|cypress)\/|\.e2e\./.test(rel)
    || /^\s*import\b[^\n]*\bfrom\s+['"]@playwright\/test['"]|^\s*(?:const|let|var)\b[^\n]*require\(\s*['"]@playwright\/test['"]/m.test(src)
    || (/\bcy\.visit\(/.test(src) && !UNIT_RUNNER_IMPORT.test(src)) ? 'e2e'
    : /(^|\/)integration\/|(^|\/|[.-])int(egration)?\.(test|spec)\./.test(rel) ? 'integration' : 'unit';

const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

/** Pass / fail totals from the saved output of node:test, Vitest, Jest, Playwright or pytest. */
export function parseTestOutput(text: string): Omit<IngestedRun, 'file_name'> | undefined {
  const t = strip(text);
  const n = (re: RegExp) => { const m = re.exec(t); return m ? Number(m[1]) : undefined; };
  const nodePass = n(/^(?:#|ℹ)\s*pass\s+(\d+)/m);
  if (nodePass !== undefined) {
    const failed = n(/^(?:#|ℹ)\s*fail\s+(\d+)/m) ?? 0; const skipped = (n(/^(?:#|ℹ)\s*skipped\s+(\d+)/m) ?? 0) + (n(/^(?:#|ℹ)\s*todo\s+(\d+)/m) ?? 0);
    return { format: 'node:test', passed: nodePass, failed, skipped, total: n(/^(?:#|ℹ)\s*tests\s+(\d+)/m) ?? nodePass + failed + skipped };
  }
  const vi = /^\s*Tests\s+(.*)\((\d+)\)\s*$/m.exec(t);
  if (vi) {
    const part = (w: string) => Number(new RegExp(`(\\d+)\\s+${w}`).exec(vi[1]!)?.[1] ?? 0);
    return { format: 'vitest', passed: part('passed'), failed: part('failed'), skipped: part('skipped') + part('todo'), total: Number(vi[2]) };
  }
  const jest = /^Tests:\s+(.*?(\d+)\s+total)/m.exec(t);
  if (jest) {
    const part = (w: string) => Number(new RegExp(`(\\d+)\\s+${w}`).exec(jest[1]!)?.[1] ?? 0);
    return { format: 'jest', passed: part('passed'), failed: part('failed'), skipped: part('skipped') + part('todo'), total: Number(jest[2]) };
  }
  const py = /^=+ (.*?(?:passed|failed).*?) in [\d.]+s/m.exec(t);
  if (py) {
    const part = (w: string) => Number(new RegExp(`(\\d+)\\s+${w}`).exec(py[1]!)?.[1] ?? 0);
    const r = { passed: part('passed'), failed: part('failed') + part('error'), skipped: part('skipped') };
    return { format: 'pytest', ...r, total: r.passed + r.failed + r.skipped };
  }
  const pwPass = n(/^\s*(\d+)\s+passed\b/m);
  if (pwPass !== undefined) {
    const failed = n(/^\s*(\d+)\s+failed\b/m) ?? 0; const skipped = n(/^\s*(\d+)\s+skipped\b/m) ?? 0;
    return { format: 'playwright', passed: pwPass, failed, skipped, total: pwPass + failed + skipped };
  }
  return undefined;
}

export function collectTests(repo: RepoFiles, testOutput?: { name: string; text: string }): TestsResult {
  const files: TestFile[] = repo.files.filter(f => TEST_FILE.test(f) || (isTestPath(f) && /\.[cm]?[jt]sx?$/.test(f) && /\b(describe|it|test)\s*\(/.test(repo.text(f) ?? '')))
    .filter(f => !/(^|\/)(fixtures?|__fixtures__|__mocks__)\//.test(f))
    .map(f => ({ path: f, cases: countCases(f, repo.text(f) ?? ''), kind: kindOf(f, repo.text(f) ?? '') }));
  const by_kind: TestsResult['by_kind'] = { unit: { files: 0, cases: 0 }, integration: { files: 0, cases: 0 }, e2e: { files: 0, cases: 0 } };
  for (const f of files) { by_kind[f.kind].files++; by_kind[f.kind].cases += f.cases; }
  const deps = new Set(readPackages(repo).flatMap(p => Object.keys(depsOf(p))));
  const frameworks = [['vitest', 'Vitest'], ['jest', 'Jest'], ['@playwright/test', 'Playwright Test'], ['mocha', 'Mocha'], ['cypress', 'Cypress'], ['ava', 'AVA'], ['supertest', 'supertest']]
    .filter(([p]) => deps.has(p!)).map(([, l]) => l!);
  if (files.some(f => /from\s+['"]node:test['"]/.test(repo.text(f.path) ?? ''))) frameworks.push('node:test');
  if (files.some(f => f.path.endsWith('.py'))) frameworks.push('pytest');
  let ingested: IngestedRun | undefined;
  if (testOutput) { const p = parseTestOutput(testOutput.text); if (p) ingested = { file_name: testOutput.name, ...p }; }
  return {
    files, total_files: files.length, total_cases: files.reduce((n, f) => n + f.cases, 0), by_kind, frameworks,
    config_files: repo.files.filter(f => /(^|\/)(vitest|jest|playwright|cypress)\.config\.[cm]?[jt]s$|(^|\/)pytest\.ini$/.test(f)),
    ingested,
  };
}
