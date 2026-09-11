// Pure: turn a crawl result into findings. The agent persists them with ctx.db.addFinding.
import type { Severity } from '../../core/db.js';
import type { CrawlResult } from './types.js';

export interface FindingDraft { severity: Severity; category: string; title: string; detail?: string; evidence?: unknown }

export const SLOW_PAGE_MS = 3000;

export function deriveFindings(crawl: CrawlResult): FindingDraft[] {
  const out: FindingDraft[] = [];

  for (const b of crawl.brokenLinks) {
    if (b.status === 0) {
      out.push({ severity: 'high', category: 'navigation', title: `Navigation failed: ${b.url}`, detail: `${b.error ?? 'unknown error'} (linked from ${b.referrer})`, evidence: b });
    } else {
      out.push({
        severity: b.status >= 500 ? 'high' : 'medium', category: 'broken-link',
        title: `Broken link (${b.status}): ${b.url}`, detail: `Linked from ${b.referrer}`, evidence: b,
      });
    }
  }

  for (const p of crawl.pages) {
    if (p.consoleErrors.length) {
      out.push({
        severity: 'medium', category: 'console-error',
        title: `${p.consoleErrors.length} console error${p.consoleErrors.length === 1 ? '' : 's'} on ${p.path}`,
        detail: p.consoleErrors.slice(0, 3).join(' | '), evidence: { url: p.url, errors: p.consoleErrors },
      });
    }
    if (p.failedRequests.length) {
      const worst = Math.max(...p.failedRequests.map(f => f.status));
      out.push({
        severity: worst >= 500 ? 'medium' : 'low', category: 'failed-request',
        title: `${p.failedRequests.length} failed network request${p.failedRequests.length === 1 ? '' : 's'} on ${p.path}`,
        detail: p.failedRequests.slice(0, 3).map(f => `${f.status} ${f.method} ${f.url}`).join(' | '),
        evidence: { url: p.url, requests: p.failedRequests },
      });
    }
    if (p.loadTimeMs > SLOW_PAGE_MS) {
      out.push({
        severity: p.loadTimeMs > SLOW_PAGE_MS * 3 ? 'high' : 'medium', category: 'performance',
        title: `Slow page load (${p.loadTimeMs} ms) on ${p.path}`, detail: `Threshold is ${SLOW_PAGE_MS} ms`, evidence: { url: p.url, load_time_ms: p.loadTimeMs },
      });
    }
    if (p.formsWithoutLabels > 0) {
      out.push({
        severity: 'medium', category: 'accessibility',
        title: `${p.formsWithoutLabels} form${p.formsWithoutLabels === 1 ? '' : 's'} with unlabeled controls on ${p.path}`,
        detail: `${p.unlabeledInputs} control${p.unlabeledInputs === 1 ? '' : 's'} lack a <label>, aria-label or placeholder; screen readers and getByLabel() cannot target them`,
        evidence: { url: p.url, forms_without_labels: p.formsWithoutLabels, unlabeled_inputs: p.unlabeledInputs },
      });
    } else if (p.unlabeledInputs > 0) {
      out.push({
        severity: 'low', category: 'accessibility',
        title: `${p.unlabeledInputs} unlabeled form control${p.unlabeledInputs === 1 ? '' : 's'} outside a form on ${p.path}`,
        evidence: { url: p.url, unlabeled_inputs: p.unlabeledInputs },
      });
    }
    if (p.imagesMissingAlt > 0) {
      out.push({
        severity: 'low', category: 'accessibility',
        title: `${p.imagesMissingAlt} image${p.imagesMissingAlt === 1 ? '' : 's'} without alt text on ${p.path}`,
        detail: 'Add alt="" for decorative images or a description for meaningful ones',
        evidence: { url: p.url, images_missing_alt: p.imagesMissingAlt, images_total: p.counts.images },
      });
    }
    if (!p.hasH1) {
      out.push({ severity: 'low', category: 'structure', title: `No <h1> on ${p.path}`, detail: 'Every page should have exactly one level-1 heading; the smoke test cannot assert on a heading until one exists', evidence: { url: p.url } });
    }
    if (!p.hasLandmark) {
      out.push({ severity: 'low', category: 'accessibility', title: `No landmark regions on ${p.path}`, detail: 'Add <main>, <nav>, <header> or <footer> (or the equivalent roles) so assistive tech can navigate by region', evidence: { url: p.url } });
    }
    const lowConfidence = p.elements.filter(e => e.locator.confidence === 'low').length;
    if (lowConfidence > 0 && p.elements.length > 0 && lowConfidence / p.elements.length >= 0.5) {
      out.push({
        severity: 'info', category: 'testability',
        title: `${lowConfidence}/${p.elements.length} interactive elements on ${p.path} lack an accessible name or test id`,
        detail: 'Page-object locators fell back to CSS; add accessible names or data-testid attributes',
        evidence: { url: p.url, low_confidence: lowConfidence, total: p.elements.length },
      });
    }
  }

  if (!crawl.pages.length) {
    out.push({ severity: 'critical', category: 'navigation', title: 'No page could be rendered', detail: `The start URL ${crawl.startUrl} did not produce a renderable page; check the URL, network access and authentication`, evidence: { start_url: crawl.startUrl } });
  }
  return out;
}
