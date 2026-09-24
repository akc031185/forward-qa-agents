// Collector: stack and versions. package.json files, lockfile-resolved versions, runtime pins,
// and which framework shape is in use (Next.js pages router, app router, or both).
import { RepoFiles, depsOf, readPackages, sortUniq, str, type PackageJson } from './files.js';

export type FrameworkCategory = 'framework' | 'server' | 'ui' | 'data' | 'auth' | 'validation' | 'test' | 'jobs' | 'tooling' | 'browser';

export interface Framework { name: string; category: FrameworkCategory; package: string; version?: string; resolved?: string; where: string[] }
export interface PackageSummary {
  path: string; name?: string; version?: string; description?: string; private?: boolean;
  script_names: string[]; node_engine?: string; dependencies: number; dev_dependencies: number;
}
export interface NextRouter { root: string; pages_router: boolean; app_router: boolean }
export interface StackResult {
  packages: PackageSummary[];
  package_manager?: string;
  lockfiles: string[];
  frameworks: Framework[];
  typescript: boolean;
  runtime_pins: { file: string; value: string }[];
  next: NextRouter[];
}

const CATALOG: [pkg: string, name: string, category: FrameworkCategory][] = [
  ['next', 'Next.js', 'framework'], ['nuxt', 'Nuxt', 'framework'], ['@sveltejs/kit', 'SvelteKit', 'framework'],
  ['astro', 'Astro', 'framework'], ['@remix-run/node', 'Remix', 'framework'], ['vite', 'Vite', 'tooling'],
  ['react', 'React', 'ui'], ['vue', 'Vue', 'ui'], ['svelte', 'Svelte', 'ui'], ['tailwindcss', 'Tailwind CSS', 'ui'],
  ['fastify', 'Fastify', 'server'], ['express', 'Express', 'server'], ['hono', 'Hono', 'server'], ['koa', 'Koa', 'server'], ['@nestjs/core', 'NestJS', 'server'],
  ['mongoose', 'Mongoose', 'data'], ['mongodb', 'MongoDB driver', 'data'], ['@prisma/client', 'Prisma', 'data'], ['drizzle-orm', 'Drizzle ORM', 'data'],
  ['typeorm', 'TypeORM', 'data'], ['sequelize', 'Sequelize', 'data'], ['pg', 'node-postgres', 'data'], ['mysql2', 'mysql2', 'data'],
  ['better-sqlite3', 'better-sqlite3', 'data'], ['sqlite3', 'sqlite3', 'data'], ['ioredis', 'ioredis', 'data'], ['redis', 'node-redis', 'data'],
  ['@upstash/redis', 'Upstash Redis', 'data'], ['@vercel/postgres', 'Vercel Postgres', 'data'], ['@vercel/kv', 'Vercel KV', 'data'],
  ['@neondatabase/serverless', 'Neon serverless', 'data'], ['@supabase/supabase-js', 'Supabase client', 'data'],
  ['next-auth', 'NextAuth / Auth.js', 'auth'], ['@auth/core', 'Auth.js core', 'auth'], ['@auth/mongodb-adapter', 'Auth.js MongoDB adapter', 'auth'],
  ['@clerk/nextjs', 'Clerk', 'auth'], ['lucia', 'Lucia', 'auth'], ['jsonwebtoken', 'jsonwebtoken', 'auth'], ['jose', 'jose', 'auth'],
  ['bcrypt', 'bcrypt', 'auth'], ['bcryptjs', 'bcryptjs', 'auth'], ['argon2', 'argon2', 'auth'],
  ['zod', 'Zod', 'validation'], ['yup', 'Yup', 'validation'], ['joi', 'Joi', 'validation'],
  ['typescript', 'TypeScript', 'tooling'], ['tsx', 'tsx', 'tooling'],
  ['vitest', 'Vitest', 'test'], ['jest', 'Jest', 'test'], ['@playwright/test', 'Playwright Test', 'test'], ['playwright', 'Playwright', 'test'], ['playwright-core', 'Playwright core', 'test'], ['puppeteer', 'Puppeteer', 'test'], ['puppeteer-core', 'Puppeteer core', 'test'],
  ['mocha', 'Mocha', 'test'], ['cypress', 'Cypress', 'test'], ['@testing-library/react', 'Testing Library', 'test'], ['supertest', 'supertest', 'test'],
  ['bullmq', 'BullMQ', 'jobs'], ['node-cron', 'node-cron', 'jobs'], ['agenda', 'Agenda', 'jobs'], ['inngest', 'Inngest', 'jobs'],
  ['@trigger.dev/sdk', 'Trigger.dev', 'jobs'], ['@upstash/qstash', 'QStash', 'jobs'],
];

/** A browser-automation library in runtime `dependencies` drives a browser in production (a crawler,
 *  a PDF renderer); only as a devDependency is it test tooling. `@playwright/test` is always a runner. */
export function runtimeCategory(p: PackageJson, pkg: string, category: FrameworkCategory): FrameworkCategory {
  if (!BROWSER_LIBS.has(pkg)) return category;
  const runtime = p.json.dependencies && typeof p.json.dependencies === 'object' && pkg in (p.json.dependencies as Record<string, string>);
  return runtime ? 'browser' : category;
}
const BROWSER_LIBS = new Set(['playwright', 'playwright-core', 'puppeteer', 'puppeteer-core']);

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The installed version a lockfile pins, when the lockfile says. */
export function resolvedVersion(lockName: string, lockText: string, pkg: string): string | undefined {
  if (lockName.endsWith('package-lock.json')) {
    try {
      const lock = JSON.parse(lockText) as { packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> };
      if (lock.packages) {
        // The top-level install wins; a copy nested under another package (a v4 pulled in by a plugin)
        // is not the version the app resolves.
        const key = `node_modules/${pkg}` in lock.packages ? `node_modules/${pkg}` : Object.keys(lock.packages).find(k => k.endsWith(`/node_modules/${pkg}`));
        if (key) return lock.packages[key]?.version;
      }
      return lock.dependencies?.[pkg]?.version;
    } catch { return undefined; }
  }
  if (lockName.endsWith('yarn.lock')) return new RegExp(`^"?${escRe(pkg)}@[^\\n]*:\\n\\s+version:? "?([^"\\n]+)"?`, 'm').exec(lockText)?.[1];
  if (lockName.endsWith('pnpm-lock.yaml')) return new RegExp(`^\\s+'?/?${escRe(pkg)}@(\\d[^\\s:('"]*)`, 'm').exec(lockText)?.[1];
  return undefined;
}

export function collectStack(repo: RepoFiles): StackResult {
  const pkgs = readPackages(repo);
  const lockfiles = repo.files.filter(f => /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json)$/.test(f));
  const rootPkg = pkgs.find(p => p.dir === '');
  const pm = str(rootPkg?.json.packageManager)?.split('@')[0]
    ?? (lockfiles.some(f => f.endsWith('pnpm-lock.yaml')) ? 'pnpm' : lockfiles.some(f => f.endsWith('yarn.lock')) ? 'yarn'
      : lockfiles.some(f => /bun\.lockb?$/.test(f)) ? 'bun' : lockfiles.some(f => f.endsWith('package-lock.json')) ? 'npm' : undefined);

  const lockTexts = lockfiles.map(f => ({ f, t: repo.text(f, 50_000_000) })).filter((x): x is { f: string; t: string } => !!x.t);
  const fw = new Map<string, Framework>();
  for (const p of pkgs) {
    const deps = depsOf(p);
    for (const [pkg, name, category] of CATALOG) {
      if (!(pkg in deps)) continue;
      const cur = fw.get(pkg) ?? { name, category: runtimeCategory(p, pkg, category), package: pkg, version: deps[pkg], where: [] };
      cur.where.push(p.dir || '.');
      if (!cur.resolved) {
        const own = lockTexts.filter(l => l.f === (p.dir ? `${p.dir}/` : '') + l.f.split('/').pop()).concat(lockTexts);
        for (const l of own) { const v = resolvedVersion(l.f, l.t, pkg); if (v) { cur.resolved = v; break; } }
      }
      fw.set(pkg, cur);
    }
  }
  if (repo.code().some(f => /from\s+['"]node:sqlite['"]|require\(\s*['"]node:sqlite['"]\s*\)/.test(repo.text(f) ?? ''))) {
    fw.set('node:sqlite', { name: 'node:sqlite (built in)', category: 'data', package: 'node:sqlite', where: ['.'] });
  }

  const runtime_pins: { file: string; value: string }[] = [];
  for (const f of repo.files.filter(x => /(^|\/)(\.nvmrc|\.node-version|\.tool-versions)$/.test(x))) {
    const v = (repo.text(f) ?? '').trim().split('\n')[0]?.slice(0, 40);
    if (v) runtime_pins.push({ file: f, value: v });
  }
  for (const f of repo.files.filter(x => /(^|\/)Dockerfile[^/]*$/.test(x))) {
    for (const m of (repo.text(f) ?? '').matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(node:[\w.-]+|oven\/bun:[\w.-]+|python:[\w.-]+)/gim)) runtime_pins.push({ file: f, value: m[1]! });
  }
  for (const p of pkgs) {
    const e = p.json.engines as Record<string, unknown> | undefined;
    if (e && typeof e === 'object' && typeof e.node === 'string') runtime_pins.push({ file: p.file, value: `node ${e.node}` });
  }

  const next: NextRouter[] = [];
  for (const p of pkgs.filter(x => 'next' in depsOf(x))) {
    const pre = p.dir ? `${p.dir}/` : '';
    const inPkg = repo.files.filter(f => f.startsWith(pre));
    const rest = (f: string) => f.slice(pre.length);
    next.push({
      root: p.dir || '.',
      pages_router: inPkg.some(f => /^(src\/)?pages\/.+\.(tsx?|jsx?|mdx)$/.test(rest(f))),
      app_router: inPkg.some(f => /^(src\/)?app\/(.+\/)?(page|route|layout)\.(tsx?|jsx?|mdx)$/.test(rest(f))),
    });
  }

  return {
    packages: pkgs.map(p => {
      const deps = (p.json.dependencies && typeof p.json.dependencies === 'object') ? Object.keys(p.json.dependencies) : [];
      const dev = (p.json.devDependencies && typeof p.json.devDependencies === 'object') ? Object.keys(p.json.devDependencies) : [];
      const e = p.json.engines as Record<string, unknown> | undefined;
      return {
        path: p.file, name: str(p.json.name), version: str(p.json.version), description: str(p.json.description)?.slice(0, 300),
        private: typeof p.json.private === 'boolean' ? p.json.private : undefined,
        script_names: p.json.scripts && typeof p.json.scripts === 'object' ? Object.keys(p.json.scripts).sort() : [],
        node_engine: e && typeof e === 'object' ? str(e.node) : undefined,
        dependencies: deps.length, dev_dependencies: dev.length,
      };
    }),
    package_manager: pm,
    lockfiles,
    frameworks: [...fw.values()].map(f => ({ ...f, where: sortUniq(f.where) })),
    typescript: repo.files.some(f => /(^|\/)tsconfig(\.[\w-]+)?\.json$/.test(f)) || fw.has('typescript'),
    runtime_pins,
    next,
  };
}
