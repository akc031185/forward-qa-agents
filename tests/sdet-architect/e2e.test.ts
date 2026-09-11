import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import Fastify from 'fastify';
import { Db } from '../../src/core/db.js';
import { sdetArchitect, preview } from '../../src/agents/sdet-architect/index.js';
import { FIXTURES, REPO, read } from './helpers.js';

function runAgent(input: Record<string, unknown>) {
  const db = new Db(':memory:');
  const e = db.createEngagement({ org: 'fabricated', name: 'estate' });
  const r = db.createRun({ engagement_id: e.id, agent: 'sdet-architect', input });
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdet-e2e-'));
  const logs: string[] = [];
  const parsed = sdetArchitect.inputSchema.parse(input);
  return { db, runId: r.id, workspaceDir, logs, out: sdetArchitect.run(parsed, { db, runId: r.id, engagementId: e.id, workspaceDir, log: (m) => logs.push(m) }) };
}

test('end-to-end: fixture estate -> Playwright project, findings, artifacts, compilable output', async () => {
  const { db, runId, workspaceDir, logs, out } = runAgent({ source_dir: FIXTURES, org_slug: 'fabricated-shop' });
  const o = await out;
  assert.deepEqual(o.inventory, {
    'selenium-java': 2, 'selenium-python': 1, 'selenium-csharp': 1, 'selenium-js': 1, cypress: 0,
    'cucumber-feature': 1, 'step-definitions': 1, 'page-object': 1, 'postman-collection': 1, 'test-plan': 1, config: 2, unknown: 0,
  });
  assert.equal(o.files_scanned, 12);
  assert.ok(o.tests_found > 0);
  assert.equal(o.tests_found, o.tests_converted + o.tests_partial + o.tests_manual);
  assert.ok(typeof o.coverage_pct === 'number' && o.coverage_pct >= 0 && o.coverage_pct <= 100);
  assert.ok(o.coverage_pct >= 85, `coverage on the fixture estate should be high, got ${o.coverage_pct}`);
  assert.ok(o.locators_total > 0 && o.locators_low_confidence >= 1);
  assert.equal(o.output_dir, path.join(workspaceDir, 'playwright'));
  assert.ok(fs.existsSync(path.join(o.output_dir, 'MIGRATION.md')));
  assert.equal(fs.readFileSync(path.join(o.output_dir, 'MIGRATION.md'), 'utf8'), o.migration_report);
  const specs = fs.readdirSync(path.join(o.output_dir, 'tests')).filter((f) => f.endsWith('.spec.ts'));
  assert.ok(specs.length >= 1);
  assert.ok(fs.existsSync(path.join(o.output_dir, 'tests', 'api', 'shop-api.spec.ts')));
  assert.ok(fs.existsSync(path.join(o.output_dir, 'tests', 'steps', 'login.steps.ts')));
  assert.ok(fs.existsSync(path.join(o.output_dir, 'src', 'pages', 'Login.page.ts')));
  assert.ok(logs.some((l) => l.startsWith('[inventory]')) && logs.some((l) => l.startsWith('[generation]')));

  const findings = db.listFindings(runId);
  const cats = new Set(findings.map((f) => f.category));
  for (const c of ['locator', 'conversion', 'flakiness', 'duplication', 'quality']) assert.ok(cats.has(c), `missing finding category ${c}`);
  const artifacts = db.listArtifacts(runId);
  assert.ok(artifacts.length >= 20);
  assert.ok(artifacts.some((a) => a.kind === 'migration-report'));
  assert.ok(artifacts.every((a) => fs.existsSync(a.path)));

  // The generated project must type-check against the real Playwright types. @playwright/test is not
  // installed in this repo, but `playwright/test` ships the identical declarations, so alias it; playwright-bdd
  // is stubbed with a minimal typed declaration.
  const stubs = path.join(o.output_dir, '__stubs');
  fs.mkdirSync(stubs, { recursive: true });
  fs.writeFileSync(path.join(stubs, 'playwright-bdd.d.ts'), `declare module 'playwright-bdd' {
  import type { TestType } from '@playwright/test';
  export function defineBddConfig(config: Record<string, unknown>): string;
  type StepFn<F> = (pattern: string | RegExp, fn: (fixtures: F, ...args: string[]) => Promise<void> | void) => void;
  export function createBdd<T extends {}, W extends {}>(test: TestType<T, W>): { Given: StepFn<T & W>; When: StepFn<T & W>; Then: StepFn<T & W> };
}
`);
  fs.writeFileSync(path.join(o.output_dir, 'tsconfig.check.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
      types: ['node'], typeRoots: [path.join(REPO, 'node_modules', '@types')], baseUrl: '.',
      paths: { '@playwright/test': [path.join(REPO, 'node_modules', 'playwright', 'test')] },
    },
    include: ['playwright.config.ts', 'src/**/*.ts', 'tests/**/*.ts', '__stubs/**/*.d.ts'],
  }));
  const tsc = path.join(REPO, 'node_modules', '.bin', 'tsc');
  let output = '';
  try { output = execFileSync(tsc, ['-p', 'tsconfig.check.json'], { cwd: o.output_dir, encoding: 'utf8', timeout: 120_000 }); }
  catch (err) { const e = err as { stdout?: string; stderr?: string }; assert.fail(`generated project does not compile:\n${e.stdout ?? ''}${e.stderr ?? ''}`); }
  assert.equal(output.trim(), '');
  db.close();
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

test('dry run computes everything but writes nothing', async () => {
  const { db, runId, workspaceDir, out } = runAgent({ source_dir: FIXTURES, org_slug: 'fabricated-shop', dry_run: true, base_url: 'https://staging.shop.example.test' });
  const o = await out;
  assert.ok(o.tests_found > 0);
  assert.ok(!fs.existsSync(o.output_dir));
  assert.equal(db.listArtifacts(runId).length, 0);
  assert.ok(db.listFindings(runId).length > 0);
  assert.ok(o.migration_report.includes('DRY RUN'));
  assert.ok(o.migration_report.includes('https://staging.shop.example.test'));
  db.close();
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});

test('input validation: relative source_dir and bad slug are rejected', () => {
  assert.throws(() => sdetArchitect.inputSchema.parse({ source_dir: 'relative/path', org_slug: 'acme' }));
  assert.throws(() => sdetArchitect.inputSchema.parse({ source_dir: FIXTURES, org_slug: 'not ok' }));
  assert.equal(sdetArchitect.name, 'sdet-architect');
  assert.equal(sdetArchitect.plate, 45);
});

test('preview converts a single file in memory', () => {
  const p = preview({ language: 'java', code: read('src/test/java/com/fabricated/shop/tests/SearchTest.java') });
  assert.equal(p.kind, 'selenium-java');
  assert.equal(p.output_file, 'tests/Preview.spec.ts');
  assert.equal(p.tests_found, 3);
  assert.ok(p.spec.includes("test.describe('SearchTest', () => {"));
  assert.ok(p.spec.includes("await searchPage.searchBox.press('Enter');"));
  assert.ok(p.coverage_pct > 90);
  const auto = preview({ code: read('python/test_cart.py') });
  assert.equal(auto.kind, 'selenium-python');
  const pm = preview({ language: 'postman', code: read('postman/shop-api.postman_collection.json') });
  assert.ok(pm.spec.includes("async ({ request })"));
});

test('REST routes: preview and migration report', async () => {
  const app = Fastify();
  sdetArchitect.registerRoutes!(app);
  const res = await app.inject({ method: 'POST', url: '/agents/sdet-architect/preview', payload: { language: 'csharp', code: read('dotnet/AccountTests.cs') } });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { kind: string; spec: string };
  assert.equal(body.kind, 'selenium-csharp');
  assert.ok(body.spec.includes("selectOption({ label: 'Weekly' })"));
  const bad = await app.inject({ method: 'POST', url: '/agents/sdet-architect/preview', payload: { code: '' } });
  assert.equal(bad.statusCode, 400);
  const missing = await app.inject({ method: 'GET', url: '/agents/sdet-architect/runs/nope/migration' });
  assert.equal(missing.statusCode, 404);
  await app.close();
});
