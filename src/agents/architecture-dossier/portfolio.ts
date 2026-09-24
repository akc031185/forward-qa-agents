// The portfolio index: one page over several dossiers (one sub-folder each, holding dossier.json
// and index.html), plus an optional stated portfolio.json describing how the apps connect. The
// diagram puts apps on top, stated app-to-app links as arcs between them, and vendors that two or
// more apps share underneath.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { looksLikeSecret } from './facts.js';
import { isSecretLikePath } from './files.js';
import { PAGE_CSS, esc, raw, table } from './render.js';
import { DossierSchema, type DossierJson } from './schema.js';

const short = z.string().min(1).max(200);
export const PortfolioSchema = z.object({
  title: short.optional(),
  owner: short.optional(),
  apps: z.array(z.object({ id: short, role: short.optional(), url: short.optional(), note: z.string().max(2000).optional() }).strict()).max(100).optional(),
  links: z.array(z.object({ from: short, to: short, label: short, mechanism: short.optional(), auth: short.optional() }).strict()).max(200).optional(),
  notes: z.array(z.string().min(1).max(2000)).max(50).optional(),
}).strict();
export type Portfolio = z.infer<typeof PortfolioSchema>;

export function loadPortfolio(file: string): Portfolio {
  if (isSecretLikePath(path.basename(file))) throw new Error(`refusing to read ${path.basename(file)}: it looks like a secrets file`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (looksLikeSecret(JSON.stringify(raw))) throw new Error('portfolio file appears to contain a credential; remove it');
  return PortfolioSchema.parse(raw);
}

export interface Entry { folder: string; dossier: DossierJson }

export function loadDossiers(inDir: string): { entries: Entry[]; errors: string[] } {
  const entries: Entry[] = []; const errors: string[] = [];
  for (const d of fs.readdirSync(inDir, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name).sort()) {
    const f = path.join(inDir, d, 'dossier.json');
    if (!fs.existsSync(f)) continue;
    try {
      const parsed = DossierSchema.safeParse(JSON.parse(fs.readFileSync(f, 'utf8')));
      if (parsed.success) entries.push({ folder: d, dossier: parsed.data });
      else errors.push(`${d}/dossier.json: ${parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    } catch (e) { errors.push(`${d}/dossier.json: ${e instanceof Error ? e.message : e}`); }
  }
  return { entries, errors };
}

const escXml = esc;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Resolve a stated app reference (folder name, dossier id or name) to an entry. */
function find(entries: Entry[], ref: string): Entry | undefined {
  const r = ref.toLowerCase();
  return entries.find(e => e.folder.toLowerCase() === r || e.dossier.app.id === r || e.dossier.app.name.toLowerCase() === r);
}

export function sharedVendors(entries: Entry[]): { id: string; label: string; apps: string[] }[] {
  const m = new Map<string, { label: string; apps: Set<string> }>();
  for (const e of entries) for (const i of e.dossier.integrations.integrations) { const x = m.get(i.id) ?? { label: i.label, apps: new Set() }; x.apps.add(e.folder); m.set(i.id, x); }
  for (const e of entries) for (const s of e.dossier.models.stores) { const id = `store:${s.kind}`; const x = m.get(id) ?? { label: s.label, apps: new Set() }; x.apps.add(e.folder); m.set(id, x); }
  return [...m.entries()].filter(([, x]) => x.apps.size > 1).map(([id, x]) => ({ id, label: x.label, apps: [...x.apps].sort() })).sort((a, b) => b.apps.length - a.apps.length || a.label.localeCompare(b.label));
}

export function renderPortfolioSvg(entries: Entry[], p: Portfolio | null): string {
  const shared = sharedVendors(entries).slice(0, 12);
  const w = 180; const gap = 36; const h = 46;
  const n = Math.max(entries.length, shared.length, 1);
  const width = n * (w + gap) + gap;
  const x0 = (count: number) => (width - (count * w + (count - 1) * gap)) / 2;
  const cx = new Map(entries.map((e, i) => [e.folder, x0(entries.length) + i * (w + gap) + w / 2]));
  const links = (p?.links ?? []).map(l => ({ l, a: find(entries, l.from), b: find(entries, l.to) })).filter(x => x.a && x.b && x.a !== x.b);
  // Each arc gets a height rank: one above every earlier arc whose horizontal span overlaps it, so arcs
  // and their labels never sit on each other. Left-to-right arcs anchor right of centre and
  // right-to-left arcs left of it, so a request and its reply between the same two apps stay apart.
  const off = 22; const step = 34;
  const spans: { lo: number; hi: number; rank: number }[] = [];
  const geo = links.map(({ l, a, b }) => {
    const ax = cx.get(a!.folder)!; const bx = cx.get(b!.folder)!; const d = bx > ax ? off : -off;
    const x1 = ax + d; const x2 = bx + d; const lo = Math.min(x1, x2); const hi = Math.max(x1, x2);
    const rank = spans.filter(s => s.lo < hi && lo < s.hi).reduce((r, s) => Math.max(r, s.rank + 1), 0);
    spans.push({ lo, hi, rank });
    return { l, x1, x2, lift: 40 + rank * step };
  });
  const maxLift = geo.reduce((m, g) => Math.max(m, g.lift), 40);
  const appY = Math.max(110, Math.ceil(0.75 * maxLift) + 50); const vendY = appY + 180;
  const height = shared.length ? vendY + h + 20 : appY + h + 30;
  const appPos = new Map(entries.map((e, i) => [e.folder, { x: x0(entries.length) + i * (w + gap), y: appY }]));
  const vendPos = new Map(shared.map((v, i) => [v.id, { x: x0(shared.length) + i * (w + gap), y: vendY }]));
  const arcs = geo.map(({ l, x1, x2, lift }) => {
    // A quadratic curve with its control point 1.5 * lift above the ends peaks 0.75 * lift above them.
    const mx = (x1 + x2) / 2; const peak = appY - 0.75 * lift;
    return `<g class="p-link"><title>${escXml(`${l.from} → ${l.to}: ${l.label}${l.mechanism ? ` (${l.mechanism})` : ''}`)}</title><path class="g-edge p-arc" d="M${x1},${appY} Q${mx},${appY - 1.5 * lift} ${x2},${appY}" marker-end="url(#arr)"/><text class="g-sub" x="${mx}" y="${peak - 5}" text-anchor="middle">${escXml(clip(l.label, 30))}</text></g>`;
  }).join('');
  const vendEdges = shared.flatMap(v => v.apps.map(a => { const A = appPos.get(a)!; const V = vendPos.get(v.id)!; return `<path class="g-edge dashed" d="M${A.x + w / 2},${A.y + h} C${A.x + w / 2},${(A.y + h + V.y) / 2} ${V.x + w / 2},${(A.y + h + V.y) / 2} ${V.x + w / 2},${V.y}"/>`; })).join('');
  const appNodes = entries.map(e => { const P = appPos.get(e.folder)!; const c = e.dossier.summary.counts; return `<g class="g-node k-service"><title>${escXml(e.dossier.app.name)}</title><rect x="${P.x}" y="${P.y}" width="${w}" height="${h}" rx="8"/><text class="g-label" x="${P.x + 10}" y="${P.y + 19}">${escXml(clip(e.dossier.app.name, 22))}</text><text class="g-sub" x="${P.x + 10}" y="${P.y + 36}">${c.api_endpoints} endpoint${c.api_endpoints === 1 ? '' : 's'} · ${c.models} model${c.models === 1 ? '' : 's'}</text></g>`; }).join('');
  const vendNodes = shared.map(v => { const P = vendPos.get(v.id)!; return `<g class="g-node ${v.id.startsWith('store:') ? 'k-store' : 'k-integration'}"><title>${escXml(`${v.label}: ${v.apps.join(', ')}`)}</title><rect x="${P.x}" y="${P.y}" width="${w}" height="${h}" rx="8"/><text class="g-label" x="${P.x + 10}" y="${P.y + 19}">${escXml(clip(v.label, 22))}</text><text class="g-sub" x="${P.x + 10}" y="${P.y + 36}">shared by ${v.apps.length} apps</text></g>`; }).join('');
  const heads = `<text class="g-head" x="8" y="22">Apps and stated links</text>${shared.length ? `<text class="g-head" x="8" y="${vendY - 14}">Shared vendors and stores (measured)</text>` : ''}`;
  return `<svg class="graph" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Portfolio diagram" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="p-arrow"/></marker></defs>${heads}${vendEdges}${arcs}${appNodes}${vendNodes}</svg>`;
}

export interface PortfolioSummary {
  generated_at: string; title: string;
  apps: { folder: string; id: string; name: string; commit: string; commit_date: string; counts: DossierJson['summary']['counts']; high_gaps: number; href: string }[];
  totals: { apps: number; api_endpoints: number; models: number; test_cases: number; monthly_cost_usd_stated: number; high_gaps: number; vendors: string[] };
  shared: { id: string; label: string; apps: string[] }[];
  links: Portfolio['links'];
  unresolved_links: string[];
  errors: string[];
}

export function summarisePortfolio(entries: Entry[], p: Portfolio | null, outDir: string, inDir: string, errors: string[], now = new Date()): PortfolioSummary {
  const apps = entries.map(e => ({
    folder: e.folder, id: e.dossier.app.id, name: e.dossier.app.name, commit: e.dossier.provenance.commit_short, commit_date: e.dossier.provenance.commit_date,
    counts: e.dossier.summary.counts, high_gaps: e.dossier.gaps.filter(g => g.severity === 'high').length,
    href: path.relative(outDir, path.join(inDir, e.folder, 'index.html')).split(path.sep).join('/'),
  }));
  const sum = (k: keyof DossierJson['summary']['counts']) => entries.reduce((n, e) => n + e.dossier.summary.counts[k], 0);
  return {
    generated_at: now.toISOString(), title: p?.title ?? 'Portfolio',
    apps,
    totals: {
      apps: entries.length, api_endpoints: sum('api_endpoints'), models: sum('models'), test_cases: sum('test_cases'),
      monthly_cost_usd_stated: Math.round(sum('monthly_cost_usd_stated') * 100) / 100, high_gaps: apps.reduce((n, a) => n + a.high_gaps, 0),
      vendors: [...new Set(entries.flatMap(e => e.dossier.integrations.integrations.map(i => i.label)))].sort(),
    },
    shared: sharedVendors(entries),
    links: p?.links ?? [],
    unresolved_links: (p?.links ?? []).filter(l => !find(entries, l.from) || !find(entries, l.to)).map(l => `${l.from} → ${l.to}`),
    errors,
  };
}

export function renderPortfolioHtml(s: PortfolioSummary, entries: Entry[], p: Portfolio | null): string {
  const role = (e: Entry) => p?.apps?.find(a => find([e], a.id));
  const tile = (v: string | number, l: string, bad = false) => `<div class="tile${bad ? ' bad' : ''}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
  const cards = s.apps.map((a, i) => {
    const e = entries[i]!; const r = role(e);
    return `<div class="card"><h3><a href="${esc(a.href)}">${esc(a.name)}</a></h3>
      ${e.dossier.app.one_liner ? `<p>${esc(e.dossier.app.one_liner)} <span class="lab lab-stated">stated</span></p>` : ''}
      ${r?.role ? `<p class="soft">Role: ${esc(r.role)}${r.url ? ` · <code>${esc(r.url)}</code>` : ''}</p>` : ''}
      <p class="soft">commit <code>${esc(a.commit)}</code> · ${esc(a.commit_date.slice(0, 10))}</p>
      ${table(['Endpoints', 'Pages', 'Models'], [[a.counts.api_endpoints, a.counts.pages, a.counts.models]])}
      ${table(['Integrations', 'Tests', 'High gaps'], [[a.counts.integrations, a.counts.test_cases, a.high_gaps ? raw(`<span class="bad">${a.high_gaps}</span>`) : 0]])}
      ${a.counts.monthly_cost_usd_stated ? `<p class="soft">$${esc(a.counts.monthly_cost_usd_stated)} per month (stated)</p>` : ''}</div>`;
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>${esc(s.title)} dossiers</title>
<style>${PAGE_CSS}
.graph .p-arc{stroke:var(--accent);stroke-opacity:.8;stroke-width:1.6}
.graph .p-arrow{fill:var(--accent)}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Portfolio of architecture dossiers</div>
  <h1>${esc(s.title)}</h1>
  <div class="meta"><span>${s.totals.apps} apps</span><span>generated ${esc(s.generated_at.slice(0, 16).replace('T', ' '))} UTC</span>${p?.owner ? `<span>owner ${esc(p.owner)} <span class="lab lab-stated">stated</span></span>` : ''}</div>
  <div class="confidential">Confidential. Each app links to its own dossier, recorded at the commit shown.</div>
</header>
<section id="overview"><h2>Overview <span class="lab lab-measured">measured</span></h2>
  <div class="tiles">${tile(s.totals.apps, 'apps')}${tile(s.totals.api_endpoints, 'API endpoints')}${tile(s.totals.models, 'data models')}${tile(s.totals.test_cases, 'test cases')}${tile(s.totals.high_gaps, 'high-severity gaps', s.totals.high_gaps > 0)}${s.totals.monthly_cost_usd_stated ? tile(`$${s.totals.monthly_cost_usd_stated}`, 'per month (stated)') : ''}</div>
  <p>Vendors across the portfolio: ${s.totals.vendors.length ? s.totals.vendors.map(v => `<code>${esc(v)}</code>`).join(' ') : 'none'}</p>
  ${s.errors.length ? `<p class="bad">Skipped: ${s.errors.map(esc).join('; ')}</p>` : ''}
</section>
<section id="diagram"><h2>How the apps connect <span class="lab lab-stated">stated</span> <span class="lab lab-measured">measured</span></h2>
  <p>Arcs are app-to-app links stated in portfolio.json. Dashed lines join each app to the vendors and data stores it shares with another app, as measured in the dossiers.</p>
  <div class="figure">${renderPortfolioSvg(entries, p)}</div>
  ${s.unresolved_links.length ? `<p class="soft">Stated links naming an app with no dossier: ${s.unresolved_links.map(esc).join('; ')}</p>` : ''}
  ${table(['From', 'To', 'Link', 'Mechanism', 'Auth'], (p?.links ?? []).map(l => [l.from, l.to, l.label, l.mechanism, l.auth]), 'No app-to-app links stated.')}
</section>
<section id="apps"><h2>Apps</h2><div class="cards">${cards || '<p class="empty">No dossiers found.</p>'}</div></section>
${p?.notes?.length ? `<section id="notes"><h2>Notes <span class="lab lab-stated">stated</span></h2><ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
<footer>Generated by architecture-dossier from ${s.totals.apps} dossier.json files. Machine-readable copy: portfolio.summary.json.</footer>
</div>
</body>
</html>
`;
}

export function buildPortfolio(o: { inDir: string; outDir: string; portfolio?: Portfolio | null; now?: Date }): { summary: PortfolioSummary; html: string; htmlPath: string; jsonPath: string } {
  const { entries, errors } = loadDossiers(o.inDir);
  const p = o.portfolio ?? null;
  const summary = summarisePortfolio(entries, p, o.outDir, o.inDir, errors, o.now);
  const html = renderPortfolioHtml(summary, entries, p);
  fs.mkdirSync(o.outDir, { recursive: true });
  const htmlPath = path.join(o.outDir, 'index.html'); // Not portfolio.json: that is the conventional name of the stated input, often kept in the same folder.
  const jsonPath = path.join(o.outDir, 'portfolio.summary.json');
  fs.writeFileSync(htmlPath, html); fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  return { summary, html, htmlPath, jsonPath };
}
