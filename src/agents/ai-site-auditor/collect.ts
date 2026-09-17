// Collection: everything the rules need, gathered once. Site-level facts come from plain HTTP
// fetches; each page is then seen twice in Chromium — once with JavaScript off, fed the exact raw
// HTML a non-rendering crawler receives, and once normally.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { randomUUID } from 'node:crypto';
import { AI_BOTS, UA_PROBE_BOTS } from './bots.js';
import { parseRobots } from './robots.js';
import { checkLlmsTxt, findSecrets, parseSitemap } from './parse.js';
import { DESIGN_SCRIPT } from './design.js';
import type { DesignRaw } from './design.js';
import { ESSENTIALS_SCRIPT } from './essentials.js';
import type { EssentialsRaw } from './essentials.js';
import type { BotProbe, FetchResult, PageAudit, PageView, SiteFacts } from './types.js';

export const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ai-site-auditor/1.0';
const MAX_BODY = 3 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 8 * 1024 * 1024;
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|pdf|zip|gz|mp4|mp3|woff2?|ttf|xml|txt|json|csv)$/i;

export interface CollectOptions {
  startUrl: string;
  maxPages: number;
  timeoutMs: number;
  headless: boolean;
  log?: (m: string) => void;
}

/** GET with a timeout and a size cap. Never throws: failures come back as status 0 with `error`. */
export async function fetchText(url: string, opts: { ua?: string; timeoutMs: number; redirect?: 'follow' | 'manual' }): Promise<FetchResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': opts.ua ?? BROWSER_UA, accept: 'text/html,application/xhtml+xml,*/*' }, redirect: opts.redirect ?? 'follow', signal: AbortSignal.timeout(opts.timeoutMs) });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    let body = '';
    if (opts.redirect !== 'manual') {
      const buf = Buffer.from(await res.arrayBuffer());
      body = buf.subarray(0, MAX_BODY).toString('utf8');
    }
    return { url, finalUrl: res.url || url, status: res.status, headers, body, ms: Date.now() - t0 };
  } catch (err) {
    return { url, finalUrl: url, status: 0, headers: {}, body: '', ms: Date.now() - t0, error: err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err) };
  }
}

export function normaliseUrl(raw: string, base: string): string | undefined {
  let u: URL;
  try { u = new URL(raw, base); } catch { return undefined; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

/** Rough word count of visible text in raw HTML, without a browser (for the bot user-agent probe). */
export function wordsInHtml(html: string): number {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
}

/**
 * Runs in the page (either view). Plain JavaScript source so no transpiler helpers leak in.
 * Signature: () => PageView
 */
export const EXTRACT_SCRIPT = String.raw`() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const meta = (sel) => { const el = document.querySelector(sel); return el ? norm(el.getAttribute('content')) || undefined : undefined; };
  const body = document.body;
  const text = body ? norm(body.innerText || body.textContent || '') : '';
  const words = text ? text.split(' ').filter((w) => /[A-Za-z0-9]/.test(w)).length : 0;
  // copy for placeholder checks: form labels, controls and scripts removed ("Company Name" as a field label is not placeholder copy)
  let copy = '';
  if (body) { const c = body.cloneNode(true); c.querySelectorAll('form,label,input,select,textarea,button,option,script,style,noscript,template').forEach((n) => n.remove()); copy = norm(c.textContent || ''); }
  const types = []; let errors = 0; const blocks = document.querySelectorAll('script[type="application/ld+json"]');
  const collect = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(collect); return; }
    const t = node['@type']; if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.push(String(x)));
    if (node['@graph']) collect(node['@graph']);
  };
  blocks.forEach((b) => { try { collect(JSON.parse(b.textContent || '')); } catch (e) { errors++; } });
  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const imgs = Array.from(document.querySelectorAll('img'));
  const html = document.documentElement ? document.documentElement.outerHTML : '';
  return {
    title: norm(document.title),
    metaDescription: meta('meta[name="description" i]'),
    canonical: (document.querySelector('link[rel="canonical" i]') || {}).href || undefined,
    robotsMeta: [meta('meta[name="robots" i]'), meta('meta[name="googlebot" i]')].filter(Boolean).join(', ') || undefined,
    lang: (document.documentElement.getAttribute('lang') || '').trim() || undefined,
    viewport: !!document.querySelector('meta[name="viewport" i]'),
    h1: Array.from(document.querySelectorAll('h1')).map((h) => norm(h.textContent)).filter(Boolean),
    headings: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
    words,
    textSample: copy.slice(0, 3000),
    links: anchors.map((a) => a.href).filter((h) => /^https?:/i.test(h)),
    hashRouteLinks: anchors.filter((a) => /^#!?\//.test(a.getAttribute('href') || '')).length,
    images: imgs.length,
    imagesMissingAlt: imgs.filter((i) => !i.hasAttribute('alt') && i.getAttribute('role') !== 'presentation' && i.getAttribute('aria-hidden') !== 'true').length,
    jsonLd: { types, errors, blocks: blocks.length },
    og: { title: meta('meta[property="og:title"]'), description: meta('meta[property="og:description"]'), image: meta('meta[property="og:image"]'), url: meta('meta[property="og:url"]'), type: meta('meta[property="og:type"]') },
    twitterCard: meta('meta[name="twitter:card"]'),
    hreflang: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
    favicon: !!document.querySelector('link[rel~="icon" i]'),
    generator: meta('meta[name="generator" i]'),
    html: html.slice(0, 400000),
  };
}`;

async function extract(page: Page): Promise<PageView> {
  return await page.evaluate(`(${EXTRACT_SCRIPT})()`) as PageView;
}

/** The JavaScript-off view of exactly this raw response. */
async function rawView(ctx: BrowserContext, url: string, raw: FetchResult): Promise<PageView> {
  const page = await ctx.newPage();
  try {
    await page.route(u => u.href === url, route => route.fulfill({ status: raw.status || 200, contentType: raw.headers['content-type'] ?? 'text/html', body: raw.body }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return await extract(page);
  } finally {
    await page.close();
  }
}

async function renderedView(ctx: BrowserContext, url: string, timeoutMs: number): Promise<Omit<PageAudit, 'url' | 'path' | 'status' | 'raw'>> {
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: { url: string; status: number }[] = [];
  const mixedContent: string[] = [];
  const scripts = new Set<string>();
  let jsBytes = 0;
  const origin = new URL(url).origin;
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('response', r => {
    const u = r.url();
    if (r.status() >= 400 && u !== url) failedRequests.push({ url: u, status: r.status() });
    if (url.startsWith('https:') && u.startsWith('http:')) mixedContent.push(u);
    if (r.request().resourceType() === 'script' && u.startsWith(origin)) scripts.add(u);
  });
  page.on('requestfinished', req => {
    if (req.resourceType() !== 'script') return;
    req.sizes().then(s => { if (s.responseBodySize > 0) jsBytes += s.responseBodySize; }).catch(() => undefined);
  });
  const t0 = Date.now();
  try {
    // Do not wait for the load event: one slow image or tracker can hold it forever. Parse, then give
    // load and network idle a bounded chance so client-rendered content has time to appear.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    let loadTimedOut = false;
    await page.waitForLoadState('load', { timeout: Math.min(8000, timeoutMs) }).catch(() => { loadTimedOut = true; });
    await page.waitForLoadState('networkidle', { timeout: Math.min(3000, timeoutMs) }).catch(() => undefined);
    const view = await extract(page);
    // Design tells need computed styles and the CSSOM, so they are measured in the live page.
    // A failure here must never lose the page: the area is simply not scored.
    const design = await (page.evaluate(`(${DESIGN_SCRIPT})()`) as Promise<DesignRaw>).catch(() => undefined);
    const essentials = await (page.evaluate(`(${ESSENTIALS_SCRIPT})()`) as Promise<EssentialsRaw>).catch(() => undefined);
    return { rendered: view, design, essentials, loadMs: Date.now() - t0, loadTimedOut, consoleErrors, failedRequests, mixedContent, scripts: [...scripts], jsBytes };
  } catch (err) {
    return { loadMs: Date.now() - t0, consoleErrors, failedRequests, mixedContent, scripts: [...scripts], jsBytes, error: err instanceof Error ? err.message.split('\n')[0] : String(err) };
  } finally {
    await page.close();
  }
}

function looksBlocked(r: FetchResult): boolean {
  if (r.status === 0 || r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500) return true;
  return /cf-chl|challenge-platform|Just a moment\.\.\.|Attention Required|captcha/i.test(r.body.slice(0, 20000));
}

export async function collect(opts: CollectOptions): Promise<SiteFacts> {
  const log = opts.log ?? (() => undefined);
  const t0 = Date.now();
  const startUrl = normaliseUrl(opts.startUrl, opts.startUrl);
  if (!startUrl) throw new Error(`invalid target_url: ${opts.startUrl}`);
  const start = new URL(startUrl);
  const origin = start.origin;
  const f = (path: string, ua?: string) => fetchText(new URL(path, origin).toString(), { ua, timeoutMs: opts.timeoutMs });

  // ── site-level facts, no browser ─────────────────────────────────────────
  log('site: robots.txt, sitemap, llms.txt, soft-404 probe, headers');
  const [robotsRes, llmsRes, notFound, envRes, home] = await Promise.all([
    f('/robots.txt'), f('/llms.txt'), f(`/ai-site-auditor-${randomUUID().slice(0, 8)}-not-a-page`), f('/.env'), fetchText(startUrl, { timeoutMs: opts.timeoutMs }),
  ]);
  // status -1 = an HTML page came back for /robots.txt (an SPA catch-all), which crawlers treat as no file
  const robotsIsHtml = robotsRes.status === 200 && /<html|<!doctype/i.test(robotsRes.body.slice(0, 500));
  const robotsText = robotsRes.status === 200 && !robotsIsHtml ? robotsRes.body : '';
  const robots = robotsRes.status ? { status: robotsIsHtml ? -1 : robotsRes.status, text: robotsText, parsed: parseRobots(robotsText) } : undefined;

  // Only this origin is ever fetched. A Sitemap: line pointing at another host (common on a staging copy
  // of a production site) is recorded, not followed, so auditing staging never touches production.
  const declared = robots?.parsed.sitemaps ?? [];
  const sameOrigin = (u: string) => { try { return new URL(u, origin).origin === origin; } catch { return false; } };
  const offHost = declared.filter(u => !sameOrigin(u));
  const sitemapUrls = declared.filter(sameOrigin).length ? declared.filter(sameOrigin) : [new URL('/sitemap.xml', origin).toString()];
  const sitemaps: SiteFacts['sitemaps'] = offHost.map(u => ({ url: u, status: 0, kind: 'other-host', urls: 0, sampleBroken: [] }));
  const sitemapPages: string[] = [];
  for (const sm of sitemapUrls.slice(0, 3)) {
    const r = await fetchText(sm, { timeoutMs: opts.timeoutMs });
    const parsed = r.status === 200 ? parseSitemap(r.body) : { kind: 'unknown' as const, locs: [] };
    let locs = parsed.locs;
    if (parsed.kind === 'index') {
      const child = locs[0] && sameOrigin(locs[0]) ? await fetchText(locs[0], { timeoutMs: opts.timeoutMs }) : undefined;
      locs = child && child.status === 200 ? parseSitemap(child.body).locs : [];
    }
    const sampleBroken: string[] = [];
    for (const loc of locs.filter(sameOrigin).slice(0, 5)) {
      const c = await fetchText(loc, { timeoutMs: opts.timeoutMs, redirect: 'manual' });
      if (c.status >= 400 || c.status === 0) sampleBroken.push(`${loc} (${c.status || c.error})`);
    }
    sitemaps.push({ url: sm, status: r.status, kind: parsed.kind, urls: locs.length, sampleBroken });
    sitemapPages.push(...locs);
  }

  const llms = llmsRes.status === 200 ? { status: 200, ...checkLlmsTxt(llmsRes.body) } : { status: llmsRes.status, ok: false, links: 0, problems: [] };
  const envLooks = envRes.status === 200 && /^[A-Z][A-Z0-9_]{2,}\s*=\s*\S/m.test(envRes.body.slice(0, 5000)) && !/<html/i.test(envRes.body.slice(0, 500));
  let httpRedirect: SiteFacts['httpRedirect'];
  if (start.protocol === 'https:') {
    const r = await fetchText(startUrl.replace(/^https:/, 'http:'), { timeoutMs: opts.timeoutMs, redirect: 'manual' });
    httpRedirect = { status: r.status, location: r.headers.location };
  }

  log('site: probing with AI crawler user agents');
  const botProbes: BotProbe[] = [];
  for (const bot of UA_PROBE_BOTS) {
    const r = await fetchText(startUrl, { ua: bot.userAgent, timeoutMs: opts.timeoutMs });
    botProbes.push({ token: bot.token, status: r.status, words: wordsInHtml(r.body), blockedLike: looksBlocked(r) && !looksBlocked(home), error: r.error });
  }

  // ── pages, two views each ────────────────────────────────────────────────
  const browser: Browser = await chromium.launch({ headless: opts.headless });
  const pages: PageAudit[] = [];
  const skipped: string[] = [];
  const secrets: SiteFacts['secrets'] = [];
  const sourceMaps: string[] = [];
  try {
    const renderCtx = await browser.newContext({ userAgent: BROWSER_UA, ignoreHTTPSErrors: true });
    const rawCtx = await browser.newContext({ userAgent: BROWSER_UA, javaScriptEnabled: false, ignoreHTTPSErrors: true });
    renderCtx.setDefaultTimeout(opts.timeoutMs);
    rawCtx.setDefaultTimeout(opts.timeoutMs);

    const queue: string[] = [startUrl];
    const seen = new Set<string>([startUrl]);
    const enqueue = (u: string | undefined) => {
      if (!u || seen.has(u)) return;
      const p = new URL(u);
      if (p.origin !== origin || ASSET_EXT.test(p.pathname)) return;
      seen.add(u); queue.push(u);
    };
    for (const s of sitemapPages) enqueue(normaliseUrl(s, origin));

    const scannedScripts = new Set<string>();
    let scriptBytes = 0;
    while (queue.length) {
      const url = queue.shift()!;
      if (pages.length >= opts.maxPages) { skipped.push(url); continue; }
      log(`page: ${url}`);
      const raw = url === startUrl ? home : await fetchText(url, { timeoutMs: opts.timeoutMs });
      const u = new URL(url);
      const audit: PageAudit = { url, path: u.pathname + u.search, status: raw.status, contentType: raw.headers['content-type'], loadMs: 0, consoleErrors: [], failedRequests: [], mixedContent: [], scripts: [], jsBytes: 0, error: raw.error };
      if (raw.status && /html/i.test(raw.headers['content-type'] ?? 'text/html')) {
        audit.raw = await rawView(rawCtx, url, raw).catch(() => undefined);
        Object.assign(audit, await renderedView(renderCtx, url, opts.timeoutMs));
      }
      pages.push(audit);
      for (const l of audit.rendered?.links ?? []) enqueue(normaliseUrl(l, url));

      for (const s of audit.scripts) {
        if (scannedScripts.has(s) || scriptBytes > MAX_SCRIPT_BYTES) continue;
        scannedScripts.add(s);
        const js = await fetchText(s, { timeoutMs: opts.timeoutMs });
        scriptBytes += js.body.length;
        for (const hit of findSecrets(js.body)) secrets.push({ script: new URL(s).pathname, ...hit });
        if (/\/\/# sourceMappingURL=(?!data:)\S+\.map/.test(js.body.slice(-500))) {
          const mapUrl = s + '.map';
          const m = await fetchText(mapUrl, { timeoutMs: opts.timeoutMs, redirect: 'manual' });
          if (m.status === 200) sourceMaps.push(new URL(mapUrl).pathname);
        }
      }
    }
    await renderCtx.close();
    await rawCtx.close();
  } finally {
    await browser.close().catch(() => undefined);
  }

  const h = home.headers;
  return {
    origin, startUrl, https: start.protocol === 'https:',
    robots, sitemaps,
    llmsTxt: llms,
    softNotFound: {
      url: notFound.url, status: notFound.status,
      title: /<title[^>]*>([^<]*)</i.exec(notFound.body)?.[1]?.trim() ?? '',
      words: wordsInHtml(notFound.body),
      links: (notFound.body.match(/<a\s[^>]*href=/gi) ?? []).length,
    },
    httpRedirect,
    envExposed: { status: envRes.status, looksLikeEnv: envLooks },
    securityHeaders: {
      'strict-transport-security': h['strict-transport-security'],
      'x-content-type-options': h['x-content-type-options'],
      'content-security-policy': h['content-security-policy'],
      'x-frame-options': h['x-frame-options'],
      'referrer-policy': h['referrer-policy'],
    },
    botProbes, secrets, sourceMaps, pages, skipped,
    durationMs: Date.now() - t0,
  };
}

export { AI_BOTS };
