// Pure parsers, on inline strings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appRouteMethods, nextPathFromSegments, pagesApiMethods, serverRoutes } from '../../src/agents/architecture-dossier/routes.js';
import { describeCron } from '../../src/agents/architecture-dossier/jobs.js';
import { parseTestOutput, countCases } from '../../src/agents/architecture-dossier/testsuite.js';
import { parseNumstat } from '../../src/agents/architecture-dossier/gitstats.js';
import { sanitizeRemote } from '../../src/agents/architecture-dossier/snapshot.js';
import { isSecretLikePath } from '../../src/agents/architecture-dossier/files.js';
import { inspectWebhook } from '../../src/agents/architecture-dossier/webhooks.js';
import { namesInCode, namesInTemplate } from '../../src/agents/architecture-dossier/env.js';
import { parseSql } from '../../src/agents/architecture-dossier/models.js';
import { workflowShape } from '../../src/agents/architecture-dossier/deploy.js';

test('Next.js paths: groups, parallel slots, dynamic, catch-all, optional catch-all, private folders', () => {
  assert.equal(nextPathFromSegments(['(shop)', 'items', '[id]']), '/items/:id');
  assert.equal(nextPathFromSegments(['docs', '[...slug]']), '/docs/*slug');
  assert.equal(nextPathFromSegments(['blog', '[[...slug]]']), '/blog/*slug?');
  assert.equal(nextPathFromSegments(['@modal', 'photo']), '/photo');
  assert.equal(nextPathFromSegments(['_components', 'x']), undefined);
  assert.equal(nextPathFromSegments([]), '/');
});

test('route handler methods in every export style', () => {
  assert.deepEqual(appRouteMethods('export async function GET() {}\nexport function DELETE() {}'), ['GET', 'DELETE']);
  assert.deepEqual(appRouteMethods('export const POST = async () => {}'), ['POST']);
  assert.deepEqual(appRouteMethods('export const { GET, POST } = handlers;'), ['GET', 'POST']);
  assert.deepEqual(appRouteMethods('export { handler as GET, handler as PUT };'), ['GET', 'PUT']);
  assert.deepEqual(appRouteMethods('export const dynamic = "force-dynamic"'), []);
  assert.deepEqual(pagesApiMethods("switch (req.method) { case 'GET': break; case 'POST': break; }"), ['GET', 'POST']);
  assert.deepEqual(pagesApiMethods('export default function h(req, res) { res.end() }'), ['ANY']);
});

test('server routes: server objects only, never HTTP clients', () => {
  const r = serverRoutes("app.get('/a', h); router.post(`/b`, h); axios.get('/api/x'); cache.get('/k'); fastify.route({ method: 'PUT', url: '/c', handler })");
  assert.deepEqual(r, [{ method: 'GET', path: '/a' }, { method: 'POST', path: '/b' }, { method: 'PUT', path: '/c' }]);
});

test('cron descriptions', () => {
  assert.equal(describeCron('*/15 * * * *'), 'every 15 minutes');
  assert.equal(describeCron('5 * * * *'), 'hourly at :05');
  assert.equal(describeCron('0 9 * * 1'), 'weekly on Monday at 09:00 UTC');
  assert.equal(describeCron('0 9 * * 1-5'), 'weekdays at 09:00 UTC');
  assert.equal(describeCron('0 0 1 * *'), 'monthly on day 1 at 00:00 UTC');
  assert.equal(describeCron('0 0 1 1 *'), '0 0 1 1 *');
});

test('test output: node:test, Jest, pytest and Playwright summaries', () => {
  assert.deepEqual(parseTestOutput('ℹ tests 163\nℹ pass 160\nℹ fail 1\nℹ skipped 2\n'), { format: 'node:test', passed: 160, failed: 1, skipped: 2, total: 163 });
  assert.deepEqual(parseTestOutput('Tests:       2 failed, 1 skipped, 40 passed, 43 total\n'), { format: 'jest', passed: 40, failed: 2, skipped: 1, total: 43 });
  assert.deepEqual(parseTestOutput('===== 12 passed, 1 failed in 3.21s =====\n'), { format: 'pytest', passed: 12, failed: 1, skipped: 0, total: 13 });
  assert.deepEqual(parseTestOutput('\n  9 passed (12.3s)\n  1 failed\n'), { format: 'playwright', passed: 9, failed: 1, skipped: 0, total: 10 });
  assert.equal(parseTestOutput('nothing here'), undefined);
  assert.equal(countCases('a.test.ts', "// it('no')\n/* test('no') */\nit('yes', () => {}); test.skip('yes', () => {}); obj.test('no');"), 2);
});

test('numstat aggregation: renames, binary files, recency windows', () => {
  const out = '@2026-09-20T10:00:00Z\n3\t1\tsrc/app/a.ts\n-\t-\tpublic/logo.png\n\n@2026-01-01T10:00:00Z\n5\t0\tsrc/{old => new}/b.ts\n';
  const r = parseNumstat(out, '2026-09-24T00:00:00Z');
  assert.equal(r.commits_last_30d, 1);
  assert.equal(r.commits_last_90d, 1);
  assert.deepEqual(r.churn.find(c => c.folder === 'src/new'), { folder: 'src/new', commits: 1, added: 5, deleted: 0 });
  assert.deepEqual(r.churn.find(c => c.folder === 'public'), { folder: 'public', commits: 1, added: 0, deleted: 0 });
  assert.deepEqual(r.by_month, [{ month: '2026-01', commits: 1 }, { month: '2026-09', commits: 1 }]);
});

test('remote URLs lose credentials', () => {
  assert.equal(sanitizeRemote('https://user:tok123@github.com/acme/app.git'), 'github.com/acme/app');
  assert.equal(sanitizeRemote('git@github.com:acme/app.git'), 'github.com/acme/app');
  assert.equal(sanitizeRemote('/local/path'), undefined);
});

test('secret-like paths', () => {
  for (const p of ['.env', 'apps/web/.env.local', '.env.production', 'prod.env', 'certs/key.pem', 'tls.key', 'credentials.json', 'service-account-prod.json', '.npmrc', 'id_ed25519']) assert.ok(isSecretLikePath(p), p);
  for (const p of ['.env.example', 'apps/web/.env.local.example', '.env.sample', '.env.template', 'env.ts', 'src/environment.ts', 'keys.ts']) assert.ok(!isSecretLikePath(p), p);
});

test('webhook verification needs a real check, not just a header read', () => {
  assert.equal(inspectWebhook("const s = req.headers.get('stripe-signature'); await req.json();").verified, false);
  assert.equal(inspectWebhook('stripe.webhooks.constructEvent(body, sig, secret)').verified, true);
  assert.equal(inspectWebhook("const d = crypto.createHmac('sha256', k).update(b).digest('hex'); crypto.timingSafeEqual(a, b)").verified, true);
  assert.equal(inspectWebhook("crypto.createHmac('sha256', k)").verified, false);
});

test('env names from code and templates; template values never returned', () => {
  assert.deepEqual(namesInCode("process.env.A_B; process.env['C']; import.meta.env.VITE_X; const { D, E: e } = process.env;").sort(), ['A_B', 'C', 'D', 'E', 'VITE_X']);
  const names = namesInTemplate('# c\nexport FOO=bar\nBAZ = "secret-value"\n  QUX=\nnot a line\n');
  assert.deepEqual(names, ['FOO', 'BAZ', 'QUX']);
  assert.ok(!JSON.stringify(names).includes('secret-value'));
});

test('SQL tables: composite keys, references, checks', () => {
  const [t] = parseSql('x.sql', 'CREATE TABLE IF NOT EXISTS runs (\n id TEXT NOT NULL,\n eng TEXT REFERENCES engagements(id),\n s TEXT CHECK (s IN (\'a\',\'b\')),\n PRIMARY KEY (id, eng)\n);', 'sqlite');
  assert.deepEqual(t!.fields.map(f => f.name), ['id', 'eng', 's']);
  assert.equal(t!.fields[1]!.ref, 'engagements');
  assert.deepEqual(t!.fields[2]!.enum, ['a', 'b']);
  assert.deepEqual(t!.indexes[0], { fields: ['id', 'eng'], unique: true, name: 'primary key' });
});

test('workflow shape: inline and block triggers', () => {
  assert.deepEqual(workflowShape('name: X\non: [push, pull_request]\njobs:\n  a:\n    runs-on: x\n  b:\n    runs-on: y\n'), { name: 'X', triggers: ['push', 'pull_request'], jobs: ['a', 'b'] });
  assert.deepEqual(workflowShape('on:\n  schedule:\n    - cron: "0 0 * * *"\njobs:\n  c:\n').triggers, ['schedule']);
});
