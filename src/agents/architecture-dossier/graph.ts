// The architecture graph and its inline SVG. Five columns, left to right: services → route groups
// → data stores → integrations → inbound webhooks. Edges come from what each route group's files
// (and the helpers they import, two hops) actually reference, not from guesses.
import type { RepoFiles } from './files.js';
import type { ImportGraph } from './imports.js';
import { VENDORS, importedPackages, outboundHosts } from './integrations.js';
import type { IntegrationsResult } from './integrations.js';
import type { ModelsResult, StoreKind } from './models.js';
import type { RoutesResult } from './routes.js';
import type { Webhook } from './webhooks.js';

export type Column = 0 | 1 | 2 | 3 | 4;
export interface GraphNode { id: string; label: string; sub?: string; column: Column; kind: 'service' | 'routes' | 'store' | 'integration' | 'webhook' | 'more'; warn?: boolean }
export interface GraphEdge { from: string; to: string; dashed?: boolean }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export const COLUMN_TITLES = ['Services', 'Route groups', 'Data stores', 'Integrations', 'Inbound webhooks'];

const STORE_MARKERS: Record<StoreKind, RegExp> = {
  mongodb: /from\s+['"]mongoose['"]|from\s+['"]mongodb['"]|\bdbConnect\s*\(|\bconnectDB\s*\(|\bconnectToDatabase\s*\(|clientPromise|\.collection\s*\(\s*['"]/,
  sqlite: /DatabaseSync|better-sqlite3|\.prepare\s*\(\s*['"`]\s*(SELECT|INSERT|UPDATE|DELETE)/i,
  postgres: /\bsql`|pool\.query\s*\(|from\s+['"](pg|postgres|@vercel\/postgres|@neondatabase\/serverless)['"]/,
  mysql: /from\s+['"]mysql2/,
  redis: /from\s+['"](ioredis|redis|@upstash\/redis)['"]/,
  kv: /from\s+['"]@vercel\/kv['"]/,
  sql: /\b(SELECT|INSERT INTO|UPDATE)\s[\s\S]{0,80}\b(FROM|SET|VALUES)\b/,
};

export function buildGraph(repo: RepoFiles, imports: ImportGraph, routes: RoutesResult, models: ModelsResult, integ: IntegrationsResult, webhooks: Webhook[]): Graph {
  const nodes: GraphNode[] = []; const edges: GraphEdge[] = [];
  const webhookFiles = new Set(webhooks.map(w => w.file));
  const svcId = (dir: string) => `svc:${dir || '.'}`;
  for (const s of routes.services) nodes.push({ id: svcId(s.dir), label: s.name, sub: s.dir || 'repository root', column: 0, kind: 'service' });

  const groups = new Map<string, { service: string; label: string; files: Set<string>; api: number; pages: number }>();
  for (const r of routes.routes) {
    if (webhookFiles.has(r.file)) continue;
    const key = r.kind === 'page' ? `${r.service}|pages` : `${r.service}|${r.group}`;
    const g = groups.get(key) ?? { service: r.service, label: r.kind === 'page' ? 'UI pages' : r.group, files: new Set(), api: 0, pages: 0 };
    g.files.add(r.file); if (r.kind === 'page') g.pages++; else g.api++;
    groups.set(key, g);
  }
  const storeIds = new Map<StoreKind, string>();
  for (const s of models.stores) {
    const id = `store:${s.kind}`; storeIds.set(s.kind, id);
    const n = models.models.filter(m => m.store === s.kind).length;
    nodes.push({ id, label: s.label, sub: n ? `${n} model${n === 1 ? '' : 's'}` : undefined, column: 2, kind: 'store' });
  }
  for (const i of integ.integrations) nodes.push({ id: `int:${i.id}`, label: i.label, sub: i.category, column: 3, kind: 'integration' });

  const modelNames = models.models.map(m => ({ store: m.store, re: new RegExp(`\\b${m.name}\\s*\\.\\s*(find|findOne|findById|create|insertMany|update|updateOne|updateMany|delete|deleteOne|deleteMany|aggregate|countDocuments|exists|findOneAndUpdate)\\b|\\b(INTO|FROM|UPDATE|JOIN)\\s+${(m.collection ?? m.name).replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')}\\b`) }));
  const touches = (files: Iterable<string>) => {
    const text = [...files].flatMap(f => imports.reach(f, 2)).filter((f, i, a) => a.indexOf(f) === i).map(f => repo.text(f) ?? '').join('\n');
    const stores = new Set<StoreKind>();
    for (const m of modelNames) if (m.re.test(text)) stores.add(m.store);
    for (const [k, re] of Object.entries(STORE_MARKERS) as [StoreKind, RegExp][]) if (storeIds.has(k) && re.test(text)) stores.add(k);
    const pk = new Set(importedPackages(text)); const hosts = outboundHosts(text);
    const vendors = VENDORS.filter(v => integ.integrations.some(i => i.id === v.id) && (v.packages.some(p => pk.has(p)) || hosts.some(h => v.hosts.some(re => re.test(h)))));
    return { stores: [...stores], vendors: vendors.map(v => v.id) };
  };

  for (const [key, g] of [...groups.entries()].sort((a, b) => a[1].service.localeCompare(b[1].service) || (a[1].label === 'UI pages' ? -1 : b[1].label === 'UI pages' ? 1 : a[1].label.localeCompare(b[1].label)))) {
    const id = `grp:${key}`;
    nodes.push({ id, label: g.label, sub: g.pages ? `${g.pages} page${g.pages === 1 ? '' : 's'}` : `${g.api} route${g.api === 1 ? '' : 's'}`, column: 1, kind: 'routes' });
    edges.push({ from: svcId(g.service), to: id });
    const t = touches(g.files);
    for (const s of t.stores) edges.push({ from: id, to: storeIds.get(s)! });
    for (const v of t.vendors) edges.push({ from: id, to: `int:${v}` });
  }
  for (const w of webhooks) {
    const id = `wh:${w.service}|${w.path}`;
    nodes.push({ id, label: w.path, sub: w.verified ? 'signature checked' : 'NO signature check', column: 4, kind: 'webhook', warn: !w.verified });
    const v = w.vendor && integ.integrations.find(i => i.id === w.vendor || (w.vendor === 'resend' && i.id === 'resend'));
    if (v) edges.push({ from: `int:${v.id}`, to: id, dashed: true });
    else edges.push({ from: svcId(w.service), to: id, dashed: true });
  }
  const seen = new Set<string>();
  return { nodes, edges: edges.filter(e => { const k = `${e.from}>${e.to}`; if (seen.has(k)) return false; seen.add(k); return true; }) };
}

const escXml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Inline SVG. Colours come from the page's CSS custom properties, so it follows light and dark. */
export function renderGraphSvg(g: Graph, opts: { maxPerColumn?: number; titles?: string[]; label?: string } = {}): string {
  const max = opts.maxPerColumn ?? 16; const titles = opts.titles ?? COLUMN_TITLES;
  const colW = 176; const gap = 44; const nodeH = 40; const vGap = 12; const top = 40; const left = 8;
  const cols: GraphNode[][] = [[], [], [], [], []];
  for (const n of g.nodes) cols[n.column]!.push(n);
  const shown = new Set<string>();
  const laid: (GraphNode & { x: number; y: number })[] = [];
  cols.forEach((list, ci) => {
    const vis = list.length > max ? list.slice(0, max - 1) : list;
    const rest = list.length - vis.length;
    const all: GraphNode[] = rest > 0 ? [...vis, { id: `more:${ci}`, label: `+${rest} more`, column: ci as Column, kind: 'more' }] : vis;
    all.forEach((n, i) => { laid.push({ ...n, x: left + ci * (colW + gap), y: top + i * (nodeH + vGap) }); shown.add(n.id); });
  });
  const rows = Math.max(1, ...cols.map(c => Math.min(c.length, max)));
  const width = left * 2 + 5 * colW + 4 * gap; const height = top + rows * (nodeH + vGap) + 8;
  const pos = new Map(laid.map(n => [n.id, n]));
  const edgeSvg = g.edges.filter(e => shown.has(e.from) && shown.has(e.to)).map(e => {
    const a = pos.get(e.from)!; const b = pos.get(e.to)!;
    const x1 = a.x + colW; const y1 = a.y + nodeH / 2; const x2 = b.x; const y2 = b.y + nodeH / 2;
    const dx = Math.max(24, (x2 - x1) / 2);
    return `<path class="g-edge${e.dashed ? ' dashed' : ''}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}"/>`;
  }).join('');
  const headSvg = titles.map((t, i) => `<text class="g-head" x="${left + i * (colW + gap)}" y="18">${escXml(t)}</text>`).join('');
  const nodeSvg = laid.map(n => `<g class="g-node k-${n.kind}${n.warn ? ' warn' : ''}"><title>${escXml(n.label)}${n.sub ? ` — ${escXml(n.sub)}` : ''}</title><rect x="${n.x}" y="${n.y}" width="${colW}" height="${nodeH}" rx="6"/><text class="g-label" x="${n.x + 10}" y="${n.y + (n.sub ? 17 : 24)}">${escXml(clip(n.label, 24))}</text>${n.sub ? `<text class="g-sub" x="${n.x + 10}" y="${n.y + 32}">${escXml(clip(n.sub, 28))}</text>` : ''}</g>`).join('');
  return `<svg class="graph" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escXml(opts.label ?? 'Architecture diagram')}" xmlns="http://www.w3.org/2000/svg">${headSvg}${edgeSvg}${nodeSvg}</svg>`;
}

/** The CSS the graph relies on. Shared by the dossier and the portfolio page. */
export const GRAPH_CSS = `
.graph{display:block;max-width:none;height:auto;font-family:inherit}
.graph .g-head{fill:var(--soft);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.graph .g-edge{fill:none;stroke:var(--soft);stroke-opacity:.55;stroke-width:1.2}
.graph .g-edge.dashed{stroke-dasharray:4 3}
.graph .g-node rect{fill:var(--card);stroke:var(--line);stroke-width:1.2}
.graph .k-service rect{stroke:var(--accent);stroke-width:2}
.graph .k-routes rect{stroke:var(--c-routes)}
.graph .k-store rect{stroke:var(--c-store);stroke-width:1.8}
.graph .k-integration rect{stroke:var(--c-int)}
.graph .k-webhook rect{stroke:var(--ok)}
.graph .warn rect{stroke:var(--crit);stroke-width:2}
.graph .k-more rect{stroke-dasharray:3 3}
.graph .g-label{fill:var(--ink);font-size:12.5px;font-weight:600}
.graph .g-sub{fill:var(--soft);font-size:10.5px}
.graph .warn .g-sub{fill:var(--crit);font-weight:600}
`;
