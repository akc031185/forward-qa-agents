// Pure report rendering: markdown + JSON from the crawl result and the persisted findings.
import type { Finding, Severity } from '../../core/db.js';
import type { CrawlResult, PageRecord } from './types.js';

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export interface ReportInput {
  orgSlug: string;
  targetUrl: string;
  runId: string;
  generatedAt: string;
  crawl: CrawlResult;
  findings: Finding[];
  infraDir: string;
  infraFiles: string[];
  summary: string;
}

export function countBySeverity(findings: Pick<Finding, 'severity'>[]): Record<Severity, number> {
  const out: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) out[f.severity]++;
  return out;
}

export function totalLocators(pages: PageRecord[]): number {
  return pages.reduce((n, p) => n + p.elements.length, 0);
}

/** Deterministic executive summary used when no model is configured. */
export function deterministicSummary(crawl: CrawlResult, findings: Pick<Finding, 'severity'>[]): string {
  const counts = countBySeverity(findings);
  const pages = crawl.pages.length;
  const locs = totalLocators(crawl.pages);
  const slow = crawl.pages.filter(p => p.loadTimeMs > 3000).length;
  const avg = pages ? Math.round(crawl.pages.reduce((n, p) => n + p.loadTimeMs, 0) / pages) : 0;
  const parts = [
    `Crawled ${pages} page${pages === 1 ? '' : 's'} on ${crawl.origin} in ${(crawl.durationMs / 1000).toFixed(1)} s (avg load ${avg} ms${slow ? `, ${slow} slow` : ''}).`,
    `Recorded ${findings.length} finding${findings.length === 1 ? '' : 's'}: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info.`,
    crawl.brokenLinks.length ? `${crawl.brokenLinks.length} same-origin link${crawl.brokenLinks.length === 1 ? '' : 's'} answered 4xx/5xx or failed to load.` : 'No broken same-origin links found.',
    `Provisioned a Playwright + MCP project with ${pages} page object${pages === 1 ? '' : 's'}, ${locs} locators and ${pages} smoke test${pages === 1 ? '' : 's'}.`,
    crawl.skipped.length ? `${crawl.skipped.length} discovered link${crawl.skipped.length === 1 ? '' : 's'} not visited (max_pages reached); raise max_pages for fuller coverage.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

function md(s: string | undefined | null): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function renderReportMarkdown(r: ReportInput): string {
  const counts = countBySeverity(r.findings);
  const lines: string[] = [];
  lines.push(`# Forward Deployed Tester report: ${r.orgSlug}`);
  lines.push('');
  lines.push(`- Target: ${r.targetUrl}`);
  lines.push(`- Run: \`${r.runId}\``);
  lines.push(`- Generated: ${r.generatedAt}`);
  lines.push(`- Infra: \`${r.infraDir}\` (${r.infraFiles.length} files)`);
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  lines.push(r.summary);
  lines.push('');
  lines.push('## Crawl summary');
  lines.push('');
  lines.push('| Path | Title | Status | Load (ms) | Console errors | Failed requests | Forms | Buttons | Links | Inputs | h1 | Landmark | Locators |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :-: | :-: | ---: |');
  for (const p of r.crawl.pages) {
    lines.push(`| \`${md(p.path)}\` | ${md(p.title) || '(untitled)'} | ${p.status} | ${p.loadTimeMs} | ${p.consoleErrors.length} | ${p.failedRequests.length} | ${p.counts.forms} | ${p.counts.buttons} | ${p.counts.links} | ${p.counts.inputs} | ${p.hasH1 ? 'yes' : 'no'} | ${p.hasLandmark ? 'yes' : 'no'} | ${p.elements.length} |`);
  }
  if (!r.crawl.pages.length) lines.push('| (no pages rendered) | | | | | | | | | | | | |');
  lines.push('');
  if (r.crawl.brokenLinks.length) {
    lines.push('### Broken links');
    lines.push('');
    lines.push('| URL | Status | Found on |');
    lines.push('| --- | ---: | --- |');
    for (const b of r.crawl.brokenLinks) lines.push(`| ${md(b.url)} | ${b.status || md(b.error)} | ${md(b.referrer)} |`);
    lines.push('');
  }
  if (r.crawl.skipped.length) {
    lines.push(`${r.crawl.skipped.length} discovered link(s) were not visited because \`max_pages\` was reached.`);
    lines.push('');
  }

  lines.push('## Findings by severity');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('| --- | ---: |');
  for (const s of SEVERITIES) lines.push(`| ${s} | ${counts[s]} |`);
  lines.push('');
  for (const s of SEVERITIES) {
    const group = r.findings.filter(f => f.severity === s);
    if (!group.length) continue;
    lines.push(`### ${s} (${group.length})`);
    lines.push('');
    for (const f of group) {
      lines.push(`- **[${f.category}]** ${f.title}${f.detail ? ` — ${f.detail}` : ''}`);
    }
    lines.push('');
  }
  if (!r.findings.length) { lines.push('No findings recorded.'); lines.push(''); }

  lines.push('## Locator inventory');
  lines.push('');
  lines.push(`${totalLocators(r.crawl.pages)} interactive elements across ${r.crawl.pages.length} page(s). Strategy counts:`);
  lines.push('');
  const strat = new Map<string, number>();
  for (const p of r.crawl.pages) for (const e of p.elements) strat.set(e.locator.strategy, (strat.get(e.locator.strategy) ?? 0) + 1);
  lines.push('| Strategy | Count |');
  lines.push('| --- | ---: |');
  for (const s of ['role', 'label', 'placeholder', 'text', 'testid', 'css']) lines.push(`| ${s} | ${strat.get(s) ?? 0} |`);
  lines.push('');
  for (const p of r.crawl.pages) {
    if (!p.elements.length) continue;
    lines.push(`### \`${md(p.path)}\``);
    lines.push('');
    lines.push('| Property | Locator | Confidence |');
    lines.push('| --- | --- | --- |');
    for (const e of p.elements) lines.push(`| \`${e.property}\` | \`${md(e.locator.code)}\` | ${e.locator.confidence} |`);
    lines.push('');
  }

  lines.push('## Provisioned files');
  lines.push('');
  for (const f of r.infraFiles) lines.push(`- \`${f}\``);
  lines.push('');

  lines.push('## Next steps');
  lines.push('');
  lines.push(`1. \`cd ${r.infraDir} && npm install && npx playwright install --with-deps && npm test\` — the smoke suite should be green on the first run; any red test is a real regression or a finding above.`);
  lines.push('2. Triage the critical/high findings first (broken links, navigation failures, console errors).');
  lines.push('3. Replace low-confidence CSS locators with accessible names or `data-testid` attributes in the app, then regenerate.');
  lines.push('4. Commit the `infra/` directory to the application repository so the GitHub Actions workflow runs on every pull request.');
  lines.push('5. Connect an MCP client to `.mcp.json` and extend coverage to the flows the smoke suite does not touch (forms, authentication, checkout-style journeys).');
  lines.push('');
  return lines.join('\n');
}

export function buildReportJson(r: ReportInput) {
  return {
    agent: 'forward-deployed-tester',
    org_slug: r.orgSlug,
    target_url: r.targetUrl,
    run_id: r.runId,
    generated_at: r.generatedAt,
    summary: r.summary,
    crawl: {
      origin: r.crawl.origin,
      start_url: r.crawl.startUrl,
      duration_ms: r.crawl.durationMs,
      pages_crawled: r.crawl.pages.length,
      skipped: r.crawl.skipped,
      broken_links: r.crawl.brokenLinks,
      pages: r.crawl.pages.map(p => ({
        url: p.url, path: p.path, title: p.title, status: p.status, load_time_ms: p.loadTimeMs,
        console_errors: p.consoleErrors, failed_requests: p.failedRequests, counts: p.counts,
        has_h1: p.hasH1, h1_text: p.h1Text, has_landmark: p.hasLandmark,
        images_missing_alt: p.imagesMissingAlt, unlabeled_inputs: p.unlabeledInputs, forms_without_labels: p.formsWithoutLabels,
        locators: p.elements.map(e => ({ property: e.property, strategy: e.locator.strategy, code: e.locator.code, confidence: e.locator.confidence, role: e.locator.role, name: e.locator.name })),
      })),
    },
    findings_by_severity: countBySeverity(r.findings),
    findings: r.findings.map(f => ({ id: f.id, severity: f.severity, category: f.category, title: f.title, detail: f.detail, evidence: f.evidence_json ? JSON.parse(f.evidence_json) : null })),
    locators_total: totalLocators(r.crawl.pages),
    infra_dir: r.infraDir,
    infra_files: r.infraFiles,
  };
}
