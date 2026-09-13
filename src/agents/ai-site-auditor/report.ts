// Report rendering: a self-contained HTML evaluation page (the deliverable), plus markdown and JSON.
// Pure functions of the facts and the check results.
import { AI_BOTS } from './bots.js';
import { isAllowed } from './robots.js';
import { grade, scores } from './rules.js';
import type { Area, CheckResult, SiteFacts, Severity } from './types.js';

export interface ReportInput {
  orgSlug: string;
  runId: string;
  generatedAt: string;
  facts: SiteFacts;
  results: CheckResult[];
  summary: string;
  modelUsed: boolean;
}

export const AREA_LABEL: Record<Area, string> = { 'ai-visibility': 'AI visibility', search: 'Search', build: 'Build quality' };
export const AREA_BLURB: Record<Area, string> = {
  'ai-visibility': 'Can ChatGPT, Claude and Perplexity read, cite and quote this site?',
  search: 'Will search engines index the right pages with the right titles?',
  build: 'Did the AI builder leave mistakes, placeholders or secrets behind?',
};
const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function countBySeverity(results: CheckResult[]): Record<Severity, number> {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const r of results) c[r.severity]++;
  return c;
}

/** Deterministic executive summary, used when no local model is configured. */
export function deterministicSummary(f: SiteFacts, results: CheckResult[]): string {
  const s = scores(results);
  const c = countBySeverity(results);
  const pages = f.pages.filter(p => p.rendered).length;
  const h = f.pages[0];
  const raw = h?.raw?.words ?? 0; const ren = h?.rendered?.words ?? 0;
  const parts = [
    `Audited ${pages} page${pages === 1 ? '' : 's'} on ${f.origin} in ${(f.durationMs / 1000).toFixed(1)} s.`,
    `Scores: AI visibility ${s['ai-visibility']} (${grade(s['ai-visibility'])}), search ${s.search} (${grade(s.search)}), build quality ${s.build} (${grade(s.build)}).`,
    `${results.length} finding${results.length === 1 ? '' : 's'}: ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low, ${c.info} info.`,
    ren ? `The home page has ${ren} words in a browser and ${raw} in the HTML that AI crawlers receive.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function botMatrix(f: SiteFacts): { token: string; vendor: string; purpose: string; robots: string; robotsAllowed: boolean | undefined; probe?: string; probeBlocked?: boolean; note: string }[] {
  return AI_BOTS.map(b => {
    const d = f.robots?.status === 200 ? isAllowed(f.robots.parsed, b.token, '/') : undefined;
    const p = f.botProbes.find(x => x.token === b.token);
    return {
      token: b.token, vendor: b.vendor, purpose: b.purpose,
      robots: d ? `${d.allowed ? 'allowed' : 'blocked'}${d.rule ? ` (${d.rule.allow ? 'Allow' : 'Disallow'}: ${d.rule.path})` : d.matchedBy === 'none' ? ' (no rule)' : ''}` : 'no robots.txt, allowed',
      robotsAllowed: d ? d.allowed : undefined,
      probe: p ? `${p.status || p.error} · ${p.words} words` : undefined, probeBlocked: p?.blockedLike,
      note: b.note,
    };
  });
}

export function renderReportHtml(x: ReportInput): string {
  const f = x.facts;
  const s = scores(x.results);
  const c = countBySeverity(x.results);
  const h = f.pages[0];
  const areas: Area[] = ['ai-visibility', 'search', 'build'];
  const pct = (n: number, d: number) => (d ? Math.min(100, Math.round((n / d) * 100)) : 0);

  const tiles = areas.map(a => {
    const rs = x.results.filter(r => r.area === a);
    const g = grade(s[a]);
    return `<div class="tile g-${g}"><div class="tile__head"><span class="tile__label">${AREA_LABEL[a]}</span><span class="tile__grade">${g}</span></div>
      <div class="tile__score">${s[a]}<small>/100</small></div><div class="tile__bar"><i style="width:${s[a]}%"></i></div>
      <p class="tile__blurb">${AREA_BLURB[a]}</p><p class="tile__count">${rs.length} finding${rs.length === 1 ? '' : 's'}${rs.some(r => r.severity === 'critical') ? ' · includes critical' : ''}</p></div>`;
  }).join('');

  const hv = h?.rendered; const hr = h?.raw;
  const compare = hv ? `
  <section class="card">
    <h2>What an AI crawler sees on the home page</h2>
    <p class="muted">Left: the HTML response with JavaScript off, which is all GPTBot, OAI-SearchBot, ClaudeBot and PerplexityBot receive. Right: the page after JavaScript runs in a browser.</p>
    <div class="compare">
      <div class="pane pane--raw"><h3>AI crawler (no JavaScript)</h3>
        <dl><dt>Title</dt><dd>${esc(hr?.title) || '<em>none</em>'}</dd><dt>Main heading</dt><dd>${esc(hr?.h1[0]) || '<em>none</em>'}</dd>
        <dt>Description</dt><dd>${esc(hr?.metaDescription) || '<em>none</em>'}</dd><dt>Structured data</dt><dd>${hr?.jsonLd.blocks ?? 0} block(s)</dd>
        <dt>Readable words</dt><dd><b>${hr?.words ?? 0}</b></dd></dl></div>
      <div class="pane pane--ren"><h3>Browser (JavaScript on)</h3>
        <dl><dt>Title</dt><dd>${esc(hv.title) || '<em>none</em>'}</dd><dt>Main heading</dt><dd>${esc(hv.h1[0]) || '<em>none</em>'}</dd>
        <dt>Description</dt><dd>${esc(hv.metaDescription) || '<em>none</em>'}</dd><dt>Structured data</dt><dd>${hv.jsonLd.blocks} block(s)</dd>
        <dt>Readable words</dt><dd><b>${hv.words}</b></dd></dl></div>
    </div>
    <div class="meter" role="img" aria-label="${pct(hr?.words ?? 0, hv.words)} percent of the words are visible without JavaScript">
      <div class="meter__fill" style="width:${pct(hr?.words ?? 0, hv.words)}%"></div><span>${pct(hr?.words ?? 0, hv.words)}% of the page's text is readable without JavaScript</span></div>
  </section>` : '';

  const matrix = botMatrix(f);
  const botRows = matrix.map(m => `<tr><td><b>${esc(m.token)}</b><div class="muted small">${esc(m.vendor)}</div></td><td><span class="pill p-${m.purpose}">${esc(m.purpose)}</span></td>
    <td class="${m.robotsAllowed === false ? 'bad' : 'ok'}">${esc(m.robots)}</td><td class="${m.probeBlocked ? 'bad' : ''}">${m.probe ? esc(m.probe) : '<span class="muted">not probed</span>'}</td><td class="muted small">${esc(m.note)}</td></tr>`).join('');

  const findings = areas.map(a => {
    const rs = x.results.filter(r => r.area === a);
    if (!rs.length) return `<section class="card"><h2>${AREA_LABEL[a]}</h2><p class="pass">No problems found.</p></section>`;
    return `<section class="card"><h2>${AREA_LABEL[a]} <span class="muted small">· ${rs.length} finding${rs.length === 1 ? '' : 's'}</span></h2>
      ${rs.map(r => `<article class="finding sev-${r.severity}">
        <header><span class="sev">${r.severity}</span><h3>${esc(r.title)}</h3></header>
        <p><b>Why it matters.</b> ${esc(r.why)}</p>
        <p><b>Fix.</b> ${esc(r.fix)}</p>
        ${r.pages?.length ? `<p class="small"><b>Pages:</b> ${r.pages.slice(0, 12).map(p => `<code>${esc(p)}</code>`).join(' ')}${r.pages.length > 12 ? ` and ${r.pages.length - 12} more` : ''}</p>` : ''}
        ${r.source ? `<p class="small"><a href="${esc(r.source)}" target="_blank" rel="noopener">Source</a> · <code>${esc(r.id)}</code></p>` : `<p class="small"><code>${esc(r.id)}</code></p>`}
        ${r.evidence !== undefined ? `<details><summary>Evidence</summary><pre>${esc(JSON.stringify(r.evidence, null, 2).slice(0, 4000))}</pre></details>` : ''}
      </article>`).join('')}</section>`;
  }).join('');

  const pageRows = f.pages.map(p => `<tr><td><code>${esc(p.path)}</code></td><td class="${p.status >= 400 || !p.status ? 'bad' : ''}">${p.status || esc(p.error)}</td>
    <td class="num ${p.rendered && p.rendered.words >= 50 && (p.raw?.words ?? 0) < p.rendered.words * 0.3 ? 'bad' : ''}">${p.raw?.words ?? '–'}</td><td class="num">${p.rendered?.words ?? '–'}</td>
    <td>${esc(p.rendered?.title ?? '')}</td><td>${p.rendered?.h1.length ? '✓' : '<span class="bad">✗</span>'}</td><td>${p.rendered?.metaDescription ? '✓' : '<span class="bad">✗</span>'}</td>
    <td>${p.rendered?.canonical ? '✓' : '–'}</td><td class="num">${p.consoleErrors.length || ''}</td></tr>`).join('');

  const siteFiles = [
    ['robots.txt', f.robots ? (f.robots.status === -1 ? 'HTML page (SPA fallback)' : String(f.robots.status)) : 'unreachable'],
    ['Sitemap', f.sitemaps.map(sm => `${new URL(sm.url).pathname} → ${sm.status}${sm.urls ? `, ${sm.urls} URLs` : ''}`).join('; ') || 'none'],
    ['llms.txt', f.llmsTxt?.status === 200 ? (f.llmsTxt.ok ? `present, ${f.llmsTxt.links} links` : `present, ${f.llmsTxt.problems.join('; ')}`) : String(f.llmsTxt?.status ?? 'unreachable')],
    ['Unknown URL', `${f.softNotFound.status}${f.softNotFound.status >= 200 && f.softNotFound.status < 300 ? ' (soft 404)' : ''}`],
    ['http → https', f.https ? (f.httpRedirect ? `${f.httpRedirect.status}${f.httpRedirect.location ? ` → ${f.httpRedirect.location}` : ''}` : 'unreachable') : 'site is http'],
    ['Scripts scanned for secrets', `${new Set(f.pages.flatMap(p => p.scripts)).size}`],
  ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Site Audit · ${esc(new URL(f.origin).host)}</title>
<meta name="robots" content="noindex">
<style>
:root{--bg:#f7f6f3;--card:#fff;--ink:#1d1b18;--soft:#5f5a53;--line:#e6e2da;--crit:#b42318;--high:#d9480f;--med:#b07700;--low:#1c6fb8;--info:#6b6b6b;--ok:#18794e;--accent:#3b5bdb;--raw:#fff4e5;--ren:#e8f3ff}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--card:#1d1c19;--ink:#ecebe7;--soft:#a8a39a;--line:#34312c;--raw:#2b2216;--ren:#15222f;--crit:#ff6b5e;--high:#ff8a4c;--med:#e3b341;--low:#6cb2ff;--ok:#4cc38a;--accent:#8da2fb}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:clamp(1.6rem,3.4vw,2.3rem);letter-spacing:-.02em;margin:6px 0 4px}h2{font-size:1.2rem;margin:0 0 10px}h3{font-size:1rem;margin:0}
.eyebrow{font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);font-weight:700}
.muted{color:var(--soft)}.small{font-size:.85rem}code{font:12.5px/1.4 ui-monospace,Menlo,monospace;background:color-mix(in srgb,var(--line) 55%,transparent);padding:1px 5px;border-radius:5px}
.summary{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:18px 0}.summary__list{margin:0 0 4px;padding-left:18px}.summary__list li{margin:2px 0}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:18px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;border-top:5px solid var(--gc)}
.g-A{--gc:var(--ok)}.g-B{--gc:#5c940d}.g-C{--gc:var(--med)}.g-D{--gc:var(--high)}.g-F{--gc:var(--crit)}
.tile__head{display:flex;justify-content:space-between;align-items:center}.tile__label{font-weight:700}.tile__grade{font-weight:800;font-size:1.4rem;color:var(--gc)}
.tile__score{font-size:2.4rem;font-weight:800;letter-spacing:-.03em;line-height:1.1}.tile__score small{font-size:1rem;color:var(--soft);font-weight:600}
.tile__bar{height:8px;background:var(--line);border-radius:8px;overflow:hidden;margin:8px 0}.tile__bar i{display:block;height:100%;background:var(--gc)}
.tile__blurb{margin:6px 0 2px;color:var(--soft);font-size:.9rem}.tile__count{margin:0;font-size:.85rem;font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:16px 0}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}.pane{border-radius:12px;padding:12px 14px}.pane--raw{background:var(--raw)}.pane--ren{background:var(--ren)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0 0}dt{color:var(--soft);font-size:.85rem}dd{margin:0;overflow-wrap:anywhere}
.meter{position:relative;height:30px;border-radius:8px;background:var(--line);overflow:hidden}.meter__fill{height:100%;background:var(--accent);opacity:.35}.meter span{position:absolute;inset:0;display:flex;align-items:center;padding:0 12px;font-weight:700;font-size:.9rem}
.tablewrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--soft)}
td.num{text-align:right;font-variant-numeric:tabular-nums}.bad{color:var(--crit);font-weight:700}.ok{color:var(--ok)}
.pill{font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--line)}
.finding{border-left:5px solid var(--sc);padding:10px 14px;margin:12px 0;background:color-mix(in srgb,var(--sc) 6%,transparent);border-radius:0 10px 10px 0}
.finding header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.finding p{margin:6px 0}
.sev{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:var(--sc);padding:2px 8px;border-radius:999px}
.sev-critical{--sc:var(--crit)}.sev-high{--sc:var(--high)}.sev-medium{--sc:var(--med)}.sev-low{--sc:var(--low)}.sev-info{--sc:var(--info)}
details summary{cursor:pointer;font-size:.85rem;color:var(--soft)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;background:var(--bg);padding:10px;border-radius:8px}
.pass{color:var(--ok);font-weight:700}.counts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.counts span{font-size:.8rem;font-weight:700;padding:3px 10px;border-radius:999px;color:#fff}
footer{margin-top:28px;color:var(--soft);font-size:.82rem}
@media (max-width:640px){.compare{grid-template-columns:1fr}}
@media print{body{background:#fff}.card,.tile,.summary{break-inside:avoid}details{display:none}}
</style></head>
<body><main class="wrap">
  <div class="eyebrow">AI Site Audit · ${esc(x.orgSlug)}</div>
  <h1>${esc(new URL(f.origin).host)}</h1>
  <div class="muted small">${esc(x.generatedAt)} · run <code>${esc(x.runId)}</code> · ${f.pages.length} page${f.pages.length === 1 ? '' : 's'} · ${(f.durationMs / 1000).toFixed(1)} s${f.skipped.length ? ` · ${f.skipped.length} more not audited (max_pages)` : ''}</div>
  <div class="summary"><ul class="summary__list">${x.summary.split(/(?<=[.!?])\s+(?=[A-Z])/).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <div class="counts">${SEVERITIES.filter(sv => c[sv]).map(sv => `<span class="sev-${sv}" style="background:var(--sc)">${c[sv]} ${sv}</span>`).join('')}</div></div>
  <div class="tiles">${tiles}</div>
  ${compare}
  <section class="card"><h2>AI crawler access</h2>
    <p class="muted">robots.txt decision for the home page, and what came back when the home page was requested with each crawler's real user agent. Search and user-fetch agents decide whether you are cited; training agents only decide whether your content trains future models.</p>
    <div class="tablewrap"><table><thead><tr><th>Agent</th><th>Purpose</th><th>robots.txt</th><th>Request as this agent</th><th>Notes</th></tr></thead><tbody>${botRows}</tbody></table></div>
    <p class="small muted">Some hosts prerender only for verified crawler IP addresses; a user-agent request from outside cannot see that. If the raw HTML above is empty but the host advertises crawler prerendering, confirm with the vendor's own URL inspection tool.</p>
  </section>
  ${findings}
  <section class="card"><h2>Pages audited</h2><div class="tablewrap"><table><thead><tr><th>Path</th><th>Status</th><th>Words, no JS</th><th>Words, rendered</th><th>Title</th><th>h1</th><th>Desc.</th><th>Canonical</th><th>JS errors</th></tr></thead><tbody>${pageRows}</tbody></table></div></section>
  <section class="card"><h2>Site files and probes</h2><dl>${siteFiles}</dl></section>
  <footer>Generated by The AI Site Auditor (plate 46). Every check is deterministic; ${x.modelUsed ? 'a local model rephrased the summary only' : 'no model was used'}. Secret values are redacted to their first six characters. Scores: 100 minus 40 per critical, 18 per high, 8 per medium, 3 per low finding in that area.</footer>
</main></body></html>`;
}

export function renderReportMarkdown(x: ReportInput): string {
  const s = scores(x.results);
  const L: string[] = [];
  L.push(`# AI site audit: ${new URL(x.facts.origin).host}`, '');
  L.push(`- Run: \`${x.runId}\``, `- Generated: ${x.generatedAt}`, `- Pages: ${x.facts.pages.length}`, '');
  L.push('## Summary', '', x.summary, '');
  L.push('| Area | Score | Grade | Findings |', '| --- | ---: | :-: | ---: |');
  for (const a of ['ai-visibility', 'search', 'build'] as Area[]) L.push(`| ${AREA_LABEL[a]} | ${s[a]} | ${grade(s[a])} | ${x.results.filter(r => r.area === a).length} |`);
  L.push('');
  const h = x.facts.pages[0];
  if (h?.rendered) {
    L.push('## Home page: AI crawler vs browser', '', '| | No JavaScript | Rendered |', '| --- | --- | --- |');
    L.push(`| Title | ${h.raw?.title ?? ''} | ${h.rendered.title} |`, `| h1 | ${h.raw?.h1[0] ?? ''} | ${h.rendered.h1[0] ?? ''} |`, `| Words | ${h.raw?.words ?? 0} | ${h.rendered.words} |`, '');
  }
  L.push('## Findings', '');
  for (const r of x.results) {
    L.push(`### [${r.severity}] ${r.title}`, '', `- Area: ${AREA_LABEL[r.area]} · \`${r.id}\``, `- Why: ${r.why}`, `- Fix: ${r.fix}`);
    if (r.pages?.length) L.push(`- Pages: ${r.pages.map(p => `\`${p}\``).join(', ')}`);
    if (r.source) L.push(`- Source: ${r.source}`);
    L.push('');
  }
  if (!x.results.length) L.push('No problems found.', '');
  return L.join('\n');
}

export function buildReportJson(x: ReportInput) {
  const f = x.facts;
  return {
    agent: 'ai-site-auditor', org_slug: x.orgSlug, run_id: x.runId, generated_at: x.generatedAt,
    origin: f.origin, summary: x.summary, scores: scores(x.results), findings_by_severity: countBySeverity(x.results),
    results: x.results,
    bots: botMatrix(f),
    site: { robots_status: f.robots?.status, sitemaps: f.sitemaps, llms_txt: f.llmsTxt, soft_not_found: f.softNotFound, http_redirect: f.httpRedirect, security_headers: f.securityHeaders, source_maps: f.sourceMaps },
    pages: f.pages.map(p => ({
      path: p.path, status: p.status, load_ms: p.loadMs, raw_words: p.raw?.words, rendered_words: p.rendered?.words,
      raw_title: p.raw?.title, title: p.rendered?.title, h1: p.rendered?.h1, meta_description: p.rendered?.metaDescription, canonical: p.rendered?.canonical,
      robots_meta: p.rendered?.robotsMeta, json_ld: p.rendered?.jsonLd, console_errors: p.consoleErrors, failed_requests: p.failedRequests, js_kb: Math.round(p.jsBytes / 1024), error: p.error,
    })),
    skipped: f.skipped, duration_ms: f.durationMs,
  };
}
