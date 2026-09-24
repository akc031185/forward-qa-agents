// The whole agent: secrets never read or printed, HTML escaping, the dossier.json contract, run
// recording, and the portfolio index over several dossiers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Db } from '../../src/core/db.js';
import { architectureDossier } from '../../src/agents/architecture-dossier/index.js';
import { buildDossier } from '../../src/agents/architecture-dossier/build.js';
import { RepoFiles } from '../../src/agents/architecture-dossier/files.js';
import { loadFacts, parseFacts } from '../../src/agents/architecture-dossier/facts.js';
import { renderDossierHtml } from '../../src/agents/architecture-dossier/render.js';
import { DossierSchema } from '../../src/agents/architecture-dossier/schema.js';
import { buildPortfolio, loadPortfolio } from '../../src/agents/architecture-dossier/portfolio.js';
import { FAKE_PEM_BODY, FAKE_SECRET, FIXTURE_DIR, TEMPLATE_VALUE, WORKTREE_SECRET, makeFixtureRepo } from './helpers.js';

let fx: ReturnType<typeof makeFixtureRepo>;
let work: string;
let html = ''; let json = '';
let output: Awaited<ReturnType<typeof architectureDossier.run>>;
let db: Db; let runId = '';
const readPaths: string[] = [];

before(async () => {
  fx = makeFixtureRepo();
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-out-'));
  db = new Db(':memory:');
  const e = db.createEngagement({ org: 'self', name: 't' });
  const run = db.createRun({ engagement_id: e.id, agent: 'architecture-dossier', input: {} });
  runId = run.id;
  const input = architectureDossier.inputSchema.parse({
    repo_path: fx.dir, out_dir: path.join(work, 'apps', 'harbor'), facts_path: path.join(FIXTURE_DIR, 'facts.json'),
    test_output_path: path.join(FIXTURE_DIR, 'vitest-output.txt'),
  });
  // Record every file this process opens while the agent runs.
  const orig = { readFileSync: fs.readFileSync, openSync: fs.openSync, createReadStream: fs.createReadStream };
  const spy = <T extends (...a: never[]) => unknown>(fn: T) => ((...a: Parameters<T>) => { readPaths.push(String(a[0])); return fn(...a); }) as unknown as T;
  fs.readFileSync = spy(orig.readFileSync); fs.openSync = spy(orig.openSync); fs.createReadStream = spy(orig.createReadStream);
  try {
    const workspaceDir = path.join(work, 'ws'); fs.mkdirSync(workspaceDir);
    output = await architectureDossier.run(input, { db, runId, engagementId: e.id, workspaceDir, log: () => {} });
  } finally { Object.assign(fs, orig); }
  html = fs.readFileSync(output.dossier_html, 'utf8');
  json = fs.readFileSync(output.dossier_json, 'utf8');
});
after(() => { db.close(); fx.cleanup(); fs.rmSync(work, { recursive: true, force: true }); });

test('secrets: no .env, .env.* or .pem file is ever opened', () => {
  const opened = readPaths.map(p => path.basename(p));
  for (const bad of ['.env', '.env.local', 'dev.pem']) assert.ok(!opened.includes(bad), `${bad} was opened: ${readPaths.filter(p => p.endsWith(bad)).join(', ')}`);
  assert.ok(opened.includes('.env.example'), 'the template is read (for names)');
});

test('secrets: no secret value, template value or working-tree value appears in any output', () => {
  for (const [label, text] of [['html', html], ['json', json]] as const) {
    for (const s of [FAKE_SECRET, FAKE_PEM_BODY, WORKTREE_SECRET, TEMPLATE_VALUE, 'mongodb://localhost:27017/harbor']) assert.ok(!text.includes(s), `${label} contains ${s}`);
    assert.ok(!text.includes('UNCOMMITTED_ONLY_VAR'), `${label} includes a working-tree-only change`);
  }
  const d = JSON.parse(json);
  assert.deepEqual(d.provenance.secret_like_files_excluded, ['.env', 'certs/dev.pem'], 'named, not read');
  assert.equal(d.gaps[0].id, 'secrets.committed-secret-file');
});

test('secrets: RepoFiles refuses to list or read a secret-like file even if one is on disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-rf-'));
  fs.writeFileSync(path.join(dir, '.env'), `K=${FAKE_SECRET}\n`);
  fs.writeFileSync(path.join(dir, '.env.example'), 'K=\n');
  fs.symlinkSync(path.join(dir, '.env'), path.join(dir, 'linked.txt'));
  const r = new RepoFiles(dir);
  assert.deepEqual(r.files, ['.env.example']);
  assert.deepEqual(r.secretLike, ['.env']);
  assert.deepEqual(r.symlinks, ['linked.txt'], 'symbolic links are not followed');
  assert.throws(() => r.text('.env'), /refusing to read a secret-like file/);
  assert.equal(r.text('linked.txt'), undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('facts: stated values merged and labelled; credentials and unknown keys rejected', () => {
  assert.match(html, /Operations &amp; costs <span class="lab lab-stated"/);
  assert.match(html, /\$34\.5/);
  assert.match(html, /Transfer the domain/);
  assert.throws(() => parseFacts({ notes: [`key ${FAKE_SECRET}`] }), /appears to contain a credential/);
  assert.throws(() => parseFacts({ notes: ['postgres://admin:hunter2@db.internal/app'] }), /credential/);
  assert.throws(() => parseFacts({ domians: [] }), /Unrecognized key/);
  assert.throws(() => loadFacts(path.join(fx.dir, '.env')), /looks like a secrets file/);
  const d = JSON.parse(json);
  assert.equal(d.gaps.find((g: { source: string }) => g.source === 'stated').title, 'No staging environment');
});

test('HTML: every untrusted string is escaped', () => {
  assert.ok(!html.includes('<img src=x'), 'package.json description');
  assert.ok(!html.includes("<script>alert('stated')</script>"), 'facts file');
  assert.ok(html.includes('&lt;script&gt;alert(&#39;stated&#39;)&lt;/script&gt;'));
  assert.ok(!/<script\b/i.test(html), 'the page has no script at all');
  const d = buildDossier({ repoPath: fx.dir, name: '<svg onload=alert(1)>' });
  d.routes.routes.push({ ...d.routes.routes[0]!, path: '/x"><b>bold</b>', file: 'a<b>.ts' });
  d.graph.nodes.push({ id: 'n', label: '</text><script>x()</script>', column: 1, kind: 'routes' });
  const h = renderDossierHtml(d);
  assert.ok(!h.includes('<svg onload') && !h.includes('<b>bold</b>') && !h.includes('<script>x()'));
  assert.ok(h.includes('&lt;svg onload=alert(1)&gt;'));
});

test('HTML: sections, labels, theme and print CSS, no external resources', () => {
  for (const id of ['summary', 'stack', 'architecture', 'data', 'api', 'integrations', 'security', 'ops', 'tests', 'costs', 'handover', 'gaps', 'provenance']) assert.match(html, new RegExp(`<section id="${id}">`), id);
  assert.match(html, /prefers-color-scheme:dark/);
  assert.match(html, /:root\[data-theme="dark"\]/);
  assert.match(html, /@media print/);
  assert.match(html, /<svg class="graph"/);
  assert.ok(!/(src|href)="https?:/.test(html), 'no external src or href');
  assert.ok(!/@import|url\(/.test(html), 'no external CSS');
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test('dossier.json: validates against the schema; provenance names the commit and collectors', () => {
  const d = DossierSchema.parse(JSON.parse(json));
  assert.equal(d.schema_version, 1);
  assert.equal(d.app.name, 'Harbor Ledger');
  assert.equal(d.app.id, 'harbor-ledger');
  assert.equal(d.provenance.commit, output.commit);
  assert.equal(d.provenance.run_id, runId);
  assert.deepEqual(d.provenance.collectors.map(c => c.name), ['stack', 'routes', 'data-models', 'env-names', 'integrations', 'webhooks', 'auth-security', 'jobs', 'deploy', 'tests', 'docs', 'git-stats', 'code-size', 'graph']);
  assert.ok(d.provenance.collectors.every(c => c.ok));
  assert.equal(d.summary.counts.webhooks_unverified, 1);
  assert.equal(d.summary.counts.monthly_cost_usd_stated, 34.5);
  assert.equal(d.tests.total_cases, 6);
  const broken = JSON.parse(json); broken.schema_version = 2; delete broken.provenance.commit;
  assert.equal(DossierSchema.safeParse(broken).success, false);
});

test('run recording: artifacts, measured gaps as findings, copies in --out', () => {
  const kinds = db.listArtifacts(runId).map(a => a.kind).sort();
  assert.deepEqual(kinds, ['dossier/html', 'dossier/json']);
  const findings = db.listFindings(runId);
  assert.ok(findings.some(f => f.severity === 'high' && /does not verify a signature/.test(f.title)));
  assert.ok(!findings.some(f => f.title === 'No staging environment'), 'stated gaps are not recorded as findings');
  assert.ok(fs.existsSync(path.join(work, 'apps', 'harbor', 'index.html')) && fs.existsSync(path.join(work, 'apps', 'harbor', 'dossier.json')));
  assert.equal(output.gaps_by_severity.high, 2);
});

test('portfolio index: reads several dossiers, links them, draws stated links and shared vendors', () => {
  const apps = path.join(work, 'apps');
  fs.cpSync(path.join(apps, 'harbor'), path.join(apps, 'harbor-copy'), { recursive: true });
  fs.mkdirSync(path.join(apps, 'broken')); fs.writeFileSync(path.join(apps, 'broken', 'dossier.json'), '{"schema_version":1}');
  fs.mkdirSync(path.join(apps, 'not-a-dossier'));
  const out = path.join(work, 'index');
  const r = buildPortfolio({ inDir: apps, outDir: out, portfolio: loadPortfolio(path.join(FIXTURE_DIR, 'portfolio.json')) });
  assert.deepEqual(r.summary.apps.map(a => a.folder), ['harbor', 'harbor-copy']);
  assert.equal(r.summary.apps[0]!.href, '../apps/harbor/index.html');
  assert.equal(r.summary.totals.monthly_cost_usd_stated, 69);
  assert.equal(r.summary.errors.length, 1);
  assert.match(r.summary.errors[0]!, /^broken\/dossier\.json/);
  assert.deepEqual(r.summary.unresolved_links, ['harbor → missing-app']);
  assert.ok(r.summary.shared.some(s => s.id === 'stripe' && s.apps.length === 2));
  assert.ok(r.summary.shared.some(s => s.id === 'store:mongodb'));
  const page = fs.readFileSync(r.htmlPath, 'utf8');
  assert.match(page, /<svg class="graph"/);
  assert.match(page, /posts jobs/);
  assert.match(page, /href="\.\.\/apps\/harbor\/index\.html"/);
  assert.ok(!page.includes('<img src=x') && !/<script\b/i.test(page));
  assert.ok(JSON.parse(fs.readFileSync(r.jsonPath, 'utf8')).apps.length === 2);
  assert.equal(path.basename(r.jsonPath), 'portfolio.summary.json');
  assert.throws(() => buildPortfolio({ inDir: apps, outDir: out, portfolio: (() => { const f = path.join(work, 'p.json'); fs.writeFileSync(f, JSON.stringify({ notes: [FAKE_SECRET] })); return loadPortfolio(f); })() }), /credential/);
});
