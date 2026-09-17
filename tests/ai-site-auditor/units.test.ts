import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, parseRobots } from '../../src/agents/ai-site-auditor/robots.js';
import { builderSigns, checkLlmsTxt, findPlaceholders, findSecrets, parseSitemap, redact } from '../../src/agents/ai-site-auditor/parse.js';
import { evaluate, grade, scores } from '../../src/agents/ai-site-auditor/rules.js';
import { renderReportHtml } from '../../src/agents/ai-site-auditor/report.js';
import { wordsInHtml } from '../../src/agents/ai-site-auditor/collect.js';
import type { PageAudit, PageView, SiteFacts } from '../../src/agents/ai-site-auditor/types.js';
import type { DesignRaw } from '../../src/agents/ai-site-auditor/design.js';
import type { EssentialsRaw } from '../../src/agents/ai-site-auditor/essentials.js';

test('robots: most specific group wins, longest rule wins, allow wins ties, wildcards', () => {
  const r = parseRobots(`# comment
User-agent: *
Disallow: /admin
Allow: /admin/public$

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /
Disallow: /private*.pdf

Sitemap: https://site.example.test/sitemap.xml`);
  assert.deepEqual(r.sitemaps, ['https://site.example.test/sitemap.xml']);
  assert.equal(isAllowed(r, 'GPTBot', '/').allowed, false, 'GPTBot has its own group');
  assert.equal(isAllowed(r, 'ccbot', '/blog').allowed, false, 'tokens are case-insensitive and share a group');
  assert.equal(isAllowed(r, 'OAI-SearchBot', '/blog').allowed, true);
  assert.equal(isAllowed(r, 'OAI-SearchBot', '/private-2026.pdf').allowed, false, '* wildcard');
  assert.equal(isAllowed(r, 'ClaudeBot', '/admin/x').allowed, false, 'falls back to *');
  assert.equal(isAllowed(r, 'ClaudeBot', '/admin/public').allowed, true, 'longer allow beats shorter disallow; $ anchor');
  assert.equal(isAllowed(r, 'ClaudeBot', '/admin/public/more').allowed, false, '$ anchor stops the allow');
  assert.equal(isAllowed(parseRobots(''), 'GPTBot', '/').matchedBy, 'none');
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:'), 'GPTBot', '/').allowed, true, 'empty Disallow allows all');
  const tie = parseRobots('User-agent: *\nDisallow: /page\nAllow: /page');
  assert.equal(isAllowed(tie, 'x', '/page').allowed, true, 'allow wins an equal-length tie');
});

test('secrets: real-looking keys flagged and redacted; Supabase anon ignored, service_role critical', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const anon = `eyJ${b64({ alg: 'HS256' }).slice(3)}.${b64({ role: 'anon', iss: 'supabase' })}.abcdefghijklmnopqrstu`;
  const service = `eyJ${b64({ alg: 'HS256' }).slice(3)}.${b64({ role: 'service_role', iss: 'supabase' })}.abcdefghijklmnopqrstu`;
  const fakeOpenAi = 'sk-proj-' + 'Ab1'.repeat(15);
  const bundle = `const a="${fakeOpenAi}";const s="${service}";const n="${anon}";const g="AIza${'x'.repeat(35)}";`;
  const hits = findSecrets(bundle);
  assert.deepEqual(hits.map(h => h.kind).sort(), ['Google API key', 'OpenAI API key', 'Supabase service_role key']);
  assert.ok(hits.every(h => /…\(\d+ chars\)$/.test(h.preview) && h.preview.length < 22), 'preview is redacted');
  assert.equal(redact(fakeOpenAi), `sk-pro…(${fakeOpenAi.length} chars)`);
  assert.equal(findSecrets('task-manager-component-with-a-very-long-css-class-name').length, 0, 'no false positive inside words');
});

test('small parsers: sitemap, llms.txt, placeholders, builder fingerprints, raw word count', () => {
  assert.deepEqual(parseSitemap('<urlset><url><loc>https://a.test/</loc></url><url><loc> https://a.test/x?a=1&amp;b=2 </loc></url></urlset>'), { kind: 'urlset', locs: ['https://a.test/', 'https://a.test/x?a=1&b=2'] });
  assert.equal(parseSitemap('<sitemapindex><sitemap><loc>https://a.test/s1.xml</loc></sitemap></sitemapindex>').kind, 'index');
  assert.equal(checkLlmsTxt('# Acme\n\n> Tools\n\n- [Docs](https://a.test/docs): docs').ok, true);
  assert.deepEqual(checkLlmsTxt('<!doctype html><html></html>').problems, ['served HTML, not markdown (probably an SPA fallback page)']);
  assert.deepEqual(findPlaceholders('Call (555) 123-4567 or email hello@example.com. Lorem ipsum dolor.').sort(), ['555 phone number', 'example email address', 'lorem ipsum']);
  assert.deepEqual(builderSigns('<link rel="icon" href="/vite.svg"><a id="lovable-badge">Edit with Lovable</a>').map(s => s.builder), ['Lovable', 'Vite scaffold']);
  assert.equal(wordsInHtml('<html><head><title>T</title><script>var x = "many words here";</script></head><body><div id="root"></div></body></html>'), 1);
});

const view = (over: Partial<PageView> = {}): PageView => ({
  title: 'Acme — Home', metaDescription: 'Acme makes things.', canonical: 'https://acme.example.test/', lang: 'en', viewport: true,
  h1: ['Acme'], headings: 3, words: 400, textSample: 'Acme makes things', links: [], hashRouteLinks: 0, images: 1, imagesMissingAlt: 0,
  jsonLd: { types: ['Organization'], errors: 0, blocks: 1 }, og: { title: 'Acme', image: '/og.png' }, hreflang: 0, favicon: true, html: '<html></html>', ...over,
});
/** A rendered page always carries style measurements; this is the shape that trips no design tell. */
export const cleanDesign: DesignRaw = {
  gradientCss: [], gradientTextCount: 0, headings: ['Acme'], fonts: [['Georgia', 40]], glassCount: 0,
  coloredBorderCards: 0, iconRows: 0, badgeAboveH1: false, lucideIcons: 0, shadcnMarkers: 0,
  scrollFadeCount: 0, cursorBeam: false, hoverOpacityRules: 0, spacingPx: [8, 16, 24, 32],
  serifItalicCount: 0, contrastPairs: [], grainOverlay: false, darkBackground: false,
};
/** Likewise for launch readiness: a site with its policies, a working form and contact details. */
export const cleanEssentials: EssentialsRaw = {
  links: [
    { href: 'https://acme.example.test/privacy', text: 'Privacy policy' },
    { href: 'https://acme.example.test/terms', text: 'Terms of service' },
    { href: 'https://acme.example.test/delete-account', text: 'Delete your account' },
  ],
  forms: [{ action: '/subscribe', method: 'post', fields: 2, required: 2, emailTyped: 1, labelled: 2, novalidate: false, consentCheckbox: true, captcha: true, honeypot: false }],
  thirdParty: [], analytics: ['Plausible'], cookieBanner: false,
  ctas: [{ text: 'Start now', href: '/signup' }],
  focusSuppressed: 0, clickableNonButtons: 0,
  contact: { email: true, phone: true, address: true, company: true },
};
const page = (path: string, raw: Partial<PageView>, rendered: Partial<PageView>, design: DesignRaw = cleanDesign, essentials: EssentialsRaw = cleanEssentials): PageAudit => ({
  url: `https://acme.example.test${path}`, path, status: 200, raw: view(raw), rendered: view(rendered), loadMs: 100,
  consoleErrors: [], failedRequests: [], mixedContent: [], scripts: [], jsBytes: 200_000, design, essentials,
});
const facts = (pages: PageAudit[], over: Partial<SiteFacts> = {}): SiteFacts => ({
  origin: 'https://acme.example.test', startUrl: 'https://acme.example.test/', https: true,
  robots: { status: 200, text: 'User-agent: *\nAllow: /', parsed: parseRobots('User-agent: *\nAllow: /\nSitemap: https://acme.example.test/sitemap.xml') },
  sitemaps: [{ url: 'https://acme.example.test/sitemap.xml', status: 200, kind: 'urlset', urls: pages.length, sampleBroken: [] }],
  llmsTxt: { status: 200, ok: true, h1: 'Acme', links: 3, problems: [] },
  softNotFound: { url: 'x', status: 404, title: 'Page not found — Acme', words: 40, links: 6 }, httpRedirect: { status: 301, location: 'https://acme.example.test/' }, envExposed: { status: 404, looksLikeEnv: false },
  securityHeaders: { 'strict-transport-security': 'max-age=1', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'" },
  botProbes: [], secrets: [], sourceMaps: [], pages, skipped: [], durationMs: 1000, ...over,
});

test('rules: a well-built site produces no findings and straight A grades', () => {
  const f = facts([page('/', {}, {}), page('/about', { title: 'About Acme', canonical: 'https://acme.example.test/about', metaDescription: 'About.' }, { title: 'About Acme', canonical: 'https://acme.example.test/about', metaDescription: 'About.' })]);
  const results = evaluate(f);
  assert.deepEqual(results.map(r => r.id), []);
  assert.deepEqual(scores(results), { 'ai-visibility': 100, search: 100, build: 100, design: 100, readiness: 100 });
});

test('rules: the SPA shell pattern is caught once per root cause, with the right severities', () => {
  const shell: Partial<PageView> = { title: 'Vite + React', words: 0, h1: [], metaDescription: undefined, jsonLd: { types: [], errors: 0, blocks: 0 }, canonical: 'https://acme.example.test/' };
  const f = facts([
    page('/', shell, { title: 'Acme', canonical: 'https://acme.example.test/' }),
    page('/pricing', shell, { title: 'Pricing', canonical: 'https://acme.example.test/' }),
    page('/team', shell, { title: 'Pricing', canonical: 'https://acme.example.test/', textSample: 'Jane Doe, CEO. Call (555) 010-2030' }),
  ], {
    softNotFound: { url: 'x', status: 200, title: 'Acme', words: 300, links: 4 },
    robots: { status: 200, text: '', parsed: parseRobots('User-agent: OAI-SearchBot\nDisallow: /') },
    secrets: [{ script: '/assets/index.js', kind: 'OpenAI API key', severity: 'critical', preview: 'sk-pro…(48 chars)', note: '' }],
  });
  const results = evaluate(f);
  const byId = Object.fromEntries(results.map(r => [r.id, r]));
  assert.equal(byId['ai.content-needs-javascript']?.severity, 'critical');
  assert.deepEqual(byId['ai.content-needs-javascript']?.pages, ['/', '/pricing', '/team'], 'one finding lists all pages');
  assert.equal(byId['ai.title-set-by-javascript']?.severity, 'high');
  assert.equal(byId['ai.robots-blocks-citation-bots']?.severity, 'high');
  assert.equal(byId['seo.soft-404']?.severity, 'high');
  assert.equal(byId['seo.canonical-to-home']?.pages?.length, 2);
  assert.match(byId['seo.duplicate-titles']!.title, /"Pricing" ×2/);
  assert.equal(byId['build.scaffold-title']?.severity, 'high');
  assert.equal(byId['build.secret-in-javascript']?.severity, 'critical');
  assert.ok(byId['build.placeholder-content']);
  assert.equal(results[0]!.severity, 'critical', 'sorted most severe first');
  const s = scores(results);
  assert.ok(s['ai-visibility'] < 40 && grade(s['ai-visibility']) === 'F');
  const html = renderReportHtml({ orgSlug: 'acme', runId: 'r1', generatedAt: '2026-09-13T00:00:00Z', facts: f, results, summary: 'x', modelUsed: false });
  assert.match(html, /What an AI crawler sees on the home page/);
  assert.match(html, /0% of the page's text is readable without JavaScript/);
  assert.ok(!html.includes('<script'), 'the report page runs no JavaScript');
});

test('regressions from validation: a failed render or an empty audit never reads as a pass', () => {
  const noRender: PageAudit = { ...page('/', {}, {}), rendered: undefined, error: 'page.goto: Timeout 15000ms exceeded.' };
  const r1 = evaluate(facts([noRender]));
  assert.ok(r1.some(r => r.id === 'build.render-failed' && r.severity === 'high'), 'render failure is a finding');
  assert.ok(!r1.some(r => r.id === 'ai.content-needs-javascript'), 'no raw-vs-rendered verdict without both views');

  const r2 = evaluate(facts([{ ...page('/', {}, {}), status: 0, raw: undefined, rendered: undefined, error: 'ECONNREFUSED' }]));
  const s2 = scores(r2);
  assert.deepEqual([s2['ai-visibility'] < 100, s2.search < 100, s2.build < 100, s2.design < 100, s2.readiness < 100], [true, true, true, true, true], 'nothing audited drags every area down');
  assert.deepEqual(r2.filter(r => r.id.startsWith('audit.')).map(r => r.severity), ['critical', 'critical', 'critical', 'critical', 'critical'], 'one critical per area');
  assert.equal(s2.design, 0, 'design cannot pass on a page that never rendered');

  // rendered, but the style measurement itself failed: still not a pass
  const r3 = evaluate(facts([{ ...page('/', {}, {}), design: undefined, essentials: undefined }]));
  assert.ok(r3.some(x => x.id === 'design.not-measured'), 'an unmeasured design area is reported');
  assert.equal(scores(r3).design, 0, 'and scores zero rather than a silent 100');
  assert.ok(r3.some(x => x.id === 'readiness.not-measured'), 'the same for launch readiness');
  assert.ok(scores(r3).readiness < 100);
});

test('regressions from validation: small app shells, form labels, staging canonicals, off-host sitemaps', () => {
  const tiny = evaluate(facts([page('/', { words: 0 }, { words: 18 })]));
  assert.equal(tiny.find(r => r.id === 'ai.content-needs-javascript')?.severity, 'critical', '18 rendered words, 0 raw is still an empty shell');
  const ssr = evaluate(facts([page('/', { words: 16 }, { words: 18 })]));
  assert.ok(!ssr.some(r => r.id === 'ai.content-needs-javascript'), 'a small server-rendered page is fine');

  assert.deepEqual(findPlaceholders('Company Name State (Optional) All States'), [], 'a field label is not placeholder copy');
  assert.deepEqual(findPlaceholders('Enter your company name here'), ['"Your company name"']);

  const canon = { canonical: 'https://clinic.example.com/' };
  const local = evaluate(facts([page('/', canon, canon)], { origin: 'http://127.0.0.1:8803', startUrl: 'http://127.0.0.1:8803/' }));
  assert.equal(local.find(r => r.id === 'seo.canonical-other-host')?.severity, 'info', 'production canonical on localhost is expected');
  const prod = evaluate(facts([page('/', canon, canon)], { origin: 'https://www.other.example.com', startUrl: 'https://www.other.example.com/' }));
  assert.equal(prod.find(r => r.id === 'seo.canonical-other-host')?.severity, 'high');

  const off = evaluate(facts([page('/', {}, {})], { sitemaps: [{ url: 'https://clinic.example.com/sitemap.xml', status: 0, kind: 'other-host', urls: 0, sampleBroken: [] }] }));
  assert.ok(off.some(r => r.id === 'seo.sitemap-other-host'));
  assert.ok(!off.some(r => r.id === 'seo.no-sitemap'), 'not double-reported as missing');
});
