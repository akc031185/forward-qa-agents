// Reconnaissance: breadth-first same-origin crawl with Playwright. Everything that runs
// inside the browser lives in `harvestPage`, which is serialised and executed in the page.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ElementDescriptor } from './locators.js';
import { deriveLocator, toPropertyName, uniqueNames } from './locators.js';
import type { BrokenLink, CrawlOptions, CrawlResult, FailedRequest, HarvestResult, InteractiveElement, PageRecord } from './types.js';

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|map|pdf|zip|gz|tar|mp4|mp3|wav|woff2?|ttf|eot|xml|rss|json|txt|csv|docx?|xlsx?|pptx?)$/i;
const MAX_ELEMENTS_PER_PAGE = 60;
const MAX_BROKEN_LINK_VISITS = 100;

/** Canonical form of a URL for the queue: same-origin, no hash, no trailing-slash ambiguity. */
export function normaliseUrl(raw: string, base: string): string | undefined {
  let u: URL;
  try { u = new URL(raw, base); } catch { return undefined; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export function isCrawlable(url: string, origin: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.origin !== origin) return false;
  if (ASSET_EXT.test(u.pathname)) return false;
  return true;
}

/**
 * Runs inside the browser. Kept as plain JavaScript source (not a TS function) so no transpiler
 * helpers such as esbuild's `__name` leak into the page, and no Node scope is captured.
 * Signature: (maxElements: number) => HarvestResult
 */
export const HARVEST_SCRIPT = String.raw`(maxElements) => {
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const isVisible = (el) => {
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  };
  const labelFor = (el) => {
    const id = el.getAttribute('id');
    if (id) {
      const lab = document.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]');
      if (lab && norm(lab.textContent)) return norm(lab.textContent);
    }
    const wrap = el.closest('label');
    if (wrap) {
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
      const t = norm(clone.textContent);
      if (t) return t;
    }
    return undefined;
  };
  const accName = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = norm(lb.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' '));
      if (t) return t;
    }
    const al = norm(el.getAttribute('aria-label'));
    if (al) return al;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      const l = labelFor(el);
      if (l) return l;
      const ty = (el.getAttribute('type') || 'text').toLowerCase();
      if (['submit', 'button', 'reset'].includes(ty)) {
        const v = norm(el.value);
        if (v) return v;
        if (ty === 'submit') return 'Submit';
        if (ty === 'reset') return 'Reset';
      }
      if (ty === 'image') { const a = norm(el.getAttribute('alt')); if (a) return a; }
      const t = norm(el.getAttribute('title'));
      if (t) return t;
      const p = norm(el.getAttribute('placeholder'));
      if (p) return p;
      return undefined;
    }
    if (tag === 'img') return norm(el.getAttribute('alt')) || undefined;
    const clone = el.cloneNode(true);
    clone.querySelectorAll('img[alt]').forEach((img) => { img.replaceWith(document.createTextNode(' ' + (img.getAttribute('alt') || '') + ' ')); });
    const t = norm(clone.textContent);
    if (t) return t;
    const ti = norm(el.getAttribute('title'));
    return ti || undefined;
  };

  const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="textbox"], [role="combobox"], [role="switch"], [contenteditable="true"]';
  const elements = [];
  const seen = new Set();
  for (const el of Array.from(document.querySelectorAll(selector))) {
    if (elements.length >= maxElements) break;
    if (seen.has(el) || !isVisible(el)) continue;
    seen.add(el);
    const tag = el.tagName.toLowerCase();
    const attr = (n) => { const v = el.getAttribute(n); return v === null ? undefined : v; };
    const testId = attr('data-testid') ?? attr('data-test-id') ?? attr('data-test') ?? attr('data-cy');
    elements.push({
      tag,
      type: attr('type') ? attr('type').toLowerCase() : undefined,
      role: attr('role'),
      name: accName(el),
      label: (tag === 'input' || tag === 'select' || tag === 'textarea') ? labelFor(el) : undefined,
      placeholder: norm(attr('placeholder')) || undefined,
      text: norm(el.innerText ?? el.textContent).slice(0, 120) || undefined,
      testId,
      id: attr('id'),
      nameAttr: attr('name'),
      classes: Array.from(el.classList).slice(0, 5),
      href: attr('href'),
    });
  }

  const controls = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea'));
  const unlabeled = controls.filter((c) => !labelFor(c) && !norm(c.getAttribute('aria-label')) && !c.getAttribute('aria-labelledby') && !norm(c.getAttribute('placeholder')) && !norm(c.getAttribute('title')));
  const forms = Array.from(document.querySelectorAll('form'));
  const formsWithoutLabels = forms.filter((f) => unlabeled.some((u) => f.contains(u))).length;

  const imgs = Array.from(document.querySelectorAll('img'));
  const imagesMissingAlt = imgs.filter((i) => !i.hasAttribute('alt') && i.getAttribute('role') !== 'presentation' && i.getAttribute('aria-hidden') !== 'true').length;

  const h1 = document.querySelector('h1');
  const hasLandmark = !!document.querySelector('main, [role="main"], header, [role="banner"], nav, [role="navigation"], footer, [role="contentinfo"]');

  const links = Array.from(document.querySelectorAll('a[href]')).map((a) => a.href).filter((h) => /^https?:/i.test(h));

  return {
    title: document.title || '',
    hasH1: !!h1,
    h1Text: h1 ? norm(h1.textContent) : undefined,
    hasLandmark,
    imagesMissingAlt,
    unlabeledInputs: unlabeled.length,
    formsWithoutLabels,
    counts: {
      forms: forms.length,
      buttons: document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').length,
      links: document.querySelectorAll('a[href]').length,
      inputs: controls.length,
      images: imgs.length,
    },
    links: Array.from(new Set(links)),
    elements,
  };
}`;

/** Pure: turn harvested descriptors into locators + unique property names. */
export function buildInteractiveElements(descriptors: ElementDescriptor[]): InteractiveElement[] {
  const locs = descriptors.map(d => ({ descriptor: d, locator: deriveLocator(d) }));
  const names = uniqueNames(locs.map(l => toPropertyName(l.descriptor, l.locator)));
  return locs.map((l, i) => ({ ...l, property: names[i]! }));
}

async function newContext(browser: Browser, opts: CrawlOptions): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    ...(opts.auth?.type === 'basic' ? { httpCredentials: { username: opts.auth.username, password: opts.auth.password } } : {}),
  });
  if (opts.auth?.type === 'cookie') {
    await ctx.addCookies(opts.auth.cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: '/' })));
  }
  ctx.setDefaultTimeout(opts.timeoutMs);
  ctx.setDefaultNavigationTimeout(opts.timeoutMs);
  return ctx;
}

interface VisitOutcome { page?: PageRecord; broken?: BrokenLink }

async function visit(page: Page, url: string, referrer: string, opts: CrawlOptions): Promise<VisitOutcome> {
  const consoleErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];
  const onConsole = (m: { type(): string; text(): string }) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); };
  const onPageError = (e: Error) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`);
  const onResponse = (r: { status(): number; url(): string; request(): { method(): string; resourceType(): string } }) => {
    if (r.status() >= 400 && r.url() !== url) failedRequests.push({ url: r.url(), status: r.status(), method: r.request().method(), resourceType: r.request().resourceType() });
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  const started = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: opts.timeoutMs });
    const loadTimeMs = Date.now() - started;
    const status = response?.status() ?? 200;
    if (status >= 400) return { broken: { url, status, referrer } };
    // Let late console errors and SPA hydration settle briefly, but never longer than the budget.
    await page.waitForLoadState('networkidle', { timeout: Math.min(2000, opts.timeoutMs) }).catch(() => undefined);
    const harvest = await page.evaluate(`(${HARVEST_SCRIPT})(${MAX_ELEMENTS_PER_PAGE})`) as HarvestResult;
    const u = new URL(page.url());
    return {
      page: {
        url,
        path: u.pathname + u.search,
        title: harvest.title,
        status,
        loadTimeMs,
        consoleErrors,
        failedRequests,
        counts: harvest.counts,
        hasLandmark: harvest.hasLandmark,
        hasH1: harvest.hasH1,
        h1Text: harvest.h1Text,
        imagesMissingAlt: harvest.imagesMissingAlt,
        unlabeledInputs: harvest.unlabeledInputs,
        formsWithoutLabels: harvest.formsWithoutLabels,
        elements: buildInteractiveElements(harvest.elements),
        discoveredLinks: harvest.links,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message.split('\n')[0]! : String(err);
    return { broken: { url, status: 0, referrer, error: message } };
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }
}

export async function crawl(opts: CrawlOptions): Promise<CrawlResult> {
  const log = opts.log ?? (() => undefined);
  const started = Date.now();
  const startUrl = normaliseUrl(opts.startUrl, opts.startUrl);
  if (!startUrl) throw new Error(`invalid target_url: ${opts.startUrl}`);
  const origin = new URL(startUrl).origin;

  const browser = await chromium.launch({ headless: opts.headless });
  const pages: PageRecord[] = [];
  const brokenLinks: BrokenLink[] = [];
  const skipped: string[] = [];
  try {
    const context = await newContext(browser, opts);
    const page = await context.newPage();
    const queue: { url: string; referrer: string }[] = [{ url: startUrl, referrer: '(start)' }];
    const seen = new Set<string>([startUrl]);
    let visits = 0;

    while (queue.length) {
      const next = queue.shift()!;
      if (pages.length >= opts.maxPages) { skipped.push(next.url); continue; }
      if (visits >= opts.maxPages + MAX_BROKEN_LINK_VISITS) { skipped.push(next.url); continue; }
      visits++;
      log(`recon: visiting ${next.url}`);
      const outcome = await visit(page, next.url, next.referrer, opts);
      if (outcome.page) {
        pages.push(outcome.page);
        log(`recon: ${outcome.page.status} ${outcome.page.title || '(untitled)'} in ${outcome.page.loadTimeMs} ms, ${outcome.page.elements.length} interactive elements`);
        for (const raw of outcome.page.discoveredLinks) {
          const n = normaliseUrl(raw, next.url);
          if (!n || seen.has(n) || !isCrawlable(n, origin)) continue;
          seen.add(n);
          queue.push({ url: n, referrer: next.url });
        }
      } else if (outcome.broken) {
        brokenLinks.push(outcome.broken);
        log(`recon: broken ${outcome.broken.url} (${outcome.broken.status || outcome.broken.error})`);
      }
    }
    await context.close();
  } finally {
    await browser.close().catch(() => undefined);
  }
  return { origin, startUrl, pages, brokenLinks, skipped, durationMs: Date.now() - started };
}
