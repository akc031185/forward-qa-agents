// Collector: routes and API surface. Next.js pages router (pages/, pages/api/), app router
// (page files and route handlers with their exported methods), and Fastify / Express / Hono
// style `app.get('/x', …)` and `app.route({ method, url })` registrations.
import path from 'node:path';
import { RepoFiles, depsOf, isTestPath, packageOf, readPackages, sortUniq, str } from './files.js';
import { AUTH_RE, RATE_LIMIT_RE, TENANT_RE, VALIDATION_RE } from './signals.js';

export type RouteFramework = 'next-app' | 'next-pages' | 'fastify' | 'express' | 'hono' | 'koa' | 'server';
export interface RouteSignals { auth: boolean; middleware_auth: boolean; rate_limit: boolean; tenant: boolean; validation: boolean }
export interface Route {
  path: string; methods: string[]; kind: 'page' | 'api'; framework: RouteFramework;
  file: string; service: string; group: string; signals: RouteSignals;
}
export interface Middleware { file: string; matchers: string[]; auth: boolean; bypass?: string[] }

/** Path prefixes a middleware returns early for before its first auth call, e.g.
 *  `if (pathname.startsWith('/api/')) return NextResponse.next();` — the matcher covers those
 *  paths, but the middleware does not guard them. */
export function middlewareBypass(src: string): string[] {
  const authAt = src.search(AUTH_RE);
  const out: string[] = [];
  for (const m of src.matchAll(/if\s*\(\s*[\w.]+\.startsWith\(\s*['"`](\/[^'"`]*)['"`]\s*\)\s*\)\s*\{?\s*return\b/g)) {
    if (authAt < 0 || m.index! < authAt) out.push(m[1]!);
  }
  return sortUniq(out);
}
const bypassed = (prefixes: string[] | undefined, p: string) => (prefixes ?? []).some(b => { const x = b.replace(/\/$/, ''); return p === x || p.startsWith(`${x}/`); });
export interface RoutesResult { routes: Route[]; middleware: Middleware[]; services: { dir: string; name: string }[] }

const HTTP = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** `a/(group)/[id]/[...slug]/page.tsx` → `/a/:id/*slug`; undefined for private (`_x`) folders. */
export function nextPathFromSegments(segs: string[]): string | undefined {
  const out: string[] = [];
  for (const s of segs) {
    if (s.startsWith('_')) return undefined;
    if (/^\(.*\)$/.test(s) || s.startsWith('@')) continue;
    const opt = /^\[\[\.\.\.(.+)\]\]$/.exec(s); if (opt) { out.push(`*${opt[1]}?`); continue; }
    const all = /^\[\.\.\.(.+)\]$/.exec(s); if (all) { out.push(`*${all[1]}`); continue; }
    const dyn = /^\[(.+)\]$/.exec(s); if (dyn) { out.push(`:${dyn[1]}`); continue; }
    out.push(s);
  }
  return `/${out.join('/')}`;
}

/** Exported HTTP method handlers of an app-router route file. */
export function appRouteMethods(src: string): string[] {
  const m = new Set<string>();
  for (const x of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)\b/g)) m.add(x[1]!);
  for (const x of src.matchAll(/export\s+(?:const|let|var)\s+([A-Z]+)\s*=/g)) m.add(x[1]!);
  for (const x of src.matchAll(/export\s+(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) for (const n of x[1]!.split(',')) m.add(n.split(':').pop()!.trim());
  for (const x of src.matchAll(/export\s*\{([^}]*)\}/g)) for (const n of x[1]!.split(',')) { const a = /\bas\s+([A-Z]+)\s*$/.exec(n.trim()); m.add(a ? a[1]! : n.trim()); }
  return HTTP.filter(h => m.has(h));
}

/** Methods a pages-router API handler branches on; ANY when it does not branch. */
export function pagesApiMethods(src: string): string[] {
  const m = new Set<string>();
  for (const x of src.matchAll(/req\.method\s*[!=]==?\s*['"]([A-Z]+)['"]/g)) m.add(x[1]!);
  for (const x of src.matchAll(/case\s+['"]([A-Z]+)['"]\s*:/g)) m.add(x[1]!);
  for (const x of src.matchAll(/\[\s*((?:['"][A-Z]+['"]\s*,?\s*)+)\]\s*\.includes\(\s*req\.method/g)) for (const y of x[1]!.matchAll(/['"]([A-Z]+)['"]/g)) m.add(y[1]!);
  const found = HTTP.filter(h => m.has(h));
  return found.length ? found : ['ANY'];
}

const SERVER_OBJ = /^(app|server|fastify|router|api|instance|routes|srv|r|f|v1|admin|publicRoutes|privateRoutes)$/;

/** `app.get('/x', …)` and `app.route({ method: 'GET', url: '/x' })` in a server file. */
export function serverRoutes(src: string): { method: string; path: string }[] {
  const out: { method: string; path: string }[] = [];
  for (const x of src.matchAll(/\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|head|options|all)\s*(?:<[^>]*>)?\(\s*(['"`])(\/[^'"`]*)\3/g)) {
    if (SERVER_OBJ.test(x[1]!)) out.push({ method: x[2] === 'all' ? 'ANY' : x[2]!.toUpperCase(), path: x[4]! });
  }
  for (const x of src.matchAll(/\.route\s*\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
    const body = x[1]!;
    const url = /\b(?:url|path)\s*:\s*['"`](\/[^'"`]*)['"`]/.exec(body)?.[1];
    if (!url) continue;
    const mm = /\bmethod\s*:\s*(\[[^\]]*\]|['"][A-Za-z]+['"])/.exec(body)?.[1] ?? "'ANY'";
    for (const y of mm.matchAll(/['"]([A-Za-z]+)['"]/g)) out.push({ method: y[1]!.toUpperCase(), path: url });
  }
  return out;
}

export function groupOf(p: string, kind: 'page' | 'api'): string {
  const segs = p.split('/').filter(Boolean);
  if (!segs.length) return '/';
  if (segs[0] === 'api' && segs.length > 1) return `/api/${segs[1]}`;
  return kind === 'api' && segs[0] === 'api' ? '/api' : `/${segs[0]}`;
}

export function matcherCovers(matcher: string, p: string): boolean {
  if (matcher === '/') return p === '/';
  const neg = /^\/\(\(\?!([^)]*)\)/.exec(matcher);
  if (neg) { const first = p.split('/').filter(Boolean)[0] ?? ''; return !neg[1]!.split('|').some(x => x && (first === x || first.startsWith(x.replace(/\\\./g, '.').split('/')[0]!))); }
  const prefix = matcher.split(/[:(]/)[0]!.replace(/\/$/, '');
  return prefix === '' ? true : p === prefix || p.startsWith(`${prefix}/`);
}

export function collectRoutes(repo: RepoFiles): RoutesResult {
  const pkgs = readPackages(repo);
  const routes: Route[] = [];
  const middleware: Middleware[] = [];
  const serviceName = (rel: string) => { const p = packageOf(pkgs, rel); return p?.dir ?? ''; };

  const signalsOf = (src: string): Omit<RouteSignals, 'middleware_auth'> => ({
    auth: AUTH_RE.test(src), rate_limit: RATE_LIMIT_RE.test(src), tenant: TENANT_RE.test(src), validation: VALIDATION_RE.test(src),
  });

  const nextRoots = pkgs.filter(p => 'next' in depsOf(p)).map(p => p.dir);
  for (const root of nextRoots) {
    const pre = root ? `${root}/` : '';
    for (const f of repo.files.filter(x => x.startsWith(pre) && !isTestPath(x.slice(pre.length)))) {
      const rest = f.slice(pre.length);
      const mw = /^(src\/)?middleware\.(ts|js|mjs)$/.exec(rest);
      if (mw) {
        const src = repo.text(f) ?? '';
        const block = /matcher\s*:\s*(\[[\s\S]*?\]|['"][^'"]+['"])/.exec(src)?.[1] ?? '';
        const matchers = [...block.matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]!);
        middleware.push({ file: f, matchers, auth: AUTH_RE.test(src) || /export\s*\{\s*auth\s+as\s+middleware|export\s+default\s+(auth|withAuth|clerkMiddleware|authMiddleware)\b|NextAuth\(/.test(src), bypass: middlewareBypass(src) });
        continue;
      }
      const pages = /^(src\/)?pages\/(.+)\.(tsx|ts|jsx|js|mdx)$/.exec(rest);
      if (pages) {
        const segs = pages[2]!.split('/');
        if (/^_(app|document|error|middleware)$/.test(segs[segs.length - 1]!)) continue;
        if (segs[segs.length - 1] === 'index') segs.pop();
        const p = nextPathFromSegments(segs); if (!p) continue;
        const src = repo.text(f) ?? '';
        const kind = segs[0] === 'api' ? 'api' : 'page';
        routes.push({ path: p, methods: kind === 'api' ? pagesApiMethods(src) : ['GET'], kind, framework: 'next-pages', file: f, service: root, group: groupOf(p, kind), signals: { ...signalsOf(src), middleware_auth: false } });
        continue;
      }
      const app = /^(src\/)?app\/((?:.+\/)?)(page|route)\.(tsx|ts|jsx|js|mdx)$/.exec(rest);
      if (app) {
        const p = nextPathFromSegments(app[2]!.split('/').filter(Boolean)); if (!p) continue;
        const src = repo.text(f) ?? '';
        const kind = app[3] === 'route' ? 'api' : 'page';
        const methods = kind === 'api' ? appRouteMethods(src) : ['GET'];
        routes.push({ path: p, methods: methods.length ? methods : ['ANY'], kind, framework: 'next-app', file: f, service: root, group: groupOf(p, kind), signals: { ...signalsOf(src), middleware_auth: false } });
      }
    }
  }

  const nextFiles = new Set(routes.map(r => r.file));
  for (const f of repo.code()) {
    if (nextFiles.has(f) || isTestPath(f) || !/\.[cm]?[jt]sx?$/.test(f)) continue;
    const src = repo.text(f) ?? '';
    const fwm = /from\s+['"](fastify|express|hono|koa|@koa\/router|koa-router)['"]|require\(\s*['"](fastify|express|hono|koa|@koa\/router|koa-router)['"]\s*\)|FastifyInstance|FastifyPluginAsync|express\.Router\(/.exec(src);
    const pkg = packageOf(pkgs, f);
    const deps = pkg ? depsOf(pkg) : {};
    const byDep = ['fastify', 'express', 'hono', 'koa'].find(d => d in deps);
    if (!fwm && !byDep) continue;
    const label = (fwm?.[1] ?? fwm?.[2] ?? (fwm ? (/Fastify/.test(fwm[0]) ? 'fastify' : 'express') : byDep) ?? 'server').replace(/^@koa\/router|koa-router$/, 'koa');
    const framework: RouteFramework = (['fastify', 'express', 'hono', 'koa'] as const).find(x => label === x) ?? 'server';
    const sig = signalsOf(src);
    const byPath = new Map<string, Set<string>>();
    for (const r of serverRoutes(src)) { const s = byPath.get(r.path) ?? new Set(); s.add(r.method); byPath.set(r.path, s); }
    for (const [p, ms] of byPath) {
      routes.push({ path: p, methods: HTTP.filter(h => ms.has(h)).concat(ms.has('ANY') ? ['ANY'] : []), kind: 'api', framework, file: f, service: serviceName(f), group: groupOf(p, 'api'), signals: { ...sig, middleware_auth: false } });
    }
  }

  for (const r of routes) {
    const mw = middleware.find(m => (r.service ? m.file.startsWith(`${r.service}/`) : true) && m.auth);
    if (mw) r.signals.middleware_auth = (mw.matchers.length === 0 || mw.matchers.some(m => matcherCovers(m, r.path))) && !bypassed(mw.bypass, r.path);
  }

  routes.sort((a, b) => a.service.localeCompare(b.service) || a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
  const services = sortUniq(routes.map(r => r.service)).map(dir => {
    const p = pkgs.find(x => x.dir === dir);
    return { dir, name: str(p?.json.name) ?? (dir ? path.posix.basename(dir) : 'app') };
  });
  return { routes, middleware, services };
}
