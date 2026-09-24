// Read-only view of a snapshot directory. Every collector reads file contents through this class,
// so the secret-file rule lives in one place: a secret-like path is never listed and never read,
// and symbolic links are never followed (a committed link could point anywhere on the machine).
import fs from 'node:fs';
import path from 'node:path';

export const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.vercel', '.turbo', '.cache',
  'vendor', '.venv', 'venv', '__pycache__', '.svelte-kit', '.nuxt', '.output', 'playwright-report',
  'test-results', '.pnpm-store', '.yarn',
]);

/** Templates that document variable names. The only env files that may be read, and only for names. */
const ENV_TEMPLATE = /^\.env(\.[\w-]+)*\.(example|sample|template)$/i;
export const isEnvTemplate = (rel: string) => ENV_TEMPLATE.test(rel.split('/').pop() ?? '');

/** True for any file that may hold a credential. Such files are never opened, only named. */
export function isSecretLikePath(rel: string): boolean {
  const base = (rel.split('/').pop() ?? '').toLowerCase();
  if (ENV_TEMPLATE.test(base)) return false;
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env')) return true;
  if (/\.(pem|key|p12|pfx|jks|keystore|ppk|gpg|asc)$/.test(base)) return true;
  if (/^(credentials?|secrets?)(\.[\w-]+)?$/.test(base)) return true;
  if (/^service[-_]?account.*\.json$/.test(base)) return true;
  return ['id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', '.npmrc', '.netrc', '.pypirc', '.htpasswd'].includes(base);
}

export const CODE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py|go|rb|vue|svelte|astro)$/i;
const BINARY_RE = /\.(png|jpe?g|gif|webp|avif|ico|icns|bmp|tiff?|psd|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|war|class|so|dylib|dll|exe|bin|wasm|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|webm|wav|ogg|flac|sqlite3?|db|lockb|node|heic)$/i;
export const DEFAULT_MAX_BYTES = 1_000_000;

export function isTestPath(rel: string): boolean {
  return /(^|\/)(__tests__|tests?|e2e|cypress|spec|playwright)\//.test(rel)
    || /\.(test|spec)\.[cm]?[jt]sx?$/.test(rel)
    || /(^|\/)test_[^/]+\.py$/.test(rel) || /_test\.(go|py)$/.test(rel);
}

export class RepoFiles {
  readonly files: string[] = [];
  /** Secret-like files present in the snapshot. Named, never read. */
  readonly secretLike: string[] = [];
  readonly symlinks: string[] = [];
  private readonly set = new Set<string>();
  private readonly cache = new Map<string, string | undefined>();

  constructor(readonly root: string) {
    const walk = (dir: string, rel: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const d of entries) {
        const r = rel ? `${rel}/${d.name}` : d.name;
        if (d.isSymbolicLink()) { this.symlinks.push(r); continue; }
        if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name)) walk(path.join(dir, d.name), r); continue; }
        if (!d.isFile()) continue;
        if (isSecretLikePath(r)) { this.secretLike.push(r); continue; }
        this.files.push(r); this.set.add(r);
      }
    };
    walk(root, '');
  }

  has(rel: string): boolean { return this.set.has(rel); }

  /** File text, or undefined when missing, binary or too large. Throws on a secret-like path. */
  text(rel: string, maxBytes = DEFAULT_MAX_BYTES): string | undefined {
    if (isSecretLikePath(rel)) throw new Error(`refusing to read a secret-like file: ${rel}`);
    if (!this.set.has(rel) || BINARY_RE.test(rel)) return undefined;
    const key = `${maxBytes}\u0000${rel}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let out: string | undefined;
    const abs = path.join(this.root, rel);
    const st = fs.lstatSync(abs);
    if (st.isFile() && st.size <= maxBytes) {
      const buf = fs.readFileSync(abs);
      if (!buf.includes(0)) out = buf.toString('utf8');
    }
    this.cache.set(key, out);
    return out;
  }

  /** Source files worth scanning: code, not type declarations or minified bundles. */
  code(): string[] {
    return this.files.filter(f => CODE_RE.test(f) && !/\.d\.[cm]?ts$/.test(f) && !/\.min\.js$/.test(f));
  }
}

export interface PackageJson { dir: string; file: string; json: Record<string, unknown> }

export function readPackages(repo: RepoFiles): PackageJson[] {
  const out: PackageJson[] = [];
  for (const f of repo.files.filter(x => x === 'package.json' || x.endsWith('/package.json'))) {
    try {
      const json = JSON.parse(repo.text(f) ?? '') as unknown;
      if (json && typeof json === 'object' && !Array.isArray(json)) out.push({ dir: f === 'package.json' ? '' : f.slice(0, -'/package.json'.length), file: f, json: json as Record<string, unknown> });
    } catch { /* malformed package.json: skipped */ }
  }
  return out.sort((a, b) => a.dir.split('/').length - b.dir.split('/').length || a.dir.localeCompare(b.dir));
}

export function depsOf(p: PackageJson, includeDev = true): Record<string, string> {
  const pick = (k: string) => (p.json[k] && typeof p.json[k] === 'object' ? p.json[k] as Record<string, string> : {});
  return { ...(includeDev ? pick('devDependencies') : {}), ...pick('peerDependencies'), ...pick('dependencies') };
}

/** The nearest package.json at or above a file. */
export function packageOf(pkgs: PackageJson[], rel: string): PackageJson | undefined {
  let best: PackageJson | undefined;
  for (const p of pkgs) if (p.dir === '' || rel.startsWith(`${p.dir}/`)) if (!best || p.dir.length > best.dir.length) best = p;
  return best;
}

export const str = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined);
export const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
export const sortUniq = (xs: string[]): string[] => uniq(xs).sort((a, b) => a.localeCompare(b));
