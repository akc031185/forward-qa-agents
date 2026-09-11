// End-to-end: a tiny local site with one broken link, one image without alt and one unlabeled form.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Db } from '../../src/core/db.js';
import { forwardDeployedTester } from '../../src/agents/forward-deployed-tester/index.js';

const PAGES: Record<string, string> = {
  '/': `<!doctype html><html><head><title>Demo Home</title></head><body>
    <header><nav><a href="/about">About</a> <a href="/contact">Contact us</a> <a href="/missing">Old page</a> <a href="https://other.example.test/x">External</a></nav></header>
    <main><h1>Welcome to Demo</h1><button id="cta">Get started</button></main></body></html>`,
  '/about': `<!doctype html><html><head><title>About Demo</title></head><body>
    <main><h2>About</h2><img src="/logo.png"><a href="/">Home</a><a href="/contact#form">Contact</a></main></body></html>`,
  '/contact': `<!doctype html><html><head><title>Contact Demo</title></head><body>
    <main><h1>Contact</h1><form><input type="text" name="first"><input type="email" name="email"><button type="submit">Send</button></form><a href="/">Home</a></main>
    <script>console.error("boom from contact");</script></body></html>`,
};

let server: http.Server;
let baseUrl = '';
let chromiumOk = true;

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const body = PAGES[url.pathname];
    if (url.pathname === '/logo.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.alloc(0)); }
    if (!body) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<h1>404</h1>'); }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const { chromium } = await import('playwright');
    const b = await chromium.launch({ headless: true });
    await b.close();
  } catch {
    chromiumOk = false;
  }
});

after(async () => { await new Promise<void>(r => server.close(() => r())); });

test('forward-deployed-tester end-to-end against a local site', { timeout: 120_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed; run `npx playwright install chromium`'); return; }
  const db = new Db(':memory:');
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdt-'));
  const engagement = db.createEngagement({ org: 'demo', name: 'integration', target_url: baseUrl });
  const run = db.createRun({ engagement_id: engagement.id, agent: 'forward-deployed-tester', input: {} });
  db.markRunning(run.id);
  const logs: string[] = [];

  const input = forwardDeployedTester.inputSchema.parse({ target_url: baseUrl + '/', org_slug: 'demo', max_pages: 5, timeout_ms: 10_000 });
  const output = await forwardDeployedTester.run(input, { db, runId: run.id, engagementId: engagement.id, workspaceDir, log: m => logs.push(m) });
  db.markFinished(run.id, output);

  assert.equal(output.pages_crawled, 3, `expected 3 pages, logs:\n${logs.join('\n')}`);
  const findings = db.listFindings(run.id);
  assert.ok(findings.length > 0, 'findings exist');
  const cats = new Set(findings.map(f => f.category));
  assert.ok(cats.has('broken-link'), 'broken link recorded');
  assert.ok(findings.some(f => /image/.test(f.title) && /\/about/.test(f.title)), 'image without alt on /about');
  assert.ok(findings.some(f => /form/.test(f.title) && /\/contact/.test(f.title)), 'unlabeled form on /contact');
  assert.ok(findings.some(f => f.category === 'console-error' && /\/contact/.test(f.title)), 'console error on /contact');
  assert.ok(findings.some(f => f.category === 'structure' && /\/about/.test(f.title)), 'missing h1 on /about');
  assert.ok(Object.values(output.findings_by_severity).reduce((a, b) => a + b, 0) === findings.length);

  assert.ok(fs.existsSync(path.join(output.infra_dir, 'playwright.config.ts')), 'infra/playwright.config.ts exists');
  assert.equal(output.infra_dir, path.join(workspaceDir, 'infra'));
  for (const rel of ['package.json', '.mcp.json', 'tests/smoke.spec.ts', 'tests/fixtures.ts', 'README.md', '.github/workflows/playwright.yml', 'pages/HomePage.page.ts', 'pages/AboutPage.page.ts', 'pages/ContactPage.page.ts']) {
    assert.ok(fs.existsSync(path.join(output.infra_dir, rel)), `${rel} exists`);
  }
  const home = fs.readFileSync(path.join(output.infra_dir, 'pages/HomePage.page.ts'), 'utf8');
  assert.match(home, /getByRole\("link", \{ name: "Contact us", exact: true \}\)/);
  assert.match(home, /getByRole\("button", \{ name: "Get started", exact: true \}\)/);
  assert.ok(output.locators_total >= 8, `locators_total=${output.locators_total}`);

  assert.ok(fs.existsSync(output.report_path));
  assert.ok(fs.existsSync(path.join(workspaceDir, 'report.json')));
  const md = fs.readFileSync(output.report_path, 'utf8');
  assert.match(md, /## Crawl summary/);
  assert.match(md, /\/missing/);
  assert.match(output.summary, /Crawled 3 pages/);

  const artifacts = db.listArtifacts(run.id);
  assert.ok(artifacts.some(a => a.kind === 'report/markdown' && a.path === output.report_path));
  assert.ok(artifacts.filter(a => a.kind.startsWith('infra/')).length >= 10);
  assert.equal(db.getRun(run.id)!.status, 'succeeded');
  db.close();
  fs.rmSync(workspaceDir, { recursive: true, force: true });
});
