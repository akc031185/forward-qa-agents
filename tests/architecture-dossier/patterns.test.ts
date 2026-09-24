// Code shapes met in a real multi-workspace Next.js app, reproduced as synthetic snippets: model
// factories, vendor-named signature helpers, URL constants, multi-line fetch calls, a home-page-only
// middleware matcher, and API-key / parse-helper route guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMongoose } from '../../src/agents/architecture-dossier/models.js';
import { inspectWebhook } from '../../src/agents/architecture-dossier/webhooks.js';
import { outboundHosts } from '../../src/agents/architecture-dossier/integrations.js';
import { matcherCovers } from '../../src/agents/architecture-dossier/routes.js';
import { namesInTemplate } from '../../src/agents/architecture-dossier/env.js';
import { AUTH_RE, VALIDATION_RE } from '../../src/agents/architecture-dossier/signals.js';

test('mongoose models registered through a project factory are found; unrelated calls are not', () => {
  const src = [
    "import { Schema } from 'mongoose';",
    "const tagSchema = new Schema<ITag>({ workspaceId: { type: Schema.Types.ObjectId, required: true, index: true }, name: { type: String, required: true } }, { timestamps: true });",
    "tagSchema.index({ workspaceId: 1, name: 1 }, { unique: true });",
    "export const Tags = registerModel<ITag>('Tag', tagSchema);",
    "export const Other = registerModel('Ghost', notASchema);",
  ].join('\n');
  const ms = parseMongoose('src/features/tags/models.ts', src);
  assert.deepEqual(ms.map(m => m.name), ['Tag']);
  assert.equal(ms[0]!.collection, 'tags');
  assert.equal(ms[0]!.timestamps, true);
  assert.ok(ms[0]!.indexes.some(i => i.unique && i.fields.join() === 'workspaceId,name'));
});

test('vendor-named verification helpers count as a signature check; a header read alone does not', () => {
  for (const call of ['verifyStripeWebhook(ws, raw, sig)', 'verifyTwilioRequest(url, p, sig)', 'verifySvix(secret, h, body)', 'verifyCalSignature(raw, h, s)']) {
    assert.equal(inspectWebhook(`const ok = await ${call};`).verified, true, call);
  }
  assert.equal(inspectWebhook("const s = req.headers.get('stripe-signature');").verified, false);
  assert.equal(inspectWebhook('verifyDomain(id)').verified, false);
});

test('outbound hosts: URL constants and fetch calls split over lines; comments stay out', () => {
  const src = [
    "const API = 'https://api.payments-vendor.io/v1';",
    'const r2 = await (opts.fetch ?? fetch)(',
    '  `https://api.mail-vendor.io/emails`, {});',
    'const res = await fetch(',
    '  `https://api.sms-vendor.io/2010-04-01/Accounts/${sid}/Messages.json`,',
    '  { method: "POST" });',
    '/**',
    ' * Handles the request. Docs: https://docs.unrelated-vendor.io/guide',
    ' */',
    "const label = 'https://not-a-call.io/page';",
  ].join('\n');
  assert.deepEqual(outboundHosts(src), ['api.payments-vendor.io', 'api.mail-vendor.io', 'api.sms-vendor.io']);
});

test("middleware matcher '/' covers only the home page", () => {
  assert.equal(matcherCovers('/', '/'), true);
  assert.equal(matcherCovers('/', '/api/v1/contacts'), false);
  assert.equal(matcherCovers('/w/:path*', '/w/acme/contacts'), true);
  assert.equal(matcherCovers('/:path*', '/api/x'), true);
});

test('route signals: authenticate*() helpers and parse helpers given a schema', () => {
  assert.ok(AUTH_RE.test('const key = await authenticateApiKey(req, "contacts:read");'));
  assert.ok(VALIDATION_RE.test('const q = parseQuery(req, contactsQuerySchema);'));
  assert.ok(!VALIDATION_RE.test('const d = parseDate(input);'));
});

test('env templates: commented-out optional names count; prose and values do not', () => {
  const names = namesInTemplate(['# Optional base URL', '# OPTIONAL_BASE_URL=', 'REQUIRED_KEY=', '# Unset = disabled', '#  export OTHER_NAME=x'].join('\n'));
  assert.deepEqual(names, ['OPTIONAL_BASE_URL', 'REQUIRED_KEY', 'OTHER_NAME']);
});

test('a doc-comment example that repeats a registration does not duplicate the model', async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const { RepoFiles } = await import('../../src/agents/architecture-dossier/files.js');
  const { collectModels } = await import('../../src/agents/architecture-dossier/models.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-models-'));
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: { mongoose: '^9' } }));
    fs.mkdirSync(path.join(dir, 'src/server'), { recursive: true }); fs.mkdirSync(path.join(dir, 'src/contacts'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/contacts/models.ts'), "import { Schema } from 'mongoose';\nconst contactSchema = new Schema({ name: String });\nexport const Contacts = registerModel('Contact', contactSchema);\n");
    fs.writeFileSync(path.join(dir, 'src/server/db.ts'), "/**\n *   const Contacts = registerModel('Contact', contactSchema);\n */\nexport function registerModel(name: string, s: unknown) { return { name, s }; }\n");
    const names = collectModels(new RepoFiles(dir)).models.map(m => m.name);
    assert.deepEqual(names, ['Contact']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
