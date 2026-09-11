import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Db } from '../../src/core/db.js';
import { deriveFindings } from '../../src/agents/forward-deployed-tester/findings.js';
import { renderReportMarkdown, buildReportJson, countBySeverity, deterministicSummary } from '../../src/agents/forward-deployed-tester/report.js';
import { makeCrawl, makePage } from './fixtures.js';

function seed() {
  const db = new Db(':memory:');
  const e = db.createEngagement({ org: 'acme', name: 'fdt', target_url: 'https://app.example.test' });
  const run = db.createRun({ engagement_id: e.id, agent: 'forward-deployed-tester', input: {} });
  const crawl = makeCrawl([
    makePage({ path: '/', title: 'Home' }),
    makePage({ path: '/about', title: 'About', hasH1: false, h1Text: undefined, imagesMissingAlt: 2, counts: { forms: 0, buttons: 0, links: 3, inputs: 0, images: 2 } }),
    makePage({ path: '/contact', title: 'Contact', formsWithoutLabels: 1, unlabeledInputs: 2, consoleErrors: ['ReferenceError: x is not defined'], loadTimeMs: 3500, hasLandmark: false }),
  ], { brokenLinks: [{ url: 'https://app.example.test/missing', status: 404, referrer: 'https://app.example.test/' }] });
  for (const d of deriveFindings(crawl)) db.addFinding({ run_id: run.id, ...d });
  return { db, run, crawl };
}

describe('deriveFindings', () => {
  test('covers every finding category with sensible severities', () => {
    const { db, run, crawl } = seed();
    const findings = db.listFindings(run.id);
    const byCat = Object.fromEntries(findings.map(f => [f.category + ':' + f.title, f.severity]));
    const find = (cat: string) => findings.filter(f => f.category === cat);
    assert.equal(find('broken-link').length, 1);
    assert.equal(find('broken-link')[0]!.severity, 'medium');
    assert.equal(find('console-error')[0]!.severity, 'medium');
    assert.equal(find('performance')[0]!.severity, 'medium');
    assert.equal(find('structure').length, 1); // /about has no h1
    assert.equal(find('accessibility').filter(f => /image/.test(f.title)).length, 1);
    assert.equal(find('accessibility').filter(f => /form/.test(f.title)).length, 1);
    assert.equal(find('accessibility').filter(f => /landmark/.test(f.title)).length, 1);
    assert.ok(Object.keys(byCat).length >= 7);
    assert.deepEqual(countBySeverity(findings).critical, 0);
    assert.equal(deriveFindings(makeCrawl([]))[0]!.severity, 'critical');
    assert.equal(deriveFindings(makeCrawl([], { brokenLinks: [{ url: 'x', status: 503, referrer: 'y' }] }))[0]!.severity, 'high');
    assert.equal(deriveFindings(makeCrawl([], { brokenLinks: [{ url: 'x', status: 0, referrer: 'y', error: 'net::ERR' }] }))[0]!.category, 'navigation');
    db.close();
    void crawl;
  });
});

describe('report rendering', () => {
  test('markdown contains the crawl table, findings, locator inventory and next steps', () => {
    const { db, run, crawl } = seed();
    const findings = db.listFindings(run.id);
    const summary = deterministicSummary(crawl, findings);
    assert.match(summary, /Crawled 3 pages on https:\/\/app\.example\.test/);
    assert.match(summary, /1 same-origin link answered 4xx\/5xx/);
    const md = renderReportMarkdown({
      orgSlug: 'acme', targetUrl: 'https://app.example.test', runId: run.id, generatedAt: '2026-01-01T00:00:00.000Z',
      crawl, findings, infraDir: '/tmp/ws/infra', infraFiles: ['package.json', 'playwright.config.ts'], summary,
    });
    assert.match(md, /^# Forward Deployed Tester report: acme/m);
    assert.match(md, /## Crawl summary/);
    assert.match(md, /\| `\/contact` \| Contact \| 200 \| 3500 \| 1 \|/);
    assert.match(md, /### Broken links/);
    assert.match(md, /## Findings by severity/);
    assert.match(md, /\| medium \| \d+ \|/);
    assert.match(md, /\*\*\[broken-link\]\*\* Broken link \(404\)/);
    assert.match(md, /## Locator inventory/);
    assert.match(md, /`signInButton` \| `page\.getByRole\("button", \{ name: "Sign in", exact: true \}\)` \| high/);
    assert.match(md, /## Next steps/);
    assert.match(md, /cd \/tmp\/ws\/infra && npm install/);
    db.close();
  });

  test('json report is structured and round-trips evidence', () => {
    const { db, run, crawl } = seed();
    const findings = db.listFindings(run.id);
    const json = buildReportJson({
      orgSlug: 'acme', targetUrl: 'https://app.example.test', runId: run.id, generatedAt: 'now',
      crawl, findings, infraDir: '/x/infra', infraFiles: [], summary: 's',
    });
    assert.equal(json.crawl.pages_crawled, 3);
    assert.equal(json.locators_total, 9);
    assert.equal(json.findings.length, findings.length);
    assert.equal(json.crawl.broken_links[0]!.status, 404);
    const broken = json.findings.find(f => f.category === 'broken-link')!;
    assert.equal((broken.evidence as { status: number }).status, 404);
    assert.deepEqual(Object.keys(json.findings_by_severity).sort(), ['critical', 'high', 'info', 'low', 'medium']);
    db.close();
  });
});
