// End-to-end against a real browser: the fixture in responsive-site.ts wears one of each
// responsiveness defect on purpose, so this exercises collect.ts's actual viewport-resizing pass
// (not just the pure functions in responsive.ts, which units.test.ts and responsive.test.ts
// already cover against hand-built ResponsiveRaw fixtures).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Db } from '../../src/core/db.js';
import { aiSiteAuditor } from '../../src/agents/ai-site-auditor/index.js';
import { createSsrSite } from '../../fixtures/ai-site-auditor/sites.js';
import { createResponsiveSite } from '../../fixtures/ai-site-auditor/responsive-site.js';

let bad: http.Server; let clean: http.Server;
let badUrl = ''; let cleanUrl = ''; let chromiumOk = true;

before(async () => {
  bad = createResponsiveSite();
  clean = createSsrSite();
  await new Promise<void>(res => bad.listen(0, '127.0.0.1', res));
  await new Promise<void>(res => clean.listen(0, '127.0.0.1', res));
  badUrl = `http://127.0.0.1:${(bad.address() as AddressInfo).port}/`;
  cleanUrl = `http://127.0.0.1:${(clean.address() as AddressInfo).port}/`;
  try { const { chromium } = await import('playwright'); await (await chromium.launch()).close(); } catch { chromiumOk = false; }
});
after(async () => {
  for (const srv of [bad, clean]) srv.closeAllConnections();
  for (const srv of [bad, clean]) await new Promise<void>(r => srv.close(() => r()));
});

async function audit(url: string) {
  const db = new Db(':memory:');
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-responsive-'));
  const e = db.createEngagement({ org: 'acme', name: 't', target_url: url });
  const run = db.createRun({ engagement_id: e.id, agent: 'ai-site-auditor', input: {} });
  const logs: string[] = [];
  const input = aiSiteAuditor.inputSchema.parse({ target_url: url, org_slug: 'acme', max_pages: 2, timeout_ms: 15000 });
  const output = await aiSiteAuditor.run(input, { db, runId: run.id, engagementId: e.id, workspaceDir, log: m => logs.push(m) });
  const findings = db.listFindings(run.id);
  const ids = findings.map(f => (JSON.parse(f.evidence_json!) as { id: string }).id);
  return { db, output, ids, logs, workspaceDir };
}

test('a page with one of every responsiveness defect trips every responsive check', { timeout: 180_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }
  const a = await audit(badUrl);
  const expected = [
    'responsive.breaks-between-breakpoints', 'responsive.small-tap-targets', 'responsive.overlapping-tap-targets',
    'responsive.clipped-text', 'responsive.disappearing-content', 'responsive.oversized-images',
  ];
  const missing = expected.filter(id => !a.ids.includes(id));
  assert.deepEqual(missing, [], `responsive checks missed: ${missing.join(', ')}\nfound: ${a.ids.filter(i => i.startsWith('responsive.')).join(', ')}\n${a.logs.join('\n')}`);
  assert.ok(a.output.scores.responsive < 60, `expected a poor responsive score, got ${a.output.scores.responsive}`);
  const html = fs.readFileSync(a.output.report_html, 'utf8');
  assert.match(html, /Responsiveness/);
  a.db.close(); fs.rmSync(a.workspaceDir, { recursive: true, force: true });
});

test('an ordinary fluid page trips no responsive check', { timeout: 180_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }
  const a = await audit(cleanUrl);
  const tripped = a.ids.filter(i => i.startsWith('responsive.'));
  assert.deepEqual(tripped, [], `expected a clean responsive area, got: ${tripped.join(', ')}`);
  assert.equal(a.output.scores.responsive, 100);
  a.db.close(); fs.rmSync(a.workspaceDir, { recursive: true, force: true });
});
