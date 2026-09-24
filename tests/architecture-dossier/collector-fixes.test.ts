// Collector fixes found while running the dossier on a real worker repo; each is checked on
// synthetic inline input, so the fixture repo and its expected counts stay untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { namesInDockerfile } from '../../src/agents/architecture-dossier/env.js';
import { k8sKinds } from '../../src/agents/architecture-dossier/deploy.js';
import { SECURITY_HEADER_CODE } from '../../src/agents/architecture-dossier/auth.js';
import { kindOf } from '../../src/agents/architecture-dossier/testsuite.js';
import { runtimeCategory } from '../../src/agents/architecture-dossier/stack.js';
import { parseSql } from '../../src/agents/architecture-dossier/models.js';

test('Dockerfile ENV: every name in a multi-variable, multi-line ENV; values never returned', () => {
  const names = namesInDockerfile([
    'FROM node:22',
    'ARG BUILD_SHA',
    'ENV NODE_ENV=production \\',
    '    FEATURE_FLAG=1 \\',
    '    DATA_PATH=/data/app.db',
    'ENV LEGACY_STYLE some value',
    'RUN echo NOT_AN_ENV=1',
  ].join('\n'));
  assert.deepEqual(names, ['BUILD_SHA', 'NODE_ENV', 'FEATURE_FLAG', 'DATA_PATH', 'LEGACY_STYLE']);
  assert.ok(!names.some(n => /production|\/data/.test(n)));
});

test('Kubernetes kinds from manifests, multi-document aware; other YAML is not a manifest', () => {
  assert.deepEqual(k8sKinds('apiVersion: apps/v1\nkind: Deployment\n---\napiVersion: v1\nkind: Service\n'), ['Deployment', 'Service']);
  assert.deepEqual(k8sKinds('# comment\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\n'), ['Kustomization']);
  assert.deepEqual(k8sKinds('apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\n'), ['HorizontalPodAutoscaler']);
  assert.deepEqual(k8sKinds('services:\n  web:\n    image: x\n'), []);
  assert.deepEqual(k8sKinds('apiVersion: 2\nkind: Something\n'), []);
});

test('security headers: setting them counts, reading or checking them does not', () => {
  const sets = [
    "import helmet from '@fastify/helmet'",
    "res.setHeader('Content-Security-Policy', \"default-src 'self'\")",
    "{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }",
    "return new Response(body, { headers: { 'content-security-policy': \"default-src 'self'\" } })",
  ];
  for (const s of sets) assert.ok(SECURITY_HEADER_CODE.test(s), s);
  const reads = [
    "'Tools such as react-helmet write the description after load.'",
    "securityHeaders: { 'strict-transport-security': h['strict-transport-security'] }",
    "Object.entries({ 'strict-transport-security': 'HSTS', 'content-security-policy': 'CSP' })",
  ];
  for (const s of reads) assert.ok(!SECURITY_HEADER_CODE.test(s), s);
});

test('test kind: a real Playwright import is e2e, a string that mentions one is not; integration by file name', () => {
  assert.equal(kindOf('tests/login.test.ts', "import { test } from '@playwright/test';\n"), 'e2e');
  assert.equal(kindOf('tests/gen.test.ts', "import { test } from 'node:test';\nassert.ok(out.includes(\"import { test } from '@playwright/test'\"));\n"), 'unit');
  assert.equal(kindOf('tests/api/integration.test.ts', ''), 'integration');
  assert.equal(kindOf('tests/ui/responsive-integration.test.ts', ''), 'integration');
  assert.equal(kindOf('tests/integration/x.test.ts', ''), 'integration');
  assert.equal(kindOf('tests/units.test.ts', ''), 'unit');
  assert.equal(kindOf('cypress-specs/login.cy.js', "describe('x', () => { it('y', () => { cy.visit('/'); }); });"), 'e2e');
  assert.equal(kindOf('tests/parsers.test.ts', "import { test } from 'node:test';\nparse(\"cy.visit('/login');\");\n"), 'unit');
});

test('a browser library in runtime dependencies is browser automation; as a devDependency it is test tooling', () => {
  const pkg = (json: Record<string, unknown>) => ({ dir: '', file: 'package.json', json });
  assert.equal(runtimeCategory(pkg({ dependencies: { playwright: '^1' } }), 'playwright', 'test'), 'browser');
  assert.equal(runtimeCategory(pkg({ dependencies: { puppeteer: '^22' } }), 'puppeteer', 'test'), 'browser');
  assert.equal(runtimeCategory(pkg({ devDependencies: { playwright: '^1' } }), 'playwright', 'test'), 'test');
  assert.equal(runtimeCategory(pkg({ dependencies: { '@playwright/test': '^1' } }), '@playwright/test', 'test'), 'test');
});

test('SQL: an index re-declared by a later migration is listed once', () => {
  const sql = 'CREATE TABLE runs (id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL);\nCREATE INDEX IF NOT EXISTS idx_runs_eng ON runs(engagement_id);\n-- migration\nCREATE INDEX IF NOT EXISTS idx_runs_eng ON runs(engagement_id);';
  const [runs] = parseSql('db.ts', sql, 'sqlite');
  assert.equal(runs!.indexes.filter(i => i.name === 'idx_runs_eng').length, 1);
});
