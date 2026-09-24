// Every collector against the synthetic fixture repository, read through a HEAD snapshot.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeFixtureRepo } from './helpers.js';
import { snapshotHead, type Snapshot } from '../../src/agents/architecture-dossier/snapshot.js';
import { RepoFiles } from '../../src/agents/architecture-dossier/files.js';
import { ImportGraph } from '../../src/agents/architecture-dossier/imports.js';
import { collectStack } from '../../src/agents/architecture-dossier/stack.js';
import { collectRoutes, type RoutesResult } from '../../src/agents/architecture-dossier/routes.js';
import { collectModels } from '../../src/agents/architecture-dossier/models.js';
import { collectIntegrations } from '../../src/agents/architecture-dossier/integrations.js';
import { collectWebhooks } from '../../src/agents/architecture-dossier/webhooks.js';
import { collectAuth } from '../../src/agents/architecture-dossier/auth.js';
import { collectEnv } from '../../src/agents/architecture-dossier/env.js';
import { collectJobs } from '../../src/agents/architecture-dossier/jobs.js';
import { collectDeploy } from '../../src/agents/architecture-dossier/deploy.js';
import { collectTests } from '../../src/agents/architecture-dossier/testsuite.js';
import { collectDocs } from '../../src/agents/architecture-dossier/docs.js';
import { collectGitStats } from '../../src/agents/architecture-dossier/gitstats.js';
import { collectSize } from '../../src/agents/architecture-dossier/size.js';
import { buildGraph } from '../../src/agents/architecture-dossier/graph.js';

let fx: ReturnType<typeof makeFixtureRepo>; let snap: Snapshot; let repo: RepoFiles; let routes: RoutesResult;

before(() => {
  fx = makeFixtureRepo();
  snap = snapshotHead(fx.dir);
  repo = new RepoFiles(snap.dir);
  routes = collectRoutes(repo);
});
after(() => { snap.cleanup(); fx.cleanup(); });

const find = (p: string, service = '') => routes.routes.find(r => r.path === p && r.service === service);

test('snapshot: committed HEAD only, secret-like files removed unread, provenance recorded', () => {
  assert.match(snap.commit, /^[0-9a-f]{40}$/);
  assert.equal(snap.branch, 'main');
  assert.deepEqual(snap.secret_like_committed, ['.env', 'certs/dev.pem']);
  assert.ok(!repo.files.includes('.env') && !repo.files.includes('.env.local'));
  assert.ok(!repo.files.some(f => f.includes('uncommitted')), 'working-tree-only file is not in the snapshot');
  assert.ok(repo.files.includes('.env.example'), 'the template is kept (names only)');
});

test('stack: frameworks with declared and lockfile versions, Next.js router shape, runtime pins', () => {
  const s = collectStack(repo);
  const next = s.frameworks.find(f => f.package === 'next')!;
  assert.equal(next.version, '^14.2.3');
  assert.equal(next.resolved, '14.2.3');
  assert.deepEqual(s.frameworks.find(f => f.package === 'fastify')!.where, ['worker']);
  assert.ok(s.frameworks.some(f => f.package === 'better-sqlite3'));
  assert.equal(s.package_manager, 'npm');
  assert.deepEqual(s.next, [{ root: '.', pages_router: true, app_router: true }]);
  assert.ok(s.runtime_pins.some(p => p.value === 'node:22-slim'));
  assert.ok(s.runtime_pins.some(p => p.value === 'node >=20'));
  assert.equal(s.packages.length, 2);
  assert.deepEqual(s.packages[0]!.script_names, ['build', 'dev', 'e2e', 'start', 'test']);
});

test('routes: app router handlers with methods, route groups, pages router API, Fastify routes', () => {
  assert.deepEqual(find('/api/contacts')!.methods, ['GET', 'POST']);
  assert.deepEqual(find('/api/contacts/:id')!.methods, ['GET', 'PATCH', 'DELETE']);
  assert.deepEqual(find('/api/auth/*nextauth')!.methods, ['GET', 'POST'], 'export const { GET, POST } = handlers');
  assert.deepEqual(find('/api/export')!.methods, ['GET'], 'export const GET = async () => …');
  assert.equal(find('/pricing')!.kind, 'page', '(marketing) route group dropped from the path');
  assert.equal(find('/dashboard/:workspaceId')!.framework, 'next-app');
  const legacy = find('/api/legacy/upload')!;
  assert.equal(legacy.framework, 'next-pages');
  assert.deepEqual(legacy.methods, ['POST']);
  assert.equal(find('/about')!.framework, 'next-pages');
  assert.deepEqual(find('/jobs/:id', 'worker')!.methods, ['GET', 'DELETE'], 'app.route({ method: [..], url })');
  assert.equal(find('/health', 'worker')!.framework, 'fastify');
  assert.equal(find('/api/contacts')!.group, '/api/contacts');
  assert.deepEqual(routes.services.map(s => s.name), ['harbor-ledger', 'harbor-worker']);
});

test('routes: per-route signals and middleware matcher coverage', () => {
  const c = find('/api/contacts')!.signals;
  assert.ok(c.auth && c.rate_limit && c.validation && c.tenant && c.middleware_auth);
  assert.equal(find('/api/export')!.signals.auth, false);
  assert.equal(find('/api/export')!.signals.middleware_auth, false, 'matcher does not cover /api/export');
  assert.equal(find('/dashboard/:workspaceId')!.signals.middleware_auth, true);
  assert.deepEqual(routes.middleware[0]!.matchers, ['/dashboard/:path*', '/api/contacts/:path*']);
});

test('data models: Mongoose collections, fields, refs, enums and indexes; SQLite tables and indexes', () => {
  const { models, stores } = collectModels(repo);
  assert.deepEqual(stores.map(s => s.kind).sort(), ['mongodb', 'sqlite']);
  const contact = models.find(m => m.name === 'Contact')!;
  assert.equal(contact.collection, 'contacts');
  assert.equal(contact.collection_source, 'inferred');
  assert.equal(contact.timestamps, true);
  const ws = contact.fields.find(f => f.name === 'workspaceId')!;
  assert.deepEqual({ type: ws.type, ref: ws.ref, required: ws.required, index: ws.index }, { type: 'ObjectId', ref: 'Workspace', required: true, index: true });
  assert.equal(contact.fields.find(f => f.name === 'tags')!.type, '[String]');
  assert.deepEqual(contact.fields.find(f => f.name === 'stage')!.enum, ['new', 'contacted', 'won']);
  assert.ok(contact.indexes.some(i => i.unique && i.fields.join() === 'workspaceId,email'));
  const workspace = models.find(m => m.name === 'Workspace')!;
  assert.equal(workspace.collection, 'tenants');
  assert.equal(workspace.collection_source, 'explicit');
  assert.deepEqual(models.find(m => m.name === 'User')!.fields.find(f => f.name === 'role')!.enum, ['owner', 'admin', 'member']);
  const jobs = models.find(m => m.name === 'jobs')!;
  assert.equal(jobs.store, 'sqlite');
  assert.deepEqual(jobs.fields.map(f => f.name), ['id', 'kind', 'status', 'payload', 'created_at']);
  assert.deepEqual(jobs.fields.find(f => f.name === 'kind')!.enum, ['export', 'digest']);
  assert.ok(jobs.indexes.some(i => i.name === 'idx_jobs_status' && i.fields[0] === 'status'));
});

test('integrations: SDK imports and API hosts, env names by vendor prefix, unknown hosts listed', () => {
  const env = collectEnv(repo);
  const r = collectIntegrations(repo, env.vars.map(v => v.name));
  assert.deepEqual(r.integrations.map(i => i.id), ['stripe', 'resend', 'twilio', 'openai', 'anthropic', 'ghl', 'vercel-blob', 'upstash']);
  const ghl = r.integrations.find(i => i.id === 'ghl')!;
  assert.deepEqual(ghl.hosts, ['services.leadconnectorhq.com']);
  assert.deepEqual(ghl.env, ['GHL_API_KEY']);
  assert.deepEqual(r.integrations.find(i => i.id === 'stripe')!.env, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
  assert.deepEqual(r.other_hosts.map(h => h.host), ['rates.harbor-fixture.dev']);
  assert.ok(!JSON.stringify(r).includes('/v1/latest'), 'only host names are kept from URLs');
});

test('webhooks: which inbound endpoints verify signatures', () => {
  const w = collectWebhooks(repo, routes.routes, new ImportGraph(repo));
  const stripe = w.find(x => x.path === '/api/webhooks/stripe')!;
  const twilio = w.find(x => x.path === '/api/webhooks/twilio')!;
  assert.equal(stripe.verified, true);
  assert.ok(stripe.verification.includes('Stripe constructEvent'));
  assert.equal(stripe.raw_body, true);
  assert.equal(stripe.idempotency, true);
  assert.equal(twilio.verified, false);
  assert.equal(twilio.vendor, 'twilio');
  assert.equal(w.length, 2);
});

test('auth: NextAuth providers, strategy, adapter, hashing, roles, posture signals, unguarded routes', () => {
  const a = collectAuth(repo, routes.routes, routes.middleware);
  assert.deepEqual(a.libraries, ['NextAuth / Auth.js']);
  assert.deepEqual(a.nextauth, { config_files: ['src/auth.ts'], providers: ['Credentials', 'Google'], session_strategy: 'jwt', adapter: 'MongoDBAdapter' });
  assert.deepEqual(a.password_hashing, ['bcryptjs']);
  assert.deepEqual(a.roles, ['admin', 'member', 'owner'], 'chat-completion roles are not user roles');
  assert.deepEqual(a.unguarded_api_routes, ['POST /api/ai/summarize', 'GET /api/export']);
  const sig = Object.fromEntries(a.signals.map(s => [s.id, s.present]));
  assert.equal(sig['rate-limit'], true);
  assert.equal(sig['security-headers'], true, 'X-Frame-Options in vercel.json');
  assert.equal(sig['tenant-scoping'], true);
  assert.equal(sig['encryption'], false);
});

test('env: names from code, the example file, CI and Docker; undocumented and unused lists', () => {
  const e = collectEnv(repo);
  const names = e.vars.map(v => v.name);
  for (const n of ['MONGODB_URI', 'STRIPE_SECRET_KEY', 'GHL_API_KEY', 'CRON_SECRET', 'WORKER_TOKEN', 'AUTH_GOOGLE_ID']) assert.ok(names.includes(n), n);
  assert.ok(!names.includes('NODE_ENV'));
  assert.ok(!names.includes('WT_ONLY') && !names.includes('UNCOMMITTED_ONLY_VAR'), 'working tree is not read');
  assert.deepEqual(e.vars.find(v => v.name === 'CRON_SECRET')!.sources, ['code', 'ci']);
  assert.equal(e.vars.find(v => v.name === 'NEXT_PUBLIC_APP_URL')!.kind, 'public');
  assert.equal(e.vars.find(v => v.name === 'STRIPE_SECRET_KEY')!.kind, 'secret');
  assert.deepEqual(e.example_files, ['.env.example']);
  assert.ok(e.undocumented.includes('GHL_API_KEY') && !e.undocumented.includes('MONGODB_URI'));
  assert.deepEqual(e.unused_examples, ['NEXT_PUBLIC_APP_URL', 'UNUSED_LEGACY_FLAG']);
});

test('jobs: Vercel crons, scheduled workflows and the cron routes they call', () => {
  const j = collectJobs(repo, routes.routes);
  assert.deepEqual(j.vercel_crons.map(c => [c.path, c.describe]), [['/api/cron/digest', 'daily at 08:00 UTC']]);
  assert.equal(j.workflow_schedules[0]!.cron[0]!.describe, 'daily at 03:30 UTC');
  assert.deepEqual(j.workflow_schedules[0]!.calls_paths, ['/api/cron/digest']);
  assert.equal(j.cron_routes[0]!.secret_check, true);
  assert.equal(j.cron_routes[0]!.scheduled_by.length, 2);
});

test('deploy: Vercel, Railway, Dockerfile and CI workflows', () => {
  const d = collectDeploy(repo);
  assert.deepEqual(d.targets.map(t => t.platform).sort(), ['Railway', 'Vercel']);
  const rw = d.targets.find(t => t.platform === 'Railway')!;
  assert.equal(rw.detail['deploy.healthcheckPath'], '/health');
  assert.equal(d.targets.find(t => t.platform === 'Vercel')!.detail.crons, 1);
  assert.deepEqual(d.docker[0]!.base_images, ['node:22-slim']);
  assert.equal(d.docker[0]!.user, undefined);
  const ci = d.workflows.find(w => w.name === 'CI')!;
  assert.deepEqual(ci.triggers, ['push', 'pull_request']);
  assert.deepEqual(ci.jobs, ['test']);
  assert.deepEqual(d.workflows.find(w => w.name === 'Nightly digest')!.triggers, ['schedule', 'workflow_dispatch']);
});

test('tests: files and cases by static parse, kinds, frameworks, ingested run output', () => {
  const t = collectTests(repo, { name: 'out.txt', text: '\u001b[2m RUN \u001b[22m\n      Tests  5 passed | 1 skipped (6)\n' });
  assert.equal(t.total_files, 3);
  assert.deepEqual(Object.fromEntries(t.files.map(f => [f.path, f.cases])), { 'e2e/login.spec.ts': 1, 'tests/contacts.test.ts': 3, 'tests/webhooks.test.ts': 2 });
  assert.equal(t.by_kind.e2e.cases, 1);
  assert.deepEqual(t.frameworks, ['Vitest', 'Playwright Test']);
  assert.deepEqual(t.ingested, { file_name: 'out.txt', format: 'vitest', passed: 5, failed: 0, skipped: 1, total: 6 });
});

test('docs, code size and git history', () => {
  const docs = collectDocs(repo);
  assert.deepEqual(docs.map(d => [d.path, d.kind, d.title]), [['README.md', 'readme', 'Harbor Ledger'], ['docs/ARCHITECTURE.md', 'architecture', 'Harbor Ledger architecture']]);
  const size = collectSize(repo);
  assert.ok(size.source_lines > 150);
  assert.ok(size.by_folder.some(r => r.key === 'src/app'));
  assert.ok(size.by_language.some(r => r.key === 'TypeScript'));
  const g = collectGitStats(snap.repoPath, snap.commit_date);
  assert.equal(g.commits, 2);
  assert.equal(g.contributors, 1);
  assert.ok(!JSON.stringify(g).includes('fixture@example.test'), 'author addresses are counted, never kept');
  assert.ok(g.churn.some(r => r.folder === 'src/app' && r.added > 0));
});

test('graph: route groups link to the stores and vendors their handlers reach', () => {
  const env = collectEnv(repo);
  const integ = collectIntegrations(repo, env.vars.map(v => v.name));
  const imports = new ImportGraph(repo);
  const g = buildGraph(repo, imports, routes, collectModels(repo), integ, collectWebhooks(repo, routes.routes, imports));
  const has = (from: string, to: string) => g.edges.some(e => e.from === from && e.to === to);
  assert.ok(has('grp:|/api/contacts', 'store:mongodb'), 'through @/models/Contact');
  assert.ok(has('grp:|/api/contacts', 'int:ghl'), 'through @/lib/ghl (one import hop)');
  assert.ok(has('grp:|/api/cron', 'int:twilio'), 'through @/lib/twilio');
  assert.ok(has('grp:worker|/jobs', 'store:sqlite'));
  assert.ok(has('int:stripe', 'wh:|/api/webhooks/stripe'));
  assert.ok(g.nodes.find(n => n.id === 'wh:|/api/webhooks/twilio')!.warn);
  assert.ok(!has('grp:|/api/export', 'int:stripe'));
});
