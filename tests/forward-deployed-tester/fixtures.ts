// Shared in-memory fixtures for the unit tests (no browser).
import { buildInteractiveElements } from '../../src/agents/forward-deployed-tester/crawler.js';
import type { CrawlResult, PageRecord } from '../../src/agents/forward-deployed-tester/types.js';

export function makePage(over: Partial<PageRecord> & { path: string }): PageRecord {
  return {
    url: `https://app.example.test${over.path}`,
    title: 'Example',
    status: 200,
    loadTimeMs: 420,
    consoleErrors: [],
    failedRequests: [],
    counts: { forms: 0, buttons: 1, links: 2, inputs: 0, images: 0 },
    hasLandmark: true,
    hasH1: true,
    h1Text: 'Welcome',
    imagesMissingAlt: 0,
    unlabeledInputs: 0,
    formsWithoutLabels: 0,
    elements: buildInteractiveElements([
      { tag: 'a', href: '/about', name: 'About us' },
      { tag: 'button', name: 'Sign in' },
      { tag: 'input', type: 'email', label: 'Email' },
    ]),
    discoveredLinks: [],
    ...over,
  };
}

export function makeCrawl(pages: PageRecord[], over: Partial<CrawlResult> = {}): CrawlResult {
  return {
    origin: 'https://app.example.test',
    startUrl: 'https://app.example.test/',
    pages,
    brokenLinks: [],
    skipped: [],
    durationMs: 1234,
    ...over,
  };
}
