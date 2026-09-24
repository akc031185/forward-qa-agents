// The dossier page: one static HTML file, no scripts, no external requests. Every string that came
// from the analysed repository or the facts file is escaped through `cell`/`esc`; only markup built
// here is emitted raw. Light and dark follow the reader's system setting (or data-theme), phones get
// a single column with scrolling tables, and print gets a clean black-on-white document.
import { COLUMN_TITLES, GRAPH_CSS, renderGraphSvg } from './graph.js';
import type { Facts } from './facts.js';
import type { Dossier, Gap } from './types.js';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Markup built by this module. Anything else placed in a cell is escaped. */
export class Raw { constructor(readonly html: string) {} }
export const raw = (html: string) => new Raw(html);
type Cell = string | number | boolean | null | undefined | Raw;
export const cell = (c: Cell): string => (c instanceof Raw ? c.html : typeof c === 'boolean' ? (c ? 'yes' : 'no') : esc(c ?? ''));

export function table(head: string[], rows: Cell[][], empty = 'None found.'): string {
  if (!rows.length) return `<p class="empty">${esc(empty)}</p>`;
  return `<div class="scroll"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const code = (s: unknown) => raw(`<code>${esc(s)}</code>`);
const codes = (xs: string[], max = 8) => raw(xs.length ? xs.slice(0, max).map(x => `<code>${esc(x)}</code>`).join(' ') + (xs.length > max ? ` <span class="soft">+${xs.length - max}</span>` : '') : '<span class="soft">—</span>');
const yes = (b: boolean, warnIfNo = false) => raw(b ? '<span class="ok">yes</span>' : `<span class="${warnIfNo ? 'bad' : 'soft'}">no</span>`);
const label = (kind: 'measured' | 'stated') => `<span class="lab lab-${kind}" title="${kind === 'measured' ? 'Read from the committed source or git history by this tool' : 'Written by the owner in the facts file; not verified by this tool'}">${kind}</span>`;
const usd = (x: number) => `$${x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const PAGE_CSS = `
:root{--bg:#f6f5f1;--card:#fff;--ink:#1c1b18;--soft:#6a655c;--line:#e3dfd6;--accent:#2f5bd3;--ok:#1f7a4d;--crit:#b3261e;--med:#a86b00;--low:#2f6fb0;--info:#6b6b6b;--c-routes:#7a5af5;--c-store:#b8621b;--c-int:#0f8a8a;--stated:#8a5a00;--stated-bg:#fff4dc;--measured-bg:#e7efff;--code:#f0eee8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121211;--card:#1b1a18;--ink:#ecebe6;--soft:#a39e94;--line:#34312b;--accent:#8aa6ff;--ok:#5ccf92;--crit:#ff7a6e;--med:#e4b54a;--low:#79b4ff;--info:#a0a0a0;--c-routes:#a995ff;--c-store:#f0a060;--c-int:#48c9c9;--stated:#f0c060;--stated-bg:#33280f;--measured-bg:#18233d;--code:#26241f}}
:root[data-theme="dark"]{--bg:#121211;--card:#1b1a18;--ink:#ecebe6;--soft:#a39e94;--line:#34312b;--accent:#8aa6ff;--ok:#5ccf92;--crit:#ff7a6e;--med:#e4b54a;--low:#79b4ff;--info:#a0a0a0;--c-routes:#a995ff;--c-store:#f0a060;--c-int:#48c9c9;--stated:#f0c060;--stated-bg:#33280f;--measured-bg:#18233d;--code:#26241f}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1120px;margin:0 auto;padding:0 16px 64px}
header.top{padding:28px 0 12px;border-bottom:1px solid var(--line);margin-bottom:8px}
header.top h1{font-size:clamp(22px,4vw,32px);line-height:1.2;margin:4px 0 6px;letter-spacing:-.01em}
.eyebrow{color:var(--soft);font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600}
.meta{color:var(--soft);font-size:13px;display:flex;flex-wrap:wrap;gap:4px 14px}
.confidential{margin-top:10px;font-size:12.5px;color:var(--soft);border-left:3px solid var(--accent);padding:2px 10px}
nav.toc{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 0;overflow-x:auto;white-space:nowrap;font-size:13px}
nav.toc a{color:var(--soft);text-decoration:none;margin-right:14px}
nav.toc a:hover{color:var(--accent)}
section{padding:22px 0 6px;border-bottom:1px solid var(--line)}
h2{font-size:20px;margin:0 0 10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
h3{font-size:15px;margin:18px 0 6px}
p{margin:6px 0 10px;max-width:78ch}
.lab{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:999px;vertical-align:middle}
.lab-measured{background:var(--measured-bg);color:var(--accent)}
.lab-stated{background:var(--stated-bg);color:var(--stated)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin:12px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.tile b{display:block;font-size:22px;line-height:1.15;font-variant-numeric:tabular-nums}
.tile span{color:var(--soft);font-size:12px}
.tile.bad b{color:var(--crit)}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:6px 0 12px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:11.5px;color:var(--soft);text-transform:uppercase;letter-spacing:.04em;font-weight:600;background:var(--card);white-space:nowrap}
tr:last-child td{border-bottom:0}
code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:4px;word-break:break-word}
.soft,.empty{color:var(--soft)}
.ok{color:var(--ok);font-weight:600}.bad{color:var(--crit);font-weight:600}
.sev{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.sev-high{color:var(--crit)}.sev-medium{color:var(--med)}.sev-low{color:var(--low)}.sev-info{color:var(--info)}
.figure{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:10px}
.legend{font-size:12px;color:var(--soft);margin-top:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.card h3{margin:0 0 4px}
.card .scroll{border:0;margin:6px 0 0}
ul.gaps{list-style:none;padding:0;margin:0}
ul.gaps li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px}
ul.check{padding-left:0;list-style:none}
ul.check li{padding:4px 0}
.summary{font-size:16px;max-width:80ch}
footer{color:var(--soft);font-size:12px;padding-top:18px}
${GRAPH_CSS}
@media (max-width:640px){body{font-size:14px}th,td{padding:6px 8px}.tile b{font-size:19px}}
@media print{
  :root,:root[data-theme="dark"]{--bg:#fff;--card:#fff;--ink:#000;--soft:#444;--line:#ccc;--code:#f2f2f2;--measured-bg:#eef;--stated-bg:#fff3d6}
  nav.toc{display:none}
  body{font-size:11pt}
  .wrap{max-width:none;padding:0}
  .scroll,.figure{overflow:visible;border-color:#ccc}
  section{break-inside:auto;border-bottom:0}
  h2,h3{break-after:avoid}
  tr,.card,ul.gaps li{break-inside:avoid}
  .graph{width:100%;max-width:100%}
  a{color:inherit;text-decoration:none}
}`;

function gapItem(g: Gap): string {
  return `<li><span class="sev sev-${g.severity}">${esc(g.severity)}</span> ${label(g.source)} <b>${esc(g.title)}</b><p>${esc(g.detail)}</p>${g.evidence?.length ? `<p class="soft">${cell(codes(g.evidence, 12))}</p>` : ''}</li>`;
}

function statedSections(f: Facts | null, d: Dossier): { ops: string; handover: string } {
  if (!f) {
    const none = `<p class="empty">No facts file was supplied. Pass <code>--facts facts.json</code> to record domains, hosting, costs, accounts and handover steps.</p>`;
    return { ops: none, handover: none };
  }
  const ops = [
    f.owner ? `<h3>Owner</h3>${table(['Entity', 'Jurisdiction', 'Contact role', 'IP assignment'], [[f.owner.entity, f.owner.jurisdiction, f.owner.contact_role, f.owner.ip_assignment]])}` : '',
    `<h3>Domains</h3>${table(['Domain', 'Registrar', 'DNS', 'Purpose', 'Renews'], (f.domains ?? []).map(x => [code(x.domain), x.registrar, x.dns, x.purpose, x.renews]), 'No domains stated.')}`,
    `<h3>Hosting</h3>${table(['Provider', 'Project', 'Account', 'Plan', 'Region', 'Notes'], (f.hosting ?? []).map(x => [x.provider, x.project, x.account, x.plan, x.region, x.notes]), 'No hosting stated.')}`,
    `<h3>Monthly costs</h3>${table(['Item', 'Vendor', 'Per month', 'Notes'], [...(f.costs ?? []).map((x): Cell[] => [x.item, x.vendor, usd(x.monthly_usd), x.notes]), ...((f.costs ?? []).length ? [[raw('<b>Total</b>'), '', raw(`<b>${esc(usd(d.summary.counts.monthly_cost_usd_stated))}</b>`), '']] : [])], 'No costs stated.')}`,
    `<h3>Third-party accounts to transfer</h3>${table(['Vendor', 'Purpose', 'Held by', 'Transferable', 'Notes'], (f.accounts ?? []).map(x => [x.vendor, x.purpose, x.held_by, x.transferable === undefined ? '' : String(x.transferable), x.transfer_notes]), 'No accounts stated.')}`,
    `<h3>Contracts with other apps</h3>${table(['Other app', 'Direction', 'Mechanism', 'Auth', 'Detail'], (f.contracts ?? []).map(x => [x.with_app, x.direction, x.mechanism, x.auth, x.detail]), 'No cross-app contracts stated.')}`,
    f.notes?.length ? `<h3>Notes</h3><ul>${f.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '',
  ].join('');
  const steps = f.handover ?? [];
  const handover = steps.length
    ? `<p class="soft">${steps.filter(s => s.done).length} of ${steps.length} steps marked done.</p><ul class="check">${steps.map(s => `<li>${s.done ? '☑' : '☐'} ${esc(s.step)}${s.owner ? ` <span class="soft">— ${esc(s.owner)}</span>` : ''}${s.notes ? `<br><span class="soft">${esc(s.notes)}</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="empty">No handover steps stated.</p>';
  return { ops, handover };
}

export function renderDossierHtml(d: Dossier): string {
  const c = d.summary.counts;
  const tile = (v: string | number, l: string, bad = false) => `<div class="tile${bad ? ' bad' : ''}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
  const api = d.routes.routes.filter(r => r.kind === 'api');
  const pages = d.routes.routes.filter(r => r.kind === 'page');
  const multi = d.routes.services.length > 1;
  const svc = (s: string) => (s || '.');
  const { ops, handover } = statedSections(d.stated, d);
  const sig = (b: boolean) => (b ? '●' : '·');

  const sections: [id: string, title: string, kind: 'measured' | 'stated' | 'both', body: string][] = [
    ['summary', 'Summary', 'both', `
      ${d.app.one_liner ? `<p class="summary">${esc(d.app.one_liner)} ${label('stated')}</p>` : ''}
      <p class="summary">${esc(d.summary.text)} ${label('measured')}</p>
      <div class="tiles">
        ${tile(c.api_endpoints, 'API endpoints')}${tile(c.pages, 'pages')}${tile(c.models, 'data models')}${tile(c.integrations, 'integrations')}
        ${tile(c.webhooks, `webhooks${c.webhooks_unverified ? `, ${c.webhooks_unverified} unverified` : ''}`, c.webhooks_unverified > 0)}
        ${tile(c.env_vars, 'env vars (names)')}${tile(c.test_cases, `test cases in ${c.test_files} files`)}${tile(c.commits, `commits, ${c.contributors} contributor${c.contributors === 1 ? '' : 's'}`)}
        ${tile(c.source_lines.toLocaleString('en-US'), 'source lines')}${tile(d.gaps.filter(g => g.severity === 'high').length, 'high-severity gaps', d.gaps.some(g => g.severity === 'high'))}
        ${d.stated?.costs?.length ? tile(usd(c.monthly_cost_usd_stated), 'per month (stated)') : ''}
      </div>
      ${d.app.status ? `<p>Status: <b>${esc(d.app.status)}</b> ${label('stated')}</p>` : ''}
      ${d.app.urls.length ? `<p>Live URLs ${label('stated')}: ${d.app.urls.map(u => `<code>${esc(u)}</code>`).join(' ')}</p>` : ''}`],
    ['stack', 'Stack', 'measured', `
      ${table(['Component', 'Category', 'Declared', 'Locked', 'Where'], d.stack.frameworks.map(f => [f.name, f.category, f.version ? code(f.version) : '', f.resolved ? code(f.resolved) : '', codes(f.where)]))}
      <p>Package manager: <b>${esc(d.stack.package_manager ?? 'unknown')}</b> · lockfiles: ${cell(codes(d.stack.lockfiles))} · TypeScript: ${cell(yes(d.stack.typescript))}</p>
      ${d.stack.runtime_pins.length ? `<p>Runtime pins: ${d.stack.runtime_pins.map(p => `<code>${esc(p.value)}</code> <span class="soft">(${esc(p.file)})</span>`).join(' · ')}</p>` : ''}
      ${d.stack.next.length ? `<p>Next.js routing: ${d.stack.next.map(n => `<code>${esc(n.root)}</code> ${[n.app_router ? 'app router' : '', n.pages_router ? 'pages router' : ''].filter(Boolean).join(' + ') || 'no routes found'}`).join('; ')}</p>` : ''}
      <h3>Packages</h3>${table(['package.json', 'Name', 'Version', 'Deps', 'Dev deps', 'Scripts'], d.stack.packages.map(p => [code(p.path), p.name, p.version, p.dependencies, p.dev_dependencies, codes(p.script_names, 10)]))}`],
    ['architecture', 'Architecture diagram', 'measured', `
      <p>Drawn from the collected graph: each route group is linked to the data stores and vendors its handlers (and the helpers they import, two hops) reference. Dashed lines are inbound calls from a vendor to a webhook.</p>
      <div class="figure">${renderGraphSvg(d.graph, { titles: COLUMN_TITLES, label: `Architecture of ${d.app.name}` })}</div>
      <p class="legend">Red outline: a webhook with no signature check. Hover a box for its full name. The diagram scrolls sideways on a narrow screen.</p>`],
    ['data', 'Data model', 'measured', `
      ${table(['Store', 'Evidence'], d.models.stores.map(s => [s.label, codes(s.evidence, 4)]), 'No database dependency found.')}
      <div class="cards">${d.models.models.map(m => `<div class="card"><h3>${esc(m.name)} <span class="soft">· ${esc(m.orm)} → ${esc(m.store)}</span></h3>
        <p class="soft">${m.collection ? `${m.orm === 'mongoose' ? 'collection' : 'table'} <code>${esc(m.collection)}</code>${m.collection_source === 'inferred' ? ' (default name, inferred)' : ''} · ` : ''}<code>${esc(m.file)}</code>${m.timestamps ? ' · timestamps' : ''}</p>
        ${table(['Field', 'Type', 'Flags'], m.fields.slice(0, 40).map(f => [f.name, code(f.type), [f.required ? 'required' : '', f.unique ? 'unique' : '', f.index ? 'indexed' : '', f.ref ? `→ ${f.ref}` : '', f.enum ? `one of ${f.enum.join(', ')}` : ''].filter(Boolean).join(' · ')]), 'No fields parsed.')}
        ${m.fields.length > 40 ? `<p class="soft">+${m.fields.length - 40} more fields</p>` : ''}
        <p class="soft">Indexes: ${m.indexes.length ? m.indexes.map(i => `<code>${esc(i.fields.join(', '))}</code>${i.unique ? ' unique' : ''}${i.name ? ` (${esc(i.name)})` : ''}`).join(' · ') : 'none declared'}</p></div>`).join('') || '<p class="empty">No schemas or tables found.</p>'}</div>`],
    ['api', 'API surface', 'measured', `
      <p>${api.length} API routes (${c.api_endpoints} method handlers) and ${pages.length} pages. Signals: ● present, · not seen in the handler file. They are hints, not proof.</p>
      ${table([...(multi ? ['Service'] : []), 'Methods', 'Path', 'Auth', 'Middleware', 'Tenant', 'Rate limit', 'Validation', 'File'], api.map(r => [...(multi ? [svc(r.service)] : []), r.methods.join(' '), code(r.path), sig(r.signals.auth), sig(r.signals.middleware_auth), sig(r.signals.tenant), sig(r.signals.rate_limit), sig(r.signals.validation), code(r.file)]), 'No API routes found.')}
      ${d.routes.middleware.length ? `<p>Middleware: ${d.routes.middleware.map(m => `<code>${esc(m.file)}</code> ${m.auth ? 'checks auth' : 'no auth check seen'}${m.matchers.length ? ` on ${m.matchers.map(x => `<code>${esc(x)}</code>`).join(' ')}` : ' on every route'}${m.bypass?.length ? `, but returns before checking for ${m.bypass.map(x => `<code>${esc(x)}</code>`).join(' ')}` : ''}`).join('; ')}</p>` : ''}
      <h3>Pages</h3>${table([...(multi ? ['Service'] : []), 'Path', 'Router', 'File'], pages.map(r => [...(multi ? [svc(r.service)] : []), code(r.path), r.framework, code(r.file)]), 'No pages found.')}`],
    ['integrations', 'Integrations & webhooks', 'measured', `
      ${table(['Vendor', 'Category', 'SDK packages', 'API hosts', 'Env names', 'Used in'], d.integrations.integrations.map(i => [i.label, i.category, codes(i.packages), codes(i.hosts), codes(i.env), codes(i.files, 4)]), 'No third-party integrations found.')}
      ${d.integrations.other_hosts.length ? `<h3>Other outbound hosts</h3>${table(['Host', 'Called from'], d.integrations.other_hosts.map(h => [code(h.host), codes(h.files, 3)]))}` : ''}
      <h3>Inbound webhooks</h3>${table(['Path', 'Sender', 'Signature verified', 'How', 'Raw body', 'Idempotency signal', 'File'], d.webhooks.map(w => [code(w.path), w.vendor ?? '', yes(w.verified, true), w.verification.join(', '), yes(w.raw_body), yes(w.idempotency), code(w.file)]), 'No webhook endpoints found.')}`],
    ['security', 'Auth & security posture', 'measured', `
      <p>Sign-in: <b>${esc(d.auth.libraries.join(', ') || 'no auth library found')}</b>${d.auth.nextauth ? ` · providers ${cell(codes(d.auth.nextauth.providers))} · session ${esc(d.auth.nextauth.session_strategy ?? 'default')}${d.auth.nextauth.adapter ? ` · adapter ${esc(d.auth.nextauth.adapter)}` : ''}` : ''}</p>
      <p>Password hashing: ${cell(codes(d.auth.password_hashing))} · roles seen: ${cell(codes(d.auth.roles, 12))} · API-key checks in: ${cell(codes(d.auth.api_key_files, 4))}</p>
      <div class="tiles">${tile(`${d.auth.api_routes.with_auth_signal + 0}/${d.auth.api_routes.total}`, 'API routes with an auth check in the handler')}${tile(`${d.auth.api_routes.with_middleware_auth}/${d.auth.api_routes.total}`, 'covered by auth middleware')}${tile(`${d.auth.api_routes.with_tenant_signal}/${d.auth.api_routes.total}`, 'reference a tenant id')}${tile(`${d.auth.api_routes.with_rate_limit}/${d.auth.api_routes.total}`, 'rate limited in the handler')}</div>
      ${table(['Practice', 'Seen', 'Where'], d.auth.signals.map(s => [s.label, yes(s.present), codes(s.files, 4)]))}
      <h3>Secrets and settings, by name</h3>
      <p>Values are never read. Real <code>.env</code> files are excluded from the snapshot; names come from code references, ${d.env.example_files.length ? d.env.example_files.map(f => `<code>${esc(f)}</code>`).join(', ') : 'no example file'}, CI and Dockerfiles.</p>
      ${table(['Name', 'Kind', 'Sources', 'Files reading it'], d.env.vars.map(v => [code(v.name), v.kind, v.sources.join(', '), v.code_files]), 'No environment variables referenced.')}
      ${d.env.undocumented.length ? `<p>Used in code but missing from the example file: ${cell(codes(d.env.undocumented, 30))}</p>` : ''}
      ${d.env.unused_examples.length ? `<p class="soft">In the example file but not read by code: ${cell(codes(d.env.unused_examples, 30))}</p>` : ''}`],
    ['ops', 'Jobs & deploy', 'measured', `
      <h3>Scheduled jobs</h3>
      ${table(['Source', 'Schedule', 'Calls', 'File'], [...d.jobs.vercel_crons.map(j => ['Vercel cron', `${j.describe} (${j.schedule})`, code(j.path), code(j.file)]), ...d.jobs.workflow_schedules.flatMap(w => w.cron.map(cr => [`GitHub Actions${w.name ? `: ${w.name}` : ''}`, `${cr.describe} (${cr.schedule})`, codes(w.calls_paths), code(w.file)] as Cell[]))], 'No schedules found.')}
      ${d.jobs.cron_routes.length ? table(['Cron route', 'Secret check', 'Scheduled by', 'File'], d.jobs.cron_routes.map(r => [code(r.path), yes(r.secret_check, true), r.scheduled_by.join('; ') || 'nothing found', code(r.file)])) : ''}
      ${d.jobs.libraries.length || d.jobs.in_process.length ? `<p>Queues and schedulers: ${cell(codes([...d.jobs.libraries, ...d.jobs.in_process.map(x => `${x.lib} in ${x.file}`)]))}</p>` : ''}
      <h3>Deploy targets</h3>
      ${table(['Platform', 'File', 'Settings'], d.deploy.targets.map(t => [t.platform, code(t.file), Object.entries(t.detail).map(([k, v]) => `${k}: ${v}`).join(' · ')]), 'No deploy configuration found.')}
      ${d.deploy.docker.length ? table(['Dockerfile', 'Base images', 'Stages', 'Exposes', 'User', 'Healthcheck'], d.deploy.docker.map(x => [code(x.file), codes(x.base_images), x.stages, x.exposes.join(', '), x.user ?? raw('<span class="bad">root</span>'), yes(x.healthcheck)])) : ''}
      <h3>CI workflows</h3>
      ${table(['Workflow', 'Triggers', 'Jobs', 'Deploys to', 'File'], d.deploy.workflows.map(w => [w.name ?? '', w.triggers.join(', '), w.jobs.join(', '), w.deploys_with.join(', '), code(w.file)]), 'No GitHub Actions workflows.')}`],
    ['tests', 'Tests', 'measured', `
      <div class="tiles">${tile(d.tests.total_files, 'test files')}${tile(d.tests.total_cases, 'test cases (static count)')}${tile(d.tests.by_kind.unit.cases, 'unit')}${tile(d.tests.by_kind.integration.cases, 'integration')}${tile(d.tests.by_kind.e2e.cases, 'end-to-end')}
      ${d.tests.ingested ? `${tile(d.tests.ingested.passed, 'passed in supplied run')}${tile(d.tests.ingested.failed, 'failed in supplied run', d.tests.ingested.failed > 0)}` : ''}</div>
      <p>Frameworks: ${cell(codes(d.tests.frameworks))} · config: ${cell(codes(d.tests.config_files))}${d.tests.ingested ? ` · run output ingested from <code>${esc(d.tests.ingested.file_name)}</code> (${esc(d.tests.ingested.format)}, ${d.tests.ingested.total} total)` : ' · no run output supplied (counts are from reading the files, not from running them)'}</p>
      ${table(['File', 'Kind', 'Cases'], d.tests.files.slice(0, 200).map(f => [code(f.path), f.kind, f.cases]), 'No test files found.')}
      <h3>Documentation in the repository</h3>
      ${table(['Document', 'Title', 'Kind', 'Lines'], d.docs.slice(0, 80).map(x => [code(x.path), x.title, x.kind, x.lines]), 'No Markdown documents.')}
      <h3>Code size and history</h3>
      ${table(['Language', 'Files', 'Non-blank lines'], d.size.by_language.map(r => [r.key, r.files, r.lines]))}
      ${table(['Folder', 'Files', 'Non-blank lines'], d.size.by_folder.slice(0, 20).map(r => [code(r.key), r.files, r.lines]))}
      ${d.git ? `<p>${d.git.commits} commits by ${d.git.contributors} contributor${d.git.contributors === 1 ? '' : 's'} (a count; no names are recorded) from ${esc(d.git.first_commit.slice(0, 10))} to ${esc(d.git.last_commit.slice(0, 10))}, on ${d.git.active_days} distinct days; ${d.git.commits_last_30d} in the 30 days and ${d.git.commits_last_90d} in the 90 days before HEAD.</p>
      ${table(['Folder', 'Commits touching it', 'Lines added', 'Lines deleted'], d.git.churn.slice(0, 15).map(r => [code(r.folder), r.commits, r.added, r.deleted]))}` : '<p class="empty">Git history unavailable.</p>'}`],
    ['costs', 'Operations & costs', 'stated', ops],
    ['handover', 'Handover checklist', 'stated', handover],
    ['gaps', 'Known gaps', 'both', d.gaps.length ? `<ul class="gaps">${d.gaps.map(gapItem).join('')}</ul>` : '<p class="empty">No gaps derived and none stated.</p>'],
    ['provenance', 'Provenance', 'measured', `
      ${table(['Field', 'Value'], [
        ['Repository', d.provenance.repo_name + (d.provenance.subdir ? ` / ${d.provenance.subdir}` : '')],
        ['Remote', d.provenance.remote ?? '—'],
        ['Commit', code(d.provenance.commit)], ['Commit date', d.provenance.commit_date], ['Branch', d.provenance.branch],
        ['Snapshot', d.provenance.snapshot], ['Generated at', d.provenance.generated_at],
        ['Tool', `${d.provenance.tool} ${d.provenance.tool_version} (plate ${d.provenance.plate})`], ['Run id', d.provenance.run_id ?? '—'],
        ['Facts file', d.provenance.facts_file ?? 'none'], ['Test output file', d.provenance.test_output_file ?? 'none'],
        ['Secret-like files excluded unread', codes(d.provenance.secret_like_files_excluded, 20)],
        ['Symbolic links not followed', d.provenance.symlinks_not_followed],
      ])}
      ${table(['Collector', 'Result', 'Time'], d.provenance.collectors.map(x => [x.name, x.ok ? raw('<span class="ok">ok</span>') : raw(`<span class="bad">failed</span> ${esc(x.error ?? '')}`), `${x.ms} ms`]))}
      <p class="soft">“Measured” means read from the committed source at this commit or from git history by static analysis; nothing was executed and no service was called. “Stated” means written by the owner in the facts file and not verified here.</p>`],
  ];

  const labFor = (k: 'measured' | 'stated' | 'both') => (k === 'both' ? `${label('measured')} ${label('stated')}` : label(k));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>${esc(d.app.name)} dossier</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Architecture dossier</div>
  <h1>${esc(d.app.name)}</h1>
  <div class="meta"><span>commit <code>${esc(d.provenance.commit_short)}</code></span><span>${esc(d.provenance.commit_date.slice(0, 10))}</span><span>branch ${esc(d.provenance.branch)}</span><span>generated ${esc(d.provenance.generated_at.slice(0, 16).replace('T', ' '))} UTC</span></div>
  <div class="confidential">Confidential. Prepared for the owner as a record of how this app is built, deployed and operated at the commit above.</div>
</header>
<nav class="toc" aria-label="Sections">${sections.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join('')}</nav>
${sections.map(([id, t, k, body]) => `<section id="${id}"><h2>${esc(t)} ${labFor(k)}</h2>${body}</section>`).join('\n')}
<footer>Generated by ${esc(d.provenance.tool)} ${esc(d.provenance.tool_version)} from commit ${esc(d.provenance.commit)}. Machine-readable copy: dossier.json.</footer>
</div>
</body>
</html>
`;
}
