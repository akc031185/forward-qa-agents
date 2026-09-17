// End-to-end against two local sites: a typical AI-builder SPA and a server-rendered site.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Db } from '../../src/core/db.js';
import { aiSiteAuditor } from '../../src/agents/ai-site-auditor/index.js';

import { createSpaSite, createSsrSite, createVibecodedSite, FAKE_KEY } from '../../fixtures/ai-site-auditor/sites.js';

let spa: http.Server; let good: http.Server; let vibe: http.Server;
let spaUrl = ''; let goodUrl = ''; let vibeUrl = ''; let chromiumOk = true;

before(async () => {
  spa = createSpaSite();
  good = createSsrSite();
  vibe = createVibecodedSite();
  await new Promise<void>(r => spa.listen(0, '127.0.0.1', r));
  await new Promise<void>(r => good.listen(0, '127.0.0.1', r));
  await new Promise<void>(r => vibe.listen(0, '127.0.0.1', r));
  spaUrl = `http://127.0.0.1:${(spa.address() as AddressInfo).port}/`;
  goodUrl = `http://127.0.0.1:${(good.address() as AddressInfo).port}/`;
  vibeUrl = `http://127.0.0.1:${(vibe.address() as AddressInfo).port}/`;
  try { const { chromium } = await import('playwright'); await (await chromium.launch()).close(); } catch { chromiumOk = false; }
});
after(async () => {
  for (const srv of [spa, good, vibe]) srv.closeAllConnections();
  for (const srv of [spa, good, vibe]) await new Promise<void>(r => srv.close(() => r()));
});

async function audit(url: string) {
  const db = new Db(':memory:');
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
  const e = db.createEngagement({ org: 'acme', name: 't', target_url: url });
  const run = db.createRun({ engagement_id: e.id, agent: 'ai-site-auditor', input: {} });
  const logs: string[] = [];
  const input = aiSiteAuditor.inputSchema.parse({ target_url: url, org_slug: 'acme', max_pages: 5, timeout_ms: 8000 });
  const output = await aiSiteAuditor.run(input, { db, runId: run.id, engagementId: e.id, workspaceDir, log: m => logs.push(m) });
  const findings = db.listFindings(run.id);
  const ids = findings.map(f => (JSON.parse(f.evidence_json!) as { id: string }).id);
  return { db, output, findings, ids, logs, workspaceDir, runId: run.id };
}

test('AI-builder SPA: invisible to AI crawlers, soft 404, scaffold title, leaked key, firewall block', { timeout: 180_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }
  const a = await audit(spaUrl);
  const expected = [
    'ai.content-needs-javascript', 'ai.title-set-by-javascript', 'ai.h1-set-by-javascript', 'ai.description-set-by-javascript',
    'ai.bot-user-agent-blocked', 'ai.no-structured-data', 'ai.llms-txt-malformed',
    'seo.no-robots-txt', 'seo.no-sitemap', 'seo.soft-404', 'seo.missing-canonical', 'seo.duplicate-titles', 'seo.images-missing-alt',
    'build.secret-in-javascript', 'build.scaffold-title', 'build.placeholder-content', 'build.builder-fingerprints', 'build.console-errors',
  ];
  for (const id of expected) assert.ok(a.ids.includes(id), `${id} missing; got ${a.ids.join(', ')}\n${a.logs.join('\n')}`);
  assert.equal(a.output.pages_audited, 2, 'home and /pricing, found by following rendered links');
  assert.equal(a.output.grades['ai-visibility'], 'F');
  const secret = a.findings.find(f => f.title.startsWith('Secret credential'))!;
  assert.equal(secret.severity, 'critical');
  assert.ok(!secret.evidence_json!.includes(FAKE_KEY), 'the key itself is never stored');
  const html = fs.readFileSync(a.output.report_html, 'utf8');
  assert.ok(!html.includes(FAKE_KEY), 'the key itself is never printed');
  assert.match(html, /Vite \+ React/);
  assert.match(html, /PerplexityBot/);
  assert.ok(fs.existsSync(path.join(a.workspaceDir, 'report.json')) && fs.existsSync(a.output.report_md));
  assert.ok(a.db.listArtifacts(a.runId).some(x => x.kind === 'report/html'));
  a.db.close(); fs.rmSync(a.workspaceDir, { recursive: true, force: true });
});

test('server-rendered site: visible to AI crawlers, training bot blocked by choice, clean build', { timeout: 180_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }
  const a = await audit(goodUrl);
  const forbidden = ['ai.content-needs-javascript', 'ai.title-set-by-javascript', 'ai.robots-blocks-citation-bots', 'seo.soft-404', 'seo.no-sitemap', 'build.scaffold-title', 'build.secret-in-javascript', 'seo.duplicate-titles'];
  for (const id of forbidden) assert.ok(!a.ids.includes(id), `unexpected ${id}: ${a.findings.find((_, i) => a.ids[i] === id)?.title}`);
  assert.equal(a.output.scores['ai-visibility'], 100, `ai findings: ${a.findings.filter(f => f.category === 'ai-visibility').map(f => f.title).join(' | ')}`);
  assert.equal(a.output.grades.search, 'A');
  const report = JSON.parse(fs.readFileSync(path.join(a.workspaceDir, 'report.json'), 'utf8'));
  const gpt = report.bots.find((b: { token: string }) => b.token === 'GPTBot');
  const search = report.bots.find((b: { token: string }) => b.token === 'OAI-SearchBot');
  assert.equal(gpt.robotsAllowed, false, 'GPTBot blocked by its own group');
  assert.equal(search.robotsAllowed, true, 'OAI-SearchBot still allowed');
  assert.ok(report.pages[0].raw_words > 100, 'content present without JavaScript');
  assert.ok(report.pages.every((p: { rendered_words?: number }) => (p.rendered_words ?? 0) > 100), 'rendered even though the load event never fires');
  assert.ok(a.ids.includes('build.load-never-finished'), 'the hanging request is reported');
  assert.ok(!a.ids.includes('build.render-failed'));
  const off = report.site.sitemaps.find((s: { url: string }) => s.url.includes('production.invalid'));
  assert.equal(off?.kind, 'other-host', 'off-host sitemap recorded, not fetched');
  assert.equal(off?.status, 0);
  assert.ok(a.ids.includes('seo.sitemap-other-host'));
  a.db.close(); fs.rmSync(a.workspaceDir, { recursive: true, force: true });
});

test('vibecoded site: technically sound, but the design tells are all present', { timeout: 180_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }
  const a = await audit(vibeUrl);

  // The point of this fixture: it is server-rendered and indexable, so a poor design grade cannot
  // be a side effect of the other areas failing.
  assert.equal(a.output.scores['ai-visibility'], 100, `ai findings: ${a.findings.filter(f => f.category === 'ai-visibility').map(f => f.title).join(' | ')}`);
  assert.ok(!a.ids.includes('build.scaffold-title'), 'the title is real');

  const expected = [
    'design.violet-blue-gradient', 'design.gradient-hero-text', 'design.emoji-headings',
    'design.scaffold-fonts', 'design.colored-border-cards', 'design.glassmorphism',
    'design.three-icon-row', 'design.badge-above-headline', 'design.lucide-icons',
    'design.fade-in-on-scroll', 'design.cursor-beam', 'design.hover-opacity',
    'design.serif-italic-accents', 'design.buzzword-copy', 'design.low-contrast-text',
    'design.grain-over-gradient',
  ];
  const missing = expected.filter(id => !a.ids.includes(id));
  assert.deepEqual(missing, [], `design tells missed: ${missing.join(', ')}\nfound: ${a.ids.filter(i => i.startsWith('design.')).join(', ')}`);
  assert.ok(a.output.scores.design < 60, `design score should be poor, got ${a.output.scores.design}`);

  // launch readiness: the fixture links no policies, installs no analytics and publishes no contact
  for (const id of ['readiness.no-privacy-policy', 'readiness.no-terms', 'readiness.no-analytics', 'readiness.no-contact-details', 'readiness.unhelpful-404']) {
    assert.ok(a.ids.includes(id), `${id} missing; readiness findings: ${a.ids.filter(i => i.startsWith('readiness.')).join(', ')}`);
  }
  assert.ok(!a.ids.includes('readiness.no-call-to-action'), 'the hero does offer an action');
  assert.ok(a.output.scores.readiness < 100);

  // the report has to show the new areas
  const html = fs.readFileSync(a.output.report_html, 'utf8');
  assert.match(html, /Design originality/);
  assert.match(html, /Launch readiness/);
  const report = JSON.parse(fs.readFileSync(path.join(a.workspaceDir, 'report.json'), 'utf8'));
  assert.ok(typeof report.scores.design === 'number');
  a.db.close(); fs.rmSync(a.workspaceDir, { recursive: true, force: true });
});

test('a well-designed server-rendered site trips few design tells', { timeout: 180_000 }, async (t) => {
  if (!chromiumOk) { t.skip('Chromium is not installed'); return; }
  const a = await audit(goodUrl);
  const tells = a.ids.filter(i => i.startsWith('design.'));
  assert.ok(tells.length <= 2, `plain site should be clean, got: ${tells.join(', ')}`);
  assert.ok(!tells.includes('design.violet-blue-gradient'));
  assert.ok(!tells.includes('design.buzzword-copy'));
  a.db.close(); fs.rmSync(a.workspaceDir, { recursive: true, force: true });
});
