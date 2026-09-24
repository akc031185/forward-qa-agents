// Collector: environment variable NAMES. From `process.env.X` style references in code, from
// `.env.example` / `.env.sample` / `.env.template` (the name left of `=`, the value discarded on the
// same line it is read), and from CI (`secrets.X`, `vars.X`) and Dockerfiles (`ENV X` / `ARG X`).
// Real .env files are never opened: RepoFiles refuses them and they are not in the snapshot.
import { RepoFiles, isEnvTemplate, isTestPath, sortUniq } from './files.js';

export type EnvSource = 'code' | 'example' | 'ci' | 'docker';
export interface EnvVar { name: string; sources: EnvSource[]; code_files: number; public: boolean; kind: 'secret' | 'config' | 'public' }
export interface EnvResult { vars: EnvVar[]; example_files: string[]; undocumented: string[]; unused_examples: string[] }

const NAME = '([A-Z][A-Z0-9_]{0,79})';
const CODE_PATTERNS = [
  new RegExp(`process\\.env\\.${NAME}\\b`, 'g'), new RegExp(`process\\.env\\[\\s*['"]${NAME}['"]\\s*\\]`, 'g'),
  new RegExp(`import\\.meta\\.env\\.${NAME}\\b`, 'g'), new RegExp(`Deno\\.env\\.get\\(\\s*['"]${NAME}['"]`, 'g'),
  new RegExp(`Bun\\.env\\.${NAME}\\b`, 'g'), new RegExp(`os\\.environ(?:\\.get)?[\\[(]\\s*['"]${NAME}['"]`, 'g'),
  new RegExp(`os\\.getenv\\(\\s*['"]${NAME}['"]`, 'g'), new RegExp(`\\benv\\(\\s*['"]${NAME}['"]`, 'g'),
];
const IGNORE = new Set(['NODE_ENV', 'CI', 'PORT', 'HOME', 'PATH', 'PWD', 'TZ', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'NEXT_RUNTIME', 'NEXT_PHASE']);

export function namesInCode(src: string): string[] {
  const out: string[] = [];
  for (const re of CODE_PATTERNS) for (const m of src.matchAll(re)) out.push(m[1]!);
  // destructuring: const { A, B: b } = process.env
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*process\.env\b/g)) {
    for (const part of m[1]!.split(',')) { const n = part.split(/[:=]/)[0]!.trim(); if (/^[A-Z][A-Z0-9_]{0,79}$/.test(n)) out.push(n); }
  }
  return out;
}

/** Names declared in an env template. Values are discarded per line and never returned. */
export function namesInTemplate(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    // `NAME=value`, and the commented-out optional form `# NAME=` (upper case, `=` right after).
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line) ?? /^\s*#\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m) out.push(m[1]!);
  }
  return out;
}

/** Names set by `ENV` / `ARG`, including `ENV A=1 \\\n    B=2` continuation lines. Values are discarded. */
export function namesInDockerfile(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\\\r?\n/g, ' ').split('\n')) {
    const m = /^\s*(ENV|ARG)\s+(.*)$/.exec(line); if (!m) continue;
    const pairs = [...m[2]!.matchAll(/(?:^|\s)([A-Z][A-Z0-9_]*)=/g)].map(x => x[1]!);
    if (pairs.length) out.push(...pairs);
    else { const one = /^([A-Z][A-Z0-9_]*)\b/.exec(m[2]!.trim())?.[1]; if (one) out.push(one); }
  }
  return out;
}

const SECRETY = /SECRET|KEY|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|_URI$|_DSN$|DATABASE_URL|CONNECTION|WEBHOOK_SIGNING|SALT|PEPPER/;
const PUBLIC = /^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_|EXPO_PUBLIC_|NUXT_PUBLIC_)/;

export function collectEnv(repo: RepoFiles): EnvResult {
  const code = new Map<string, Set<string>>();
  const from = new Map<string, Set<EnvSource>>();
  const add = (n: string, s: EnvSource) => { const x = from.get(n) ?? new Set(); x.add(s); from.set(n, x); };
  for (const f of repo.code()) {
    for (const n of namesInCode(repo.text(f) ?? '')) {
      if (IGNORE.has(n)) continue;
      add(n, 'code');
      if (!isTestPath(f)) { const s = code.get(n) ?? new Set(); s.add(f); code.set(n, s); }
    }
  }
  const example_files = repo.files.filter(isEnvTemplate);
  const exampleNames = new Set<string>();
  for (const f of example_files) for (const n of namesInTemplate(repo.text(f) ?? '')) { exampleNames.add(n); add(n, 'example'); }
  for (const f of repo.files.filter(x => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(x))) {
    for (const m of (repo.text(f) ?? '').matchAll(/\$\{\{\s*(?:secrets|vars)\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) if (m[1] !== 'GITHUB_TOKEN') add(m[1]!, 'ci');
  }
  for (const f of repo.files.filter(x => /(^|\/)Dockerfile[^/]*$/.test(x))) {
    for (const n of namesInDockerfile(repo.text(f) ?? '')) if (!IGNORE.has(n)) add(n, 'docker');
  }
  const vars = [...from.entries()].map(([name, s]) => {
    const pub = PUBLIC.test(name);
    return { name, sources: (['code', 'example', 'ci', 'docker'] as EnvSource[]).filter(x => s.has(x)), code_files: code.get(name)?.size ?? 0, public: pub, kind: pub ? 'public' as const : SECRETY.test(name) ? 'secret' as const : 'config' as const };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return {
    vars,
    example_files,
    undocumented: example_files.length ? sortUniq(vars.filter(v => v.code_files > 0 && !exampleNames.has(v.name)).map(v => v.name)) : [],
    unused_examples: sortUniq([...exampleNames].filter(n => !code.has(n) && !from.get(n)?.has('ci'))),
  };
}
