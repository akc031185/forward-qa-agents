// The checks. Pure: SiteFacts in, CheckResult[] out. Severity is fixed per rule, never decided by a
// model. A problem seen on several pages is one result that lists the pages, so a 50-page SPA with
// one root cause produces one finding, not fifty.
import { CITATION_BOTS } from './bots.js';
import { isAllowed } from './robots.js';
import { builderSigns, DEFAULT_TITLES, findPlaceholders } from './parse.js';
import {
  buzzwordHits, emDashDensity, emojiHeadings, failingContrast, fontTells,
  spacingOffScale, violetBlueGradients,
} from './design.js';
import { findPolicies, formProblems, looksCommercial, trackingThirdParty, unhelpful404 } from './essentials.js';
import {
  breaksBetweenBreakpoints, clippedText, disappearedContent, findViewport, MIN_TAP_PX,
  NARROWEST_WIDTH, OVERSIZED_RATIO_HIGH, oversizedImages, overflowingWidths, overlappingTapTargets,
  smallTapTargets, TOUCH_WIDTH, WIDEST_WIDTH,
} from './responsive.js';
import type { Area, CheckResult, PageAudit, Severity, SiteFacts } from './types.js';

export const SOURCES = {
  vercelCrawlers: 'https://vercel.com/blog/the-rise-of-the-ai-crawler',
  openaiBots: 'https://developers.openai.com/api/docs/bots',
  anthropicBots: 'https://searchengineland.com/anthropic-claude-bots-470171',
  googleAi: 'https://developers.google.com/search/docs/appearance/ai-features',
  llmsTxt: 'https://llmstxt.org/',
  robotsRfc: 'https://www.rfc-editor.org/rfc/rfc9309',
  softNotFound: 'https://developers.google.com/search/docs/crawling-indexing/http-network-errors#soft-404-errors',
  canonical: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  sitemaps: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview',
  titles: 'https://developers.google.com/search/docs/appearance/title-link',
  snippets: 'https://developers.google.com/search/docs/appearance/snippet',
  structuredData: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  js: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics',
};

/** Minimum rendered words before "invisible without JavaScript" is meaningful. */
export const MIN_RENDERED_WORDS = 10;
/** Raw words below this share of rendered words (and below RAW_FLOOR) means the content arrives by JavaScript. */
export const RAW_SHARE = 0.3;
export const RAW_FLOOR = 5;

/** Pages that loaded. The rendered view is preferred; the raw view stands in when rendering failed. */
const live = (f: SiteFacts) => f.pages.filter(p => p.status > 0 && p.status < 400 && (p.rendered || p.raw));
/** Both views exist, so raw-versus-rendered comparisons are valid. */
const both = (f: SiteFacts) => live(f).filter(p => p.rendered && p.raw);
const v = (p: PageAudit) => (p.rendered ?? p.raw)!;
export function jsOnly(p: PageAudit): boolean {
  const ren = p.rendered?.words ?? 0; const raw = p.raw?.words ?? 0;
  return ren >= MIN_RENDERED_WORDS && raw < Math.max(RAW_FLOOR, ren * RAW_SHARE);
}
const home = (f: SiteFacts) => f.pages[0];
const paths = (ps: PageAudit[]) => ps.map(p => p.path);

function r(id: string, area: Area, severity: Severity, title: string, why: string, fix: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { id, area, severity, title, why, fix, ...extra };
}
function dupes(values: [string, string | undefined][]): { value: string; pages: string[] }[] {
  const by = new Map<string, string[]>();
  for (const [path, v] of values) if (v) by.set(v, [...(by.get(v) ?? []), path]);
  return [...by.entries()].filter(([, ps]) => ps.length > 1).map(([value, pages]) => ({ value, pages }));
}

// ─────────────────────────────────────────── AI visibility: what LLM crawlers can read and cite
function aiVisibility(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  const pages = both(f);
  const h = home(f);

  const invisible = pages.filter(jsOnly);
  if (invisible.length) {
    const onHome = invisible.includes(h!);
    out.push(r('ai.content-needs-javascript', 'ai-visibility', onHome ? 'critical' : 'high',
      `Content only exists after JavaScript runs on ${invisible.length} of ${pages.length} page${pages.length === 1 ? '' : 's'}`,
      'GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot and PerplexityBot fetch the HTML and do not execute JavaScript. They see an empty shell, so there is nothing to quote or cite.',
      'Serve the content in the HTML response: server-side rendering or static generation (Next.js, Astro, TanStack Start, Remix), or prerender every public route at build time.',
      { pages: paths(invisible), source: SOURCES.vercelCrawlers, evidence: invisible.map(p => ({ path: p.path, raw_words: p.raw!.words, rendered_words: p.rendered!.words })) }));
  }

  const titleByJs = pages.filter(p => p.rendered!.title && p.raw && p.raw.title !== p.rendered!.title);
  if (titleByJs.length) out.push(r('ai.title-set-by-javascript', 'ai-visibility', 'high',
    `Page title is changed by JavaScript on ${titleByJs.length} page${titleByJs.length === 1 ? '' : 's'}`,
    'A non-rendering crawler records the shell title from the HTML, so every route is labelled the same way in AI answers.',
    'Emit the final <title> in the HTML for each route.',
    { pages: paths(titleByJs), evidence: titleByJs.slice(0, 10).map(p => ({ path: p.path, raw: p.raw!.title, rendered: p.rendered!.title })) }));

  const h1ByJs = pages.filter(p => p.rendered!.h1.length && !p.raw?.h1.length);
  if (h1ByJs.length) out.push(r('ai.h1-set-by-javascript', 'ai-visibility', 'high',
    `Main heading appears only after JavaScript on ${h1ByJs.length} page${h1ByJs.length === 1 ? '' : 's'}`,
    'The <h1> is the strongest statement of what a page is about. Without JavaScript it is missing.',
    'Render the <h1> server-side.', { pages: paths(h1ByJs) }));

  const descByJs = pages.filter(p => p.rendered!.metaDescription && !p.raw?.metaDescription);
  if (descByJs.length) out.push(r('ai.description-set-by-javascript', 'ai-visibility', 'medium',
    `Meta description is injected by JavaScript on ${descByJs.length} page${descByJs.length === 1 ? '' : 's'}`,
    'Tools such as react-helmet write the description after load; non-rendering crawlers never see it.',
    'Put the description in the HTML response for each route.', { pages: paths(descByJs) }));

  if (f.robots?.status === 200) {
    const blocked = CITATION_BOTS.map(b => ({ bot: b, d: isAllowed(f.robots!.parsed, b.token, '/') })).filter(x => !x.d.allowed);
    if (blocked.length) out.push(r('ai.robots-blocks-citation-bots', 'ai-visibility', 'high',
      `robots.txt blocks ${blocked.map(x => x.bot.token).join(', ')} from the home page`,
      'These are the search and user-fetch agents behind ChatGPT search, Claude and Perplexity answers. Blocking them removes the site from those answers; blocking training bots (GPTBot, ClaudeBot) does not.',
      'Allow the search and user-fetch agents explicitly; disallow only the training agents if that is the policy.',
      { source: SOURCES.openaiBots, evidence: blocked.map(x => ({ bot: x.bot.token, group: x.d.matchedBy, rule: x.d.rule })) }));
  }

  const firewalled = f.botProbes.filter(b => b.blockedLike);
  if (firewalled.length) out.push(r('ai.bot-user-agent-blocked', 'ai-visibility', 'high',
    `The server turns away ${firewalled.map(b => b.token).join(', ')} by user agent`,
    'A browser gets the page, but requests identifying as AI crawlers get an error or a challenge page. robots.txt can allow them and the firewall still says no.',
    'Check CDN or firewall "block AI bots" settings (Cloudflare, Vercel, WAF rules) and allow the agents you want to be cited by.',
    { evidence: firewalled }));

  const hv = h ? (h.rendered ?? h.raw) : undefined;
  if (hv && !hv.jsonLd.blocks) out.push(r('ai.no-structured-data', 'ai-visibility', 'medium',
    'No JSON-LD structured data on the home page',
    'Structured data names the organisation, product or article explicitly. Google says it is not required for AI features, but it is the most reliable way to state facts a machine can quote.',
    'Add an Organization (or LocalBusiness / Product / Article) JSON-LD block in the HTML, matching what the page visibly says.',
    { source: SOURCES.structuredData }));
  const ldErrors = live(f).filter(p => v(p).jsonLd.errors > 0);
  if (ldErrors.length) out.push(r('ai.structured-data-invalid', 'ai-visibility', 'medium',
    `JSON-LD that does not parse on ${ldErrors.length} page${ldErrors.length === 1 ? '' : 's'}`,
    'A block that is not valid JSON is ignored entirely.', 'Validate with the Rich Results Test or schema.org validator.', { pages: paths(ldErrors) }));
  const ldByJs = pages.filter(p => p.rendered!.jsonLd.blocks > 0 && !(p.raw?.jsonLd.blocks));
  if (ldByJs.length) out.push(r('ai.structured-data-by-javascript', 'ai-visibility', 'medium',
    `Structured data is injected by JavaScript on ${ldByJs.length} page${ldByJs.length === 1 ? '' : 's'}`,
    'Only crawlers that render JavaScript will ever read it.', 'Emit the JSON-LD in the HTML response.', { pages: paths(ldByJs) }));

  const noSnippet = live(f).filter(p => /\bnosnippet\b|max-snippet\s*:\s*0\b/i.test(p.rendered?.robotsMeta ?? '') || /\bnosnippet\b|max-snippet\s*:\s*0\b/i.test(p.raw?.robotsMeta ?? ''));
  if (noSnippet.length) out.push(r('ai.nosnippet', 'ai-visibility', 'high',
    `nosnippet or max-snippet:0 on ${noSnippet.length} page${noSnippet.length === 1 ? '' : 's'}`,
    'Google only shows a page as a supporting link in AI Overviews and AI Mode if it is eligible for a snippet.',
    'Remove nosnippet unless it is intentional; use data-nosnippet on the specific passages instead.',
    { pages: paths(noSnippet), source: SOURCES.googleAi }));

  if (f.llmsTxt?.status !== 200) out.push(r('ai.no-llms-txt', 'ai-visibility', 'info',
    'No /llms.txt',
    'llms.txt is a community proposal, not a standard. Coding assistants and some agent tools read it; Google Search ignores it and no major assistant has committed to it.',
    'Optional: add a short markdown index of the pages you want AI tools to read first.', { source: SOURCES.llmsTxt }));
  else if (!f.llmsTxt.ok) out.push(r('ai.llms-txt-malformed', 'ai-visibility', 'low',
    `/llms.txt is present but ${f.llmsTxt.problems.join('; ')}`,
    'A file served as HTML or without links gives a tool nothing to follow.', 'Serve markdown: "# Site name", a one-line summary, then a list of links with descriptions.',
    { source: SOURCES.llmsTxt, evidence: f.llmsTxt }));
  return out;
}

// ─────────────────────────────────────────── Search: classic indexing and ranking signals
function search(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  const pages = live(f);
  const h = home(f);

  if (!f.robots || f.robots.status === 404 || f.robots.status === -1) out.push(r('seo.no-robots-txt', 'search', 'low',
    f.robots?.status === -1 ? '/robots.txt returns an HTML page' : 'No /robots.txt',
    f.robots?.status === -1 ? 'The SPA catch-all answers every path with the app shell, so crawlers get HTML where a robots file should be.' : 'Crawlers assume everything is allowed, which is fine, but there is nowhere to point them at the sitemap.',
    'Serve a plain-text robots.txt with a Sitemap: line.', { source: SOURCES.robotsRfc }));
  else if (f.robots.status === 200 && !isAllowed(f.robots.parsed, 'Googlebot', '/').allowed) out.push(r('seo.robots-blocks-everything', 'search', 'critical',
    'robots.txt blocks Googlebot from the home page',
    'Often a leftover "Disallow: /" from a staging or preview deployment. The site cannot be crawled at all.',
    'Remove the Disallow: / for public deployments.', { source: SOURCES.robotsRfc, evidence: f.robots.text.slice(0, 500) }));

  const offHost = f.sitemaps.filter(s => s.kind === 'other-host');
  if (offHost.length) out.push(r('seo.sitemap-other-host', 'search', 'low',
    `robots.txt points to a sitemap on another host: ${offHost.map(s => s.url).join(', ')}`,
    'Expected on a staging copy of a production site. On the production domain itself it means crawlers are sent elsewhere for the page list. The auditor does not fetch other hosts.',
    'On production, reference this domain\'s own sitemap.', { source: SOURCES.sitemaps }));
  const sitemapOk = f.sitemaps.some(s => s.status === 200 && s.urls > 0);
  if (!sitemapOk && !offHost.length) out.push(r('seo.no-sitemap', 'search', 'medium',
    'No usable sitemap',
    'A sitemap is how crawlers learn about pages that are not linked well, which in an SPA is most of them.',
    'Generate sitemap.xml at build time and reference it from robots.txt.', { source: SOURCES.sitemaps, evidence: f.sitemaps }));
  const brokenInSitemap = f.sitemaps.flatMap(s => s.sampleBroken);
  if (brokenInSitemap.length) out.push(r('seo.sitemap-broken-urls', 'search', 'medium',
    `Sitemap lists URLs that do not load (${brokenInSitemap.length} in a sample)`,
    'Crawlers spend budget on them and trust the sitemap less.', 'Regenerate the sitemap from real routes.', { evidence: brokenInSitemap }));

  if (f.softNotFound.status >= 200 && f.softNotFound.status < 300) out.push(r('seo.soft-404', 'search', 'high',
    'Unknown URLs return 200 instead of 404',
    'The typical SPA catch-all serves the app for any path, so typos and deleted pages look like real pages. Search engines call these soft 404s and AI crawlers index the empty shell under every junk URL.',
    'Return a real 404 status for unknown routes (server config, framework notFound(), or a prerendered 404.html with the right status).',
    { source: SOURCES.softNotFound, evidence: f.softNotFound }));

  if (f.https && f.httpRedirect && !(f.httpRedirect.status >= 300 && f.httpRedirect.status < 400 && /^https:/.test(f.httpRedirect.location ?? ''))) out.push(r('seo.http-not-redirected', 'search', 'medium',
    'http:// does not redirect to https://', 'Two copies of every page, one insecure.', 'Redirect all http requests to https with a 301.', { evidence: f.httpRedirect }));

  const allNoindex = pages.filter(p => /\bnoindex\b/i.test(p.raw?.robotsMeta ?? '') || /\bnoindex\b/i.test(p.rendered?.robotsMeta ?? ''));
  // noindex on a sign-in, registration or account page is correct and deliberate: those pages are
  // not meant to rank. Only pages a visitor is supposed to find are worth reporting.
  const noindex = allNoindex.filter(p => !isPrivatePath(p.path));
  if (noindex.length) out.push(r('seo.noindex', 'search', noindex.includes(h!) ? 'critical' : 'high',
    `noindex on ${noindex.length} page${noindex.length === 1 ? '' : 's'}`,
    'The page will be dropped from search and cannot appear in AI Overviews. Preview deployments often ship with it on.',
    'Remove noindex from pages meant to be public.', { pages: paths(noindex) }));

  const noTitle = pages.filter(p => !v(p).title);
  if (noTitle.length) out.push(r('seo.missing-title', 'search', 'high', `No <title> on ${noTitle.length} page${noTitle.length === 1 ? '' : 's'}`,
    'The title is the link text in search results.', 'Give every route a specific title.', { pages: paths(noTitle), source: SOURCES.titles }));
  const titleDupes = dupes(pages.map(p => [p.path, v(p).title || undefined]));
  if (titleDupes.length) out.push(r('seo.duplicate-titles', 'search', 'medium',
    `Same title on several pages: ${titleDupes.map(d => `"${d.value}" ×${d.pages.length}`).join(', ')}`,
    'Duplicate titles make pages compete with each other and read as the same result.', 'Write one title per route.', { evidence: titleDupes, source: SOURCES.titles }));
  const longTitle = pages.filter(p => v(p).title.length > 65);
  if (longTitle.length) out.push(r('seo.long-title', 'search', 'low', `Title over 65 characters on ${longTitle.length} page${longTitle.length === 1 ? '' : 's'}`,
    'Long titles are truncated in results.', 'Keep titles to about 50–60 characters, key words first.', { pages: paths(longTitle) }));

  const noDesc = pages.filter(p => !v(p).metaDescription);
  if (noDesc.length) out.push(r('seo.missing-description', 'search', 'medium', `No meta description on ${noDesc.length} page${noDesc.length === 1 ? '' : 's'}`,
    'Without one, the snippet is whatever text the engine picks.', 'Write a 140–160 character description per route.', { pages: paths(noDesc), source: SOURCES.snippets }));
  const descDupes = dupes(pages.map(p => [p.path, v(p).metaDescription]));
  if (descDupes.length) out.push(r('seo.duplicate-descriptions', 'search', 'medium',
    `Same meta description on ${descDupes.reduce((n, d) => n + d.pages.length, 0)} pages`,
    'The template default was never replaced per page.', 'Write one description per route.', { evidence: descDupes }));

  const noCanon = pages.filter(p => !v(p).canonical);
  if (noCanon.length) out.push(r('seo.missing-canonical', 'search', 'low', `No canonical link on ${noCanon.length} page${noCanon.length === 1 ? '' : 's'}`,
    'Query strings, trailing slashes and preview hosts create duplicates; a canonical says which URL counts.', 'Add <link rel="canonical"> with the absolute preferred URL.', { pages: paths(noCanon), source: SOURCES.canonical }));
  const canonHome = pages.filter(p => p !== h && v(p).canonical && normalisePath(v(p).canonical!) === normalisePath(h?.url ?? ''));
  if (canonHome.length) out.push(r('seo.canonical-to-home', 'search', 'high',
    `${canonHome.length} page${canonHome.length === 1 ? '' : 's'} declare the home page as canonical`,
    'A canonical baked into the SPA shell tells search engines every route is a duplicate of "/". They will index only the home page.',
    'Set the canonical per route to the route\'s own URL.', { pages: paths(canonHome), source: SOURCES.canonical }));
  const canonOffsite = pages.filter(p => v(p).canonical && safeOrigin(v(p).canonical!) !== f.origin);
  if (canonOffsite.length) {
    const hosts = [...new Set(canonOffsite.map(p => safeHost(v(p).canonical!)))].join(', ');
    // On a local, staging or preview host, canonicals pointing at production are correct.
    const staging = isStagingHost(f.origin);
    out.push(r('seo.canonical-other-host', 'search', staging ? 'info' : 'high',
      staging ? `Canonical points to ${hosts} (expected for a staging or preview copy)` : `Canonical points to another host (${hosts}) on ${canonOffsite.length} page${canonOffsite.length === 1 ? '' : 's'}`,
      staging ? 'This host looks like a local, preview or staging deployment, so pointing canonicals at production is right. Re-run against the production domain to check it there.' : 'Common after deploying a template or moving from a preview domain: the ranking credit goes to the other host.',
      'On production, point canonicals at the production domain itself.', { pages: paths(canonOffsite), evidence: canonOffsite.map(p => v(p).canonical) }));
  }

  const noH1 = pages.filter(p => !v(p).h1.length);
  if (noH1.length) out.push(r('seo.missing-h1', 'search', 'medium', `No <h1> on ${noH1.length} page${noH1.length === 1 ? '' : 's'}`,
    'Generated layouts often style a <div> as the headline.', 'Use one <h1> per page for its main topic.', { pages: paths(noH1) }));
  const manyH1 = pages.filter(p => v(p).h1.length > 1);
  if (manyH1.length) out.push(r('seo.multiple-h1', 'search', 'low', `More than one <h1> on ${manyH1.length} page${manyH1.length === 1 ? '' : 's'}`,
    'Several top-level headings blur what the page is about.', 'Keep one <h1>; demote the rest to <h2>.', { pages: paths(manyH1) }));

  if ((h && v(h)) && !v(h).lang) out.push(r('seo.missing-lang', 'search', 'low', 'No lang attribute on <html>',
    'Language detection falls back to guessing; screen readers too.', 'Set <html lang="en"> (or the right language).'));
  if ((h && v(h)) && !v(h).viewport) out.push(r('seo.missing-viewport', 'search', 'medium', 'No viewport meta tag',
    'Mobile-first indexing treats the page as not mobile-friendly.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'));

  const hashRoutes = pages.filter(p => v(p).hashRouteLinks > 0);
  if (hashRoutes.length) out.push(r('seo.hash-routes', 'search', 'high', 'Navigation uses #/ hash routes',
    'Everything after # is never sent to the server; to every crawler all routes are the same URL.', 'Switch to history (path) routing with a server that serves each path.',
    { pages: paths(hashRoutes), source: SOURCES.js }));

  if ((h && v(h)) && (!v(h).og.title || !v(h).og.image)) out.push(r('seo.missing-open-graph', 'search', 'low',
    `Open Graph ${[!v(h).og.title && 'og:title', !v(h).og.image && 'og:image'].filter(Boolean).join(' and ')} missing on the home page`,
    'Shared links in chat apps, LinkedIn and AI assistants render as bare URLs.', 'Add og:title, og:description, og:image (1200×630) and twitter:card.'));

  const alt = pages.filter(p => v(p).imagesMissingAlt > 0);
  if (alt.length) out.push(r('seo.images-missing-alt', 'search', 'low',
    `${alt.reduce((n, p) => n + v(p).imagesMissingAlt, 0)} images without alt text across ${alt.length} page${alt.length === 1 ? '' : 's'}`,
    'Alt text is how images are understood by search, AI and screen readers.', 'Describe meaningful images; use alt="" for decorative ones.', { pages: paths(alt) }));

  const broken = f.pages.filter(p => p.status >= 400 || p.status === 0);
  if (broken.length) out.push(r('seo.broken-internal-pages', 'search', 'medium',
    `${broken.length} linked page${broken.length === 1 ? '' : 's'} failed to load`, 'Dead internal links waste crawl budget and trust.', 'Fix or remove the links.',
    { pages: paths(broken), evidence: broken.map(p => ({ path: p.path, status: p.status, error: p.error })) }));
  return out;
}

// ─────────────────────────────────────────── Build: mistakes AI site builders leave behind
function build(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  const pages = live(f);
  const h = home(f);

  if (f.secrets.some(s => s.severity === 'critical')) {
    const crit = f.secrets.filter(s => s.severity === 'critical');
    out.push(r('build.secret-in-javascript', 'build', 'critical',
      `Secret credential shipped in JavaScript: ${[...new Set(crit.map(s => s.kind))].join(', ')}`,
      'Everything in a client bundle is public. AI builders often wire API calls straight from the browser with a real key.',
      'Revoke and rotate the key now, then move the call behind a server route or edge function that holds the key.',
      { evidence: crit.map(s => ({ script: s.script, kind: s.kind, preview: s.preview, note: s.note })) }));
  }
  const infoKeys = f.secrets.filter(s => s.severity === 'info');
  if (infoKeys.length) out.push(r('build.public-browser-keys', 'build', 'info',
    `${infoKeys.length} browser API key${infoKeys.length === 1 ? '' : 's'} in JavaScript (${[...new Set(infoKeys.map(s => s.kind))].join(', ')})`,
    'Normal for Maps or Firebase, but only safe when restricted.', 'Confirm each key is restricted by HTTP referrer and to the APIs it needs.',
    { evidence: infoKeys.map(s => ({ script: s.script, kind: s.kind, preview: s.preview })) }));

  if (f.envExposed?.looksLikeEnv) out.push(r('build.env-file-public', 'build', 'critical', '/.env is publicly downloadable',
    'The deploy uploaded the project root, environment file included.', 'Delete it from the host, rotate every value in it, and deploy only the build output folder.'));
  if (f.sourceMaps.length) out.push(r('build.source-maps-public', 'build', 'low', `${f.sourceMaps.length} JavaScript source map${f.sourceMaps.length === 1 ? '' : 's'} publicly available`,
    'Anyone can read the original source, comments and all.', 'Disable production source maps or upload them to your error tracker only.', { evidence: f.sourceMaps.slice(0, 10) }));

  const defaults = pages.filter(p => DEFAULT_TITLES.includes(v(p).title.toLowerCase()) || (p.raw && DEFAULT_TITLES.includes(p.raw.title.toLowerCase())));
  if (defaults.length) out.push(r('build.scaffold-title', 'build', 'high',
    `Scaffold default title left in place: "${(defaults[0]!.raw?.title && DEFAULT_TITLES.includes(defaults[0]!.raw.title.toLowerCase()) ? defaults[0]!.raw.title : v(defaults[0]!).title)}"`,
    'The index.html template title was never changed, and it is what every non-rendering crawler records for every route.',
    'Set a real site title in index.html and per-route titles in the HTML.', { pages: paths(defaults) }));

  const placeholder = pages.map(p => ({ p, hits: findPlaceholders(v(p).textSample) })).filter(x => x.hits.length);
  if (placeholder.length) out.push(r('build.placeholder-content', 'build', 'medium',
    `Placeholder copy on ${placeholder.length} page${placeholder.length === 1 ? '' : 's'}: ${[...new Set(placeholder.flatMap(x => x.hits))].join(', ')}`,
    'Generated pages ship with sample names, numbers and addresses that read as real facts to people and to AI answers.',
    'Replace every placeholder with real details or remove the section.', { pages: placeholder.map(x => x.p.path), evidence: placeholder.map(x => ({ path: x.p.path, found: x.hits })) }));

  const signs = (h && v(h)) ? builderSigns(v(h).html) : [];
  if (signs.length) out.push(r('build.builder-fingerprints', 'build', 'low',
    `Builder defaults visible: ${signs.map(s => s.evidence).join(', ')}`,
    'Harmless on their own, but they show the template was published as generated.', 'Remove badges and default favicons; set your own branding.', { evidence: signs }));
  if ((h && v(h)) && !v(h).favicon) out.push(r('build.no-favicon', 'build', 'low', 'No favicon link', 'Browsers fall back to /favicon.ico, often the scaffold default or a 404.', 'Add <link rel="icon">.'));

  const errs = pages.filter(p => p.consoleErrors.length);
  if (errs.length) out.push(r('build.console-errors', 'build', 'medium',
    `JavaScript errors in the console on ${errs.length} page${errs.length === 1 ? '' : 's'}`,
    'A runtime error in a client-rendered page can blank it for users and for Googlebot\'s renderer alike.', 'Fix the errors; add error monitoring.',
    { pages: paths(errs), evidence: errs.map(p => ({ path: p.path, errors: p.consoleErrors.slice(0, 3) })) }));
  const failed = pages.filter(p => p.failedRequests.length);
  if (failed.length) out.push(r('build.failed-requests', 'build', 'low',
    `${failed.reduce((n, p) => n + p.failedRequests.length, 0)} failed network requests across ${failed.length} page${failed.length === 1 ? '' : 's'}`,
    'Missing images, fonts or API calls; often leftovers from the builder\'s preview environment.', 'Fix or remove each failing URL.',
    { pages: paths(failed), evidence: failed.map(p => ({ path: p.path, requests: p.failedRequests.slice(0, 5) })) }));
  const mixed = pages.filter(p => p.mixedContent.length);
  if (mixed.length) out.push(r('build.mixed-content', 'build', 'medium', `http:// resources on an https page (${mixed.length} page${mixed.length === 1 ? '' : 's'})`,
    'Browsers block or warn; images and scripts silently fail.', 'Load every resource over https.', { pages: paths(mixed), evidence: mixed.map(p => p.mixedContent.slice(0, 5)) }));

  const heavy = pages.filter(p => p.jsBytes > 1_000_000);
  if (heavy.length) out.push(r('build.heavy-javascript', 'build', heavy.some(p => p.jsBytes > 3_000_000) ? 'medium' : 'low',
    `More than 1 MB of JavaScript on ${heavy.length} page${heavy.length === 1 ? '' : 's'}`,
    'Slow first paint on phones, and Google renders JavaScript-heavy pages later.', 'Split bundles by route; drop unused UI libraries.',
    { evidence: heavy.map(p => ({ path: p.path, js_kb: Math.round(p.jsBytes / 1024) })) }));

  if (f.https) {
    const missing = Object.entries({ 'strict-transport-security': 'HSTS', 'x-content-type-options': 'nosniff', 'content-security-policy': 'CSP' })
      .filter(([k]) => !f.securityHeaders[k]).map(([, v]) => v);
    if (missing.length) out.push(r('build.security-headers', 'build', 'low', `Missing security headers: ${missing.join(', ')}`,
      'Defaults on most builder hosting leave these off.', 'Set them in the host config (vercel.json, _headers, netlify.toml).', { evidence: f.securityHeaders }));
  }
  return out;
}

function normalisePath(u: string): string {
  try { const x = new URL(u); return x.origin + (x.pathname.replace(/\/+$/, '') || '/'); } catch { return u; }
}
function safeOrigin(u: string): string | undefined { try { return new URL(u).origin; } catch { return undefined; } }
function safeHost(u: string): string { try { return new URL(u).host; } catch { return u; } }
/**
 * Paths that are meant to be private. noindex here is correct practice, not a defect, so the
 * search checks leave them alone rather than telling an owner to expose their login page.
 */
export function isPrivatePath(path: string): boolean {
  return /(^|\/)(?:login|signin|sign-in|log-in|register|signup|sign-up|auth|account|dashboard|admin|checkout|cart|billing|forgot-password|reset-password|verify|logout|onboarding|profile|settings)(?:\/|$|\?)/i.test(path);
}

/** Local, private-network and builder preview hosts, where production canonicals and sitemaps are expected. */
export function isStagingHost(origin: string): boolean {
  const host = safeHost(origin).replace(/:\d+$/, '');
  return /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|\[::1\])$/.test(host)
    || /(^|\.)(staging|preview|dev|test)\./i.test(host)
    || /\.(vercel\.app|netlify\.app|pages\.dev|lovable\.app|lovableproject\.com|bolt\.host|replit\.app|github\.io|web\.app|onrender\.com)$/i.test(host);
}

// ─────────────────────────────────────────── Design: the tells that say nobody touched the scaffold
/**
 * Every tell is counted, never judged by a model. A tell on its own is not a defect — plenty of
 * good sites use Inter — so each check states the count and the page, and severity stays low or
 * medium. The value is the pattern: a site tripping ten of these looks generated because it is.
 */
function design(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  const pages = live(f).filter(p => p.design);
  if (!pages.length) {
    out.push(r('design.not-measured', 'design', 'medium', 'Design could not be measured',
      'Computed styles and the stylesheet could not be read, so none of the design tells were evaluated. This area is not a pass.',
      'Re-run once the page renders; a cross-origin stylesheet alone does not cause this.'));
    return out;
  }
  const d = pages[0]!.design!;
  const D = 'https://www.nngroup.com/articles/visual-design-principles/';
  const many = (n: number, label: string) => `${n} ${label}${n === 1 ? '' : /(s|x|ch|sh)$/.test(label) ? 'es' : 's'}`;

  const vb = violetBlueGradients(d.gradientCss);
  if (vb.length) out.push(r('design.violet-blue-gradient', 'design', 'medium',
    `${many(vb.length, 'violet-to-blue gradient')} on the page`,
    'This exact gradient is the default of almost every AI builder, so visitors who have seen other generated sites recognise it instantly.',
    'Pick a palette from your own brand. If you keep a gradient, move it off the 250–290° violet band.',
    { evidence: vb.slice(0, 4), source: D }));

  if (d.gradientTextCount) out.push(r('design.gradient-hero-text', 'design', 'low',
    `Headline text painted with a gradient (${d.gradientTextCount} element${d.gradientTextCount === 1 ? '' : 's'})`,
    'Gradient-filled headings are a scaffold default and they lower text contrast, which also hurts readability.',
    'Set a solid colour on headings; keep gradients for backgrounds and accents.', { source: D }));

  const emo = emojiHeadings(d.headings);
  if (emo.length) out.push(r('design.emoji-headings', 'design', 'low',
    `${many(emo.length, 'heading')} containing emoji`,
    'Emoji in headings is a generated-copy signature, and screen readers announce each one by name.',
    'Remove them, or move them into body copy where they carry meaning.',
    { evidence: emo, source: D }));

  const tells = fontTells(d.fonts);
  if (tells.length) out.push(r('design.scaffold-fonts', 'design', 'low',
    `Default scaffold font${tells.length === 1 ? '' : 's'}: ${tells.map(t => t.family).join(', ')}`,
    'Inter, Space Grotesk and Instrument Serif are what the generators reach for, so the type alone dates the site.',
    'Choose a typeface that belongs to your brand; even one deliberate change breaks the resemblance.',
    { evidence: tells, source: D }));

  if (d.coloredBorderCards >= 3) out.push(r('design.colored-border-cards', 'design', 'info',
    `${many(d.coloredBorderCards, 'card')} with a saturated coloured border`,
    'Coloured 1px borders on rounded cards are a default component look.',
    'Use a neutral border, or separate cards with space and shadow instead.', { source: D }));

  if (d.glassCount >= 2) out.push(r('design.glassmorphism', 'design', 'info',
    `${many(d.glassCount, 'frosted-glass panel')} (backdrop-filter: blur)`,
    'Glassmorphism reads as a template choice and costs paint performance on low-end devices.',
    'Keep it for one deliberate surface, such as a sticky header, not for every card.', { source: D }));

  if (d.iconRows) out.push(r('design.three-icon-row', 'design', 'info',
    `${many(d.iconRows, 'row')} of exactly three icon-and-heading cells`,
    'The three-feature row is the single most repeated generated layout.',
    'Say the three things in your own structure, or show one real screenshot instead.', { source: D }));

  if (d.badgeAboveH1) out.push(r('design.badge-above-headline', 'design', 'info',
    'A small pill badge sits directly above the headline',
    'The "✨ Now in beta" pill above an H1 is a scaffold hero convention.',
    'Delete it, or replace it with something a visitor needs at that moment.', { source: D }));

  if (d.lucideIcons >= 5) out.push(r('design.lucide-icons', 'design', 'info',
    `${many(d.lucideIcons, 'Lucide icon')}`,
    'Untouched Lucide is the default icon set of every shadcn scaffold.',
    'Pick an icon set that matches your brand weight, or commission a few real ones.', { source: D }));

  if (d.shadcnMarkers >= 10) out.push(r('design.untouched-shadcn', 'design', 'low',
    `${many(d.shadcnMarkers, 'untouched shadcn/ui class')} in the markup`,
    'shadcn/ui is a good starting point, but shipped unchanged it makes every site look like the same site.',
    'Change the radius, spacing scale and colour tokens in your theme file; that alone breaks the resemblance.', { source: D }));

  if (d.scrollFadeCount >= 4) out.push(r('design.fade-in-on-scroll', 'design', 'info',
    `${many(d.scrollFadeCount, 'element')} fading in on scroll`,
    'Fade-on-scroll applied to everything delays content for no reason and is a template default.',
    'Keep motion for one or two moments that deserve emphasis, and respect prefers-reduced-motion.', { source: D }));

  if (d.cursorBeam) out.push(r('design.cursor-beam', 'design', 'info',
    'A cursor-following light effect is wired to a CSS custom property',
    'The beam that follows the pointer is a recognisable generated flourish and does nothing on touch devices.',
    'Remove it; it costs a mousemove handler on every frame.', { source: D }));

  if (d.hoverOpacityRules >= 1) out.push(r('design.hover-opacity', 'design', 'info',
    `${many(d.hoverOpacityRules, 'hover rule')} whose only change is opacity`,
    'Fading opacity is the laziest hover state: it reads as disabled rather than interactive.',
    'Change background or border on hover and keep a visible :focus-visible ring.', { source: D }));

  const sp = spacingOffScale(d.spacingPx);
  if (sp.share >= 0.4 && d.spacingPx.length >= 8) out.push(r('design.inconsistent-spacing', 'design', 'low',
    `${Math.round(sp.share * 100)}% of spacing values sit off any common scale`,
    'Arbitrary padding and margin values are what accumulate when each section is generated separately.',
    'Adopt one scale (4 or 8 px steps) and round every value onto it.',
    { evidence: { offScale: sp.offScale, used: d.spacingPx.length }, source: D }));

  if (d.serifItalicCount >= 2) out.push(r('design.serif-italic-accents', 'design', 'info',
    `${many(d.serifItalicCount, 'italic serif accent')}`,
    'A few italic serif words dropped into a sans headline is a current generated-design cliché.',
    'Emphasise with weight or colour, or commit to the serif properly.', { source: D }));

  const text = pages.map(p => p.rendered?.textSample ?? '').join(' ');
  const buzz = buzzwordHits(text);
  if (buzz.length >= 2) out.push(r('design.buzzword-copy', 'design', 'low',
    `${many(buzz.length, 'generic marketing phrase')}: ${buzz.slice(0, 5).join(', ')}`,
    'Copy that could belong to any product tells a visitor nothing and is the clearest sign the words were generated.',
    'Replace each with something only you could write: a number, a customer, a specific before and after.',
    { evidence: buzz, source: D }));

  const dash = emDashDensity(text);
  if (dash.per1000 >= 4 && dash.count >= 3) out.push(r('design.em-dash-density', 'design', 'info',
    `${dash.count} em dashes in ${dash.words} words (${dash.per1000} per 1,000)`,
    'Dense em-dash punctuation is one of the most reliable tells of unedited generated copy.',
    'Keep the ones that earn their place; make the rest full stops or commas.', { source: D }));

  const contrast = pages.flatMap(p => failingContrast(p.design?.contrastPairs ?? []));
  if (contrast.length) {
    const worst = contrast.sort((a, b) => a.ratio - b.ratio)[0]!;
    out.push(r('design.low-contrast-text', 'design', d.darkBackground ? 'medium' : 'low',
      `${many(contrast.length, 'text sample')} below the WCAG AA contrast minimum${d.darkBackground ? ' (dark theme)' : ''}`,
      `The worst is ${worst.ratio}:1 where ${worst.need}:1 is required. Low-contrast grey-on-dark is the default of most generated dark themes and is unreadable in daylight.`,
      'Raise the text colour until every sample reaches 4.5:1, or 3:1 for text at 24px and above.',
      { evidence: contrast.slice(0, 6), source: 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html' }));
  }

  if (d.grainOverlay) out.push(r('design.grain-over-gradient', 'design', 'info',
    'A noise or grain texture is layered over a gradient',
    'Grain over a gradient is a 2025-era generated-design signature.',
    'Drop the texture, or use it somewhere it carries meaning.', { source: D }));

  return out;
}

// ─────────────────────────────────────────── Responsive: does the layout survive a real viewport
/**
 * Unlike design, these are real functional defects with a fixed severity per rule (scored the
 * same severity-weighted way as ai-visibility/search/build/readiness), not accumulated tells:
 * a page either scrolls sideways on a phone or it does not, and that is worth more than one more
 * gradient. Measured on the first `RESPONSIVE_MAX_PAGES` pages only — see collect.ts.
 */
function responsive(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  const pages = live(f).filter(p => p.responsive?.length);
  if (!pages.length) {
    if (live(f).length) out.push(r('responsive.not-measured', 'responsive', 'medium', 'Responsiveness could not be measured',
      'The page rendered but resizing it to a phone and tablet viewport did not produce readable measurements, so none of these checks ran. This area is not a pass.',
      'Re-run; if it repeats, the page may be replacing its own document after load.'));
    return out;
  }
  const TAP = 'https://developer.apple.com/design/human-interface-guidelines/layout#Platform-considerations';

  const overflow = pages.map(p => ({ p, hits: overflowingWidths(p.responsive!) })).filter(x => x.hits.length);
  if (overflow.length) {
    const widths = [...new Set(overflow.flatMap(x => x.hits.map(h => h.width)))].sort((a, b) => a - b);
    out.push(r('responsive.horizontal-overflow', 'responsive', 'high',
      `Horizontal scroll at ${widths.join(', ')}px on ${overflow.length} page${overflow.length === 1 ? '' : 's'}`,
      'The page is wider than the viewport, so a visitor must scroll sideways to read it. On a phone this reads as a broken page, not a design choice.',
      'Find the element forcing the extra width — a fixed pixel width, an un-wrapped table, or a row that will not wrap — and let it shrink to 100% instead.',
      { pages: paths(overflow.map(x => x.p)), evidence: overflow.map(x => ({ path: x.p.path, widths: x.hits })) }));
  }

  const between = pages.map(p => ({ p, widths: breaksBetweenBreakpoints(p.responsive!) })).filter(x => x.widths.length);
  if (between.length) out.push(r('responsive.breaks-between-breakpoints', 'responsive', 'medium',
    `Layout only overflows between the widths that are normally checked (${[...new Set(between.flatMap(x => x.widths))].join(', ')}px) on ${between.length} page${between.length === 1 ? '' : 's'}`,
    'Clean at 360/390/768/1280/1440 but broken in between means the design was verified only at those exact numbers — a `@media` rule with a gap in it — not across the range a real window can actually be.',
    'Check (or make fluid) the whole range between breakpoints, not just the named ones.',
    { pages: paths(between.map(x => x.p)), evidence: between.map(x => ({ path: x.p.path, widths: x.widths })) }));

  const small = pages.map(p => { const raw = findViewport(p.responsive!, TOUCH_WIDTH); return raw ? { p, hits: smallTapTargets(raw) } : undefined; }).filter((x): x is { p: PageAudit; hits: ReturnType<typeof smallTapTargets> } => !!x && x.hits.length > 0);
  if (small.length) out.push(r('responsive.small-tap-targets', 'responsive', 'medium',
    `${small.reduce((n, x) => n + x.hits.length, 0)} tap target${small.reduce((n, x) => n + x.hits.length, 0) === 1 ? '' : 's'} under ${MIN_TAP_PX}px on ${small.length} page${small.length === 1 ? '' : 's'}`,
    'Apple and Google both set 44 CSS px as the comfortable minimum touch target; smaller than that, a thumb misses and taps the wrong thing.',
    'Increase padding, or min-width/min-height, to at least 44px — the visible icon inside can stay small.',
    { pages: paths(small.map(x => x.p)), evidence: small.flatMap(x => x.hits.slice(0, 6)), source: TAP }));

  const overlap = pages.map(p => { const raw = findViewport(p.responsive!, TOUCH_WIDTH); return raw ? { p, hits: overlappingTapTargets(raw) } : undefined; }).filter((x): x is { p: PageAudit; hits: ReturnType<typeof overlappingTapTargets> } => !!x && x.hits.length > 0);
  if (overlap.length) out.push(r('responsive.overlapping-tap-targets', 'responsive', 'high',
    `${overlap.reduce((n, x) => n + x.hits.length, 0)} pair(s) of overlapping tap targets on ${overlap.length} page${overlap.length === 1 ? '' : 's'}`,
    'Two controls occupying the same space on a phone screen mean a visitor cannot reliably choose between them.',
    'Give overlapping controls their own space, or stack them instead of layering them.',
    { pages: paths(overlap.map(x => x.p)), evidence: overlap.flatMap(x => x.hits.slice(0, 6)) }));

  const clipped = pages.map(p => ({ p, hits: (p.responsive ?? []).flatMap(clippedText) })).filter(x => x.hits.length);
  if (clipped.length) out.push(r('responsive.clipped-text', 'responsive', 'medium',
    `Text cut off with no ellipsis on ${clipped.length} page${clipped.length === 1 ? '' : 's'}`,
    'Content is silently missing rather than truncated with an indication — a visitor has no way to know there was more.',
    'Let the box grow, wrap the text, or add text-overflow: ellipsis so a visitor can tell it was cut.',
    { pages: paths(clipped.map(x => x.p)), evidence: clipped.flatMap(x => x.hits.slice(0, 6)) }));

  const gone = pages.map(p => {
    const wide = findViewport(p.responsive!, WIDEST_WIDTH); const narrow = findViewport(p.responsive!, NARROWEST_WIDTH);
    return wide && narrow ? { p, hits: disappearedContent(wide, narrow) } : undefined;
  }).filter((x): x is { p: PageAudit; hits: ReturnType<typeof disappearedContent> } => !!x && x.hits.length > 0);
  if (gone.length) out.push(r('responsive.disappearing-content', 'responsive', 'high',
    `${gone.reduce((n, x) => n + x.hits.length, 0)} link(s) reachable at ${WIDEST_WIDTH}px missing at ${NARROWEST_WIDTH}px on ${gone.length} page${gone.length === 1 ? '' : 's'}`,
    'Content outside the navigation that a visitor can reach on a laptop is simply gone on a phone, with nothing in its place.',
    'Keep the content reachable at every width, even if it moves into a different layout.',
    { pages: paths(gone.map(x => x.p)), evidence: gone.flatMap(x => x.hits.slice(0, 6)) }));

  const oversized = pages.map(p => { const raw = findViewport(p.responsive!, NARROWEST_WIDTH); return raw ? { p, hits: oversizedImages(raw) } : undefined; }).filter((x): x is { p: PageAudit; hits: ReturnType<typeof oversizedImages> } => !!x && x.hits.length > 0);
  if (oversized.length) {
    const worst = Math.max(...oversized.flatMap(x => x.hits.map(h => h.ratio)));
    out.push(r('responsive.oversized-images', 'responsive', worst >= OVERSIZED_RATIO_HIGH ? 'medium' : 'low',
      `Image(s) served at up to ${worst}× their displayed size on ${oversized.length} page${oversized.length === 1 ? '' : 's'} (measured at ${NARROWEST_WIDTH}px)`,
      'A large source image scaled down by CSS still costs its full download weight; on mobile data that is pure waste for no visual benefit.',
      'Serve a size close to the rendered width — srcset/sizes, or a build-time resize — instead of one large asset for every viewport.',
      { pages: paths(oversized.map(x => x.p)), evidence: oversized.flatMap(x => x.hits.slice(0, 6)) }));
  }

  return out;
}

// ─────────────────────────────────────────── Readiness: what a site needs before it is launched
/**
 * The pre-launch and pre-sale list: policy pages, consent, working forms, spam protection,
 * analytics, contact details, keyboard access. Items that need a human ruling — dark patterns,
 * hidden fees, unsupported claims, fake reviews, font and image licensing, whether the data
 * collected is necessary — are deliberately not here. A deterministic checker cannot judge them,
 * and pretending otherwise would be worse than saying nothing.
 */
function readiness(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  const pages = live(f).filter(p => p.essentials);
  if (!pages.length) {
    if (live(f).length) out.push(r('readiness.not-measured', 'readiness', 'medium', 'Launch readiness could not be measured',
      'The page rendered but its links, forms and third-party scripts could not be read, so none of these checks ran. This area is not a pass.',
      'Re-run; if it repeats, the page is probably replacing its own document after load.'));
    return out;
  }
  const GDPR = 'https://gdpr.eu/privacy-notice/';
  const A11Y = 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html';
  const links = pages.flatMap(p => p.essentials!.links);
  const text = pages.map(p => p.rendered?.textSample ?? '').join(' ');
  const policies = findPolicies(links);
  const commercial = looksCommercial(text, links);
  const thirdParty = [...new Set(pages.flatMap(p => p.essentials!.thirdParty))];
  const tracking = trackingThirdParty(thirdParty);
  const banner = pages.some(p => p.essentials!.cookieBanner);
  const analytics = [...new Set(pages.flatMap(p => p.essentials!.analytics))];
  const forms = pages.flatMap(p => p.essentials!.forms);

  if (!policies.privacy) out.push(r('readiness.no-privacy-policy', 'readiness', 'high',
    'No privacy policy page is linked',
    `Any site that collects a name, an email or an analytics identifier needs one; ${tracking.length ? `this site already loads ${tracking.length} tracking third part${tracking.length === 1 ? 'y' : 'ies'}` : 'app stores, payment providers and ad platforms all require one'}.`,
    'Publish a privacy notice saying what you collect, why, who you share it with and how to get it deleted, and link it in the footer.',
    { evidence: tracking.slice(0, 8), source: GDPR }));

  if (!policies.terms) out.push(r('readiness.no-terms', 'readiness', 'medium',
    'No terms of service page is linked',
    'Terms are what limit your liability and set the rules for accounts, payment and acceptable use. Without them every dispute starts from nothing.',
    'Publish terms covering the service, payment, termination and liability, and link them in the footer.', { source: GDPR }));

  if (tracking.length && !policies.cookies) out.push(r('readiness.no-cookie-policy', 'readiness', 'low',
    `${tracking.length} tracking third part${tracking.length === 1 ? 'y is' : 'ies are'} loaded with no cookie policy`,
    `Named: ${tracking.slice(0, 4).map(t => `${safeHost(t.origin)} (${t.kind})`).join(', ')}.`,
    'List each third party, what it sets and how to opt out.', { evidence: tracking, source: GDPR }));

  if (tracking.length && !banner) out.push(r('readiness.no-consent-banner', 'readiness', 'medium',
    `${tracking.length} tracking third part${tracking.length === 1 ? 'y loads' : 'ies load'} before any consent is asked for`,
    `Under GDPR and the ePrivacy rules, analytics and advertising identifiers need consent before they are set, not after. Loaded: ${tracking.slice(0, 4).map(t => safeHost(t.origin)).join(', ')}.`,
    'Gate these scripts behind a consent choice, or move to an analytics tool that sets no identifier.',
    { evidence: tracking, source: GDPR }));

  if (commercial && !policies.refund) out.push(r('readiness.no-refund-policy', 'readiness', 'low',
    'The site sells something but links no refund or cancellation policy',
    'Card networks and app stores expect one, and its absence is a common chargeback trigger.',
    'State the refund window, what qualifies and how long money takes to come back.', { source: GDPR }));

  if ((commercial || forms.length) && !policies.deletion) out.push(r('readiness.no-data-deletion', 'readiness', 'low',
    'No route for a visitor to have their data deleted',
    'A deletion request is a right under GDPR and CCPA, and a requirement for app-store listings.',
    'Add a "delete my account" route or an email address that is documented in the privacy notice.', { source: GDPR }));

  const problems = formProblems(forms);
  const byKind = (k: string) => problems.filter(p => p.kind === k);
  const unverifiable = byKind('unverifiable-submit');
  if (unverifiable.length) out.push(r('readiness.form-submit-unverified', 'readiness', 'high',
    `${unverifiable.length} form${unverifiable.length === 1 ? '' : 's'} where submissions cannot be traced`,
    `${unverifiable[0]!.detail} A form wired up in JavaScript works perfectly well without an action attribute, so this is not proof of a defect — but it is also not proof it works, and a generated site often ships a form that only looks connected. When it does fail it fails silently: the visitor sees a success message and the enquiry never arrives.`,
    'Submit a real test entry and confirm it reaches you. If nothing is handling it, point the form at an endpoint.',
    { evidence: unverifiable }));

  const noValid = [...byKind('no-validation'), ...byKind('no-required')];
  if (noValid.length) out.push(r('readiness.form-no-validation', 'readiness', 'medium',
    `${noValid.length} form${noValid.length === 1 ? ' accepts' : 's accept'} an empty or malformed submission`,
    noValid[0]!.detail,
    'Mark the fields you need as required and use type="email" so the browser validates for free.', { evidence: noValid }));

  const unlabelled = byKind('unlabelled');
  if (unlabelled.length) out.push(r('readiness.form-unlabelled', 'readiness', 'medium',
    `${unlabelled.length} form${unlabelled.length === 1 ? ' has' : 's have'} controls with no label`,
    `${unlabelled[0]!.detail} Placeholder text is not a label: it disappears as soon as someone types.`,
    'Give every control a <label for>, or an aria-label where the design has no room.',
    { evidence: unlabelled, source: A11Y }));

  const spam = byKind('no-spam-protection');
  if (spam.length) out.push(r('readiness.no-spam-protection', 'readiness', 'medium',
    `${spam.length} form${spam.length === 1 ? '' : 's'} with no spam protection`,
    `${spam[0]!.detail} A public form with no protection fills with bot submissions within days of being indexed.`,
    'Add a honeypot field or a privacy-respecting captcha such as Turnstile or hCaptcha.', { evidence: spam }));

  if (!analytics.length) out.push(r('readiness.no-analytics', 'readiness', 'low',
    'No analytics are installed',
    'Nothing records whether anyone arrives, what they read or where they leave, so there is no way to tell whether a change helped.',
    'Install one analytics tool. A cookieless one (Plausible, Fathom, Umami) avoids the consent problem entirely.'));

  const homeCtas = pages[0]!.essentials!.ctas;
  if (!homeCtas.length) out.push(r('readiness.no-call-to-action', 'readiness', 'medium',
    'The first screen of the home page offers no action',
    'A visitor who is convinced has nothing to click, so the page can only be read and left.',
    'Put one primary action in the first screen and repeat it at the end of the page.'));
  else if (new Set(homeCtas.map(c => c.href)).size > 4) out.push(r('readiness.competing-calls-to-action', 'readiness', 'low',
    `${new Set(homeCtas.map(c => c.href)).size} different actions compete in the first screen`,
    `Offered: ${homeCtas.slice(0, 5).map(c => `"${c.text}"`).join(', ')}. When everything is a call to action, none of them is.`,
    'Choose one primary action; make the rest quieter links.', { evidence: homeCtas.slice(0, 8) }));

  const contact = pages[0]!.essentials!.contact;
  if (!contact.email && !contact.phone) out.push(r('readiness.no-contact-details', 'readiness', 'medium',
    'No way to contact the business is published',
    'A visitor with a question, and a regulator asking who runs the site, both need this. Its absence is also a trust signal buyers read quickly.',
    'Put an email address or a contact form link in the footer.'));
  else if (!contact.company) out.push(r('readiness.no-business-identity', 'readiness', 'low',
    'The footer names no legal entity',
    'Consumer law in the UK, EU and India expects a trading name and address; app stores and payment providers ask for the same.',
    'Add the registered name and address, or the trading name and a contact address.'));

  const nf = f.softNotFound;
  if (unhelpful404(nf.status, nf.title, nf.words, nf.links)) out.push(r('readiness.unhelpful-404', 'readiness', 'low',
    'The 404 page is a dead end',
    `A missing URL returns the right status but shows ${nf.words} words and ${nf.links} links, so a visitor who mistypes or follows an old link has nowhere to go.`,
    'Give the 404 page your navigation, a search box and a link home.',
    { evidence: { title: nf.title, words: nf.words, links: nf.links } }));

  const focus = pages.reduce((n, p) => n + p.essentials!.focusSuppressed, 0);
  if (focus) out.push(r('readiness.focus-outline-removed', 'readiness', 'medium',
    'The keyboard focus outline is removed and never replaced',
    'Anyone navigating by keyboard, including every screen-reader user, loses track of where they are on the page.',
    'Delete the `outline: none`, or pair it with a visible `:focus-visible` style.', { source: A11Y }));

  const clickable = pages.reduce((n, p) => n + p.essentials!.clickableNonButtons, 0);
  if (clickable >= 2) out.push(r('readiness.clickable-non-buttons', 'readiness', 'medium',
    `${clickable} clickable elements are not buttons or links`,
    'A div with a click handler cannot be reached by keyboard or announced by a screen reader, so the action simply does not exist for those visitors.',
    'Use <button> or <a>, or add role="button", tabindex="0" and a key handler.', { source: A11Y }));

  if (thirdParty.length >= 8) out.push(r('readiness.many-third-parties', 'readiness', 'low',
    `The page loads code from ${thirdParty.length} third-party origins`,
    `Each one can read the page, see the visitor and slow the site down. Named: ${thirdParty.slice(0, 6).map(safeHost).join(', ')}.`,
    'Remove what you are not using; self-host fonts; keep the rest listed in the privacy notice.',
    { evidence: thirdParty.slice(0, 20) }));

  return out;
}

/** Audit integrity: a check that could not run must never read as a pass. */
function integrity(f: SiteFacts): CheckResult[] {
  const out: CheckResult[] = [];
  if (!live(f).length) {
    out.push(r('audit.nothing-audited', 'ai-visibility', 'critical', 'No page could be audited',
      `The start URL did not return a usable page (${f.pages.map(p => `${p.path}: ${p.status || p.error}`).join('; ') || 'no response'}). Every score below is meaningless.`,
      'Check the URL, network access and authentication, then run again.', { evidence: f.pages.map(p => ({ path: p.path, status: p.status, error: p.error })) }));
    out.push(r('audit.nothing-audited-search', 'search', 'critical', 'No page could be audited', 'See AI visibility.', 'Run again.'));
    out.push(r('audit.nothing-audited-build', 'build', 'critical', 'No page could be audited', 'See AI visibility.', 'Run again.'));
    out.push(r('audit.nothing-audited-design', 'design', 'critical', 'No page could be audited', 'See AI visibility.', 'Run again.'));
    out.push(r('audit.nothing-audited-responsive', 'responsive', 'critical', 'No page could be audited', 'See AI visibility.', 'Run again.'));
    out.push(r('audit.nothing-audited-readiness', 'readiness', 'critical', 'No page could be audited', 'See AI visibility.', 'Run again.'));
    return out;
  }
  const failed = f.pages.filter(p => p.raw && !p.rendered);
  if (failed.length) out.push(r('build.render-failed', 'build', 'high',
    `${failed.length} page${failed.length === 1 ? '' : 's'} could not be rendered in a browser`,
    'JavaScript-dependent checks were skipped for these pages and the raw HTML was used instead, so their AI-visibility results are incomplete.',
    'Open the page in a browser and check for hangs or errors; raise timeout_ms if the site is just slow.',
    { pages: paths(failed), evidence: failed.map(p => ({ path: p.path, error: p.error })) }));
  const slow = live(f).filter(p => p.loadTimedOut);
  if (slow.length) out.push(r('build.load-never-finished', 'build', 'low',
    `The load event had not fired after 8 s on ${slow.length} page${slow.length === 1 ? '' : 's'}`,
    'Something on the page (often unoptimised images or a third-party script) keeps loading. Content was still audited.',
    'Find the long-running requests in the browser network panel.', { pages: paths(slow) }));
  return out;
}

export function evaluate(f: SiteFacts): CheckResult[] {
  const all = [...integrity(f), ...aiVisibility(f), ...search(f), ...build(f), ...design(f), ...responsive(f), ...readiness(f)];
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  return all.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
}

export const WEIGHTS: Record<Severity, number> = { critical: 40, high: 18, medium: 8, low: 3, info: 0 };
/**
 * Design is scored by accumulation, not severity. No single tell is a defect — plenty of good
 * sites use Inter — so each one costs the same and the pattern is what shows: two tells still
 * grades B, ten grades D, and a page wearing the whole scaffold reaches 0.
 */
export const DESIGN_TELL_COST = 6;
/** Markers that mean the area was not evaluated; they must never read as a pass. */
const NOT_MEASURED = new Set(['design.not-measured', 'audit.nothing-audited-design']);

/** 0–100 per area: 100 minus the weight of each failed check, floored at 0. */
export function scores(results: CheckResult[]): Record<Area, number> {
  const s: Record<Area, number> = { 'ai-visibility': 100, search: 100, build: 100, design: 100, responsive: 100, readiness: 100 };
  for (const x of results) if (x.area !== 'design') s[x.area] = Math.max(0, s[x.area] - WEIGHTS[x.severity]);
  const design = results.filter(x => x.area === 'design');
  s.design = design.some(x => NOT_MEASURED.has(x.id))
    ? 0
    : Math.max(0, 100 - design.length * DESIGN_TELL_COST);
  return s;
}

export function grade(score: number): string {
  return score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
}
