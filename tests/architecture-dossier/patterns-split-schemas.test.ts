// More code shapes from a real single-tenant Next.js pages-router app, as synthetic snippets:
// schemas typed through an interface, schemas registered in another file on a second connection,
// scripts that redeclare an app model, Mongoose's own pluralisation, a middleware that skips auth
// for /api/, a scheduled workflow that calls "$SITE_URL/api/...", a nested lockfile copy, NextAuth
// XProvider() calls, and a workflow that names a platform only in comments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectModels, inferCollection, parseMongoose } from '../../src/agents/architecture-dossier/models.js';
import { middlewareBypass } from '../../src/agents/architecture-dossier/routes.js';
import { collectJobs } from '../../src/agents/architecture-dossier/jobs.js';
import { resolvedVersion } from '../../src/agents/architecture-dossier/stack.js';
import { collectAuth } from '../../src/agents/architecture-dossier/auth.js';
import { collectDeploy } from '../../src/agents/architecture-dossier/deploy.js';
import { RepoFiles, isTestPath } from '../../src/agents/architecture-dossier/files.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** A throwaway folder holding exactly these files, read the way the collectors read a snapshot. */
function repoOf(files: Record<string, string>): RepoFiles {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-patterns-'));
  for (const [rel, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), body); }
  const repo = new RepoFiles(root);
  process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }));
  return repo;
}

test('a schema below an interface keeps its own name, so model() finds it', () => {
  const src = [
    "import mongoose from 'mongoose';",
    'export interface ITicket extends mongoose.Document {',
    '  ownerId: mongoose.Types.ObjectId;',
    "  status: 'open' | 'closed';",
    '}',
    'const ticketSchema = new mongoose.Schema<ITicket>({',
    "  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },",
    "  status: { type: String, enum: ['open', 'closed'] },",
    '}, { timestamps: true });',
    "export default mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', ticketSchema);",
  ].join('\n');
  const [m] = parseMongoose('src/models/Ticket.ts', src);
  assert.equal(m?.name, 'Ticket');
  assert.deepEqual(m!.fields.map(f => f.name), ['ownerId', 'status']);
  assert.equal(m!.timestamps, true);
});

test('a schema exported from one file and registered in another is found; script copies of app models are dropped', () => {
  const repo = repoOf({
    'package.json': JSON.stringify({ dependencies: { mongoose: '8.0.0' } }),
    'src/models/second/noteSchema.ts': "import mongoose from 'mongoose';\nexport const noteSchema = new mongoose.Schema({ body: String, workspaceId: { type: String, index: true } });",
    'src/lib/secondDb.ts': "import { noteSchema } from '../models/second/noteSchema';\nexport const Note = () => conn.model('Note', noteSchema);\nexport const Other = () => laneModel<INote>('Memo', noteSchema);",
    'src/models/User.ts': "import mongoose from 'mongoose';\nconst userSchema = new mongoose.Schema({ email: String, role: String });\nexport default mongoose.model('User', userSchema);",
    'scripts/seed-user.ts': "import mongoose from 'mongoose';\nconst userSchema2 = new mongoose.Schema({ email: String });\nconst User = mongoose.model('User', userSchema2);",
    'scripts/only-here.ts': "import mongoose from 'mongoose';\nconst s = new mongoose.Schema({ x: String });\nmongoose.model('ScratchOnly', s);",
  });
  const { models } = collectModels(repo);
  const byName = (n: string) => models.filter(m => m.name === n);
  assert.equal(byName('Note').length, 1);
  assert.equal(byName('Note')[0]!.file, 'src/models/second/noteSchema.ts', 'reported where the fields live');
  assert.deepEqual(byName('Note')[0]!.fields.map(f => f.name), ['body', 'workspaceId']);
  assert.equal(byName('Memo').length, 1, 'a project factory in a file that never mentions mongoose');
  assert.equal(byName('User').length, 1);
  assert.equal(byName('User')[0]!.file, 'src/models/User.ts');
  assert.equal(byName('ScratchOnly').length, 1, 'a model only a script defines is kept');
});

test("inferred collection names follow Mongoose's pluralisation", () => {
  assert.equal(inferCollection('DailyAnalytics'), 'dailyanalytics');
  assert.equal(inferCollection('Box'), 'boxes');
  assert.equal(inferCollection('Address'), 'addresses');
  assert.equal(inferCollection('Category'), 'categories');
  assert.equal(inferCollection('Day'), 'days');
  assert.equal(inferCollection('Contact'), 'contacts');
});

test('middleware that returns early for a prefix before checking auth does not guard it', () => {
  const src = [
    'export async function middleware(req) {',
    '  const { pathname } = req.nextUrl;',
    "  if (pathname.startsWith('/api/')) { res.headers.set('X-Robots-Tag', 'noindex'); }",
    "  if (pathname.startsWith('/share/')) { return res; }",
    "  if (pathname.startsWith('/api/')) {",
    '    return res;',
    '  }',
    '  const token = await getToken({ req });',
    "  if (pathname.startsWith('/late/')) return res;",
    '}',
  ].join('\n');
  assert.deepEqual(middlewareBypass(src), ['/api/', '/share/']);
});

test('a scheduled workflow calling "$SITE_URL/api/..." is linked to the cron route', () => {
  const repo = repoOf({
    '.github/workflows/drip.yml': [
      'name: Drip', 'on:', '  schedule:', "    - cron: '0 * * * *'", 'jobs:', '  t:', '    steps:',
      '      - run: |', '          curl -H "Authorization: Bearer $CRON_SECRET" \\', '            "$SITE_URL/api/cron/drip"',
      '      - run: curl ${BASE_URL}/api/cron/other',
    ].join('\n'),
  });
  const jobs = collectJobs(repo, []);
  assert.deepEqual(jobs.workflow_schedules[0]!.calls_paths, ['/api/cron/drip', '/api/cron/other']);
});

test('lockfile: the top-level install wins over a newer copy nested under a plugin', () => {
  const lock = JSON.stringify({ packages: {
    'node_modules/@ui/postcss/node_modules/stylekit': { version: '4.1.0' },
    'node_modules/stylekit': { version: '3.4.18' },
    'node_modules/@ui/only-nested/node_modules/deepkit': { version: '2.0.0' },
  } });
  assert.equal(resolvedVersion('package-lock.json', lock, 'stylekit'), '3.4.18');
  assert.equal(resolvedVersion('package-lock.json', lock, 'deepkit'), '2.0.0', 'nested only: still found');
});

test('NextAuth providers written as XProvider({...}) are named', () => {
  const repo = repoOf({
    'pages/api/auth/[...nextauth].ts': "import NextAuth from 'next-auth';\nimport CredentialsProvider from 'next-auth/providers/credentials';\nimport GoogleProvider from 'next-auth/providers/google';\nexport default NextAuth({ providers: [CredentialsProvider({ name: 'c' }), GoogleProvider({ clientId: 'x' })], session: { strategy: 'jwt' } });",
  });
  assert.deepEqual(collectAuth(repo, [], []).nextauth?.providers, ['Credentials', 'Google']);
});

test('a workflow that only mentions a platform in comments does not deploy to it', () => {
  const repo = repoOf({
    '.github/workflows/cron.yml': "# The Vercel Hobby plan allows daily crons only, so this runs here.\nname: Cron\non:\n  schedule:\n    - cron: '0 * * * *'\njobs:\n  t:\n    runs-on: ubuntu-latest # not vercel\n    steps:\n      - run: curl \"$SITE_URL/api/cron/x\"\n",
    '.github/workflows/deploy.yml': "name: Deploy\non: push\njobs:\n  d:\n    steps:\n      - run: npx vercel deploy --prod\n",
  });
  const wf = collectDeploy(repo).workflows;
  assert.deepEqual(wf.find(w => w.file.endsWith('cron.yml'))!.deploys_with, []);
  assert.deepEqual(wf.find(w => w.file.endsWith('deploy.yml'))!.deploys_with, ['Vercel']);
});

test('a top-level playwright/ folder is test code: its helpers do not count as app security or integrations', () => {
  assert.equal(isTestPath('playwright/helpers/api-client.ts'), true);
  assert.equal(isTestPath('apps/web/playwright/fixtures.ts'), true);
  assert.equal(isTestPath('src/lib/playwrightRunner.ts'), false, 'a file named after the tool is app code');
});
