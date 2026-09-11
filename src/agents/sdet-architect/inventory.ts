// Phase 1: walk the estate and classify every file. Pure classification on (path, content).
import fs from 'node:fs';
import path from 'node:path';
import type { FileKind } from './model.js';
import { classifyJava } from './parsers/selenium-java.js';
import { classifyPython } from './parsers/selenium-python.js';
import { classifyCSharp } from './parsers/selenium-csharp.js';
import { classifyJs } from './parsers/selenium-js.js';
import { isPostmanCollection } from './parsers/postman.js';

export interface InventoryEntry { path: string; kind: FileKind; bytes: number; lines: number; language: string }

export const DEFAULT_INCLUDE = ['**/*'];
export const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/target/**', '**/bin/**', '**/obj/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.idea/**', '**/.vs/**', '**/__pycache__/**', '**/.venv/**', '**/venv/**', '**/test-results/**', '**/playwright-report/**'];

const MAX_BYTES = 2 * 1024 * 1024;
const CONFIG_NAMES = /^(pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|requirements(?:-\w+)?\.txt|pyproject\.toml|setup\.cfg|pytest\.ini|tox\.ini|testng\.xml|package\.json|package-lock\.json|tsconfig\.json|wdio\.conf\.(?:js|ts)|cypress\.config\.(?:js|ts)|cypress\.json|\.babelrc|jest\.config\.(?:js|ts)|conftest\.py|nunit\.config|runsettings|.*\.runsettings|.*\.csproj|.*\.sln|Directory\.Build\.props|behave\.ini|cucumber\.properties|cucumber\.js|karate-config\.js)$/i;
const TEST_PLAN_NAME = /(test[-_ ]?(plan|cases?|matrix|suite|scenarios?)|regression|smoke|uat|acceptance)/i;

/** Minimal glob -> RegExp (supports **, *, ?, {a,b}). */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  const g = glob.replace(/\\/g, '/');
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') { const end = g.indexOf('}', i); if (end > 0) { re += `(?:${g.slice(i + 1, end).split(',').map(escape).join('|')})`; i = end; } else re += '\\{'; }
    else re += escape(c);
  }
  return new RegExp(`^${re}$`);
}
function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function matchesAny(rel: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(rel) || globToRegExp(g).test(rel.replace(/^\.\//, '')));
}

/** Classify a single file from its relative path and content. Pure. */
export function classifyFile(rel: string, content: string): FileKind {
  const base = path.basename(rel);
  const ext = path.extname(rel).toLowerCase();
  if (ext === '.feature') return 'cucumber-feature';
  if (CONFIG_NAMES.test(base)) return 'config';
  switch (ext) {
    case '.java': return classifyJava(content);
    case '.py': return classifyPython(content);
    case '.cs': return classifyCSharp(content);
    case '.js': case '.mjs': case '.cjs': case '.ts': case '.mts': case '.jsx': case '.tsx': return classifyJs(content);
    case '.json': return isPostmanCollection(content) ? 'postman-collection' : 'unknown';
    case '.md': case '.docx': case '.xlsx': case '.txt': case '.csv':
      return TEST_PLAN_NAME.test(base) || (ext === '.md' && /^#+\s*.*\b(test|scenario|case)\b/im.test(content) && /^\s*(?:\d+[.)]|[-*])\s+/m.test(content)) ? 'test-plan' : 'unknown';
    default: return 'unknown';
  }
}

export function languageOf(rel: string): string {
  const ext = path.extname(rel).toLowerCase();
  return ({ '.java': 'java', '.py': 'python', '.cs': 'csharp', '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.ts': 'typescript', '.tsx': 'typescript', '.feature': 'gherkin', '.json': 'json', '.md': 'markdown', '.xml': 'xml' } as Record<string, string>)[ext] ?? 'other';
}

export interface InventoryOptions { include?: string[]; exclude?: string[]; languageHint?: string }

/** Walk `root` and classify every included file. Reads from disk (the only impure part of inventory). */
export function inventory(root: string, opts: InventoryOptions = {}): { entries: InventoryEntry[]; contents: Map<string, string> } {
  const include = opts.include?.length ? opts.include : DEFAULT_INCLUDE;
  const exclude = [...DEFAULT_EXCLUDE, ...(opts.exclude ?? [])];
  const entries: InventoryEntry[] = [];
  const contents = new Map<string, string>();
  const walk = (dir: string) => {
    let items: fs.Dirent[];
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, it.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (matchesAny(rel, exclude) || matchesAny(rel + '/', exclude)) continue;
      if (it.isDirectory()) { walk(abs); continue; }
      if (!it.isFile()) continue;
      if (!matchesAny(rel, include)) continue;
      let st: fs.Stats;
      try { st = fs.statSync(abs); } catch { continue; }
      if (st.size > MAX_BYTES) { entries.push({ path: rel, kind: 'unknown', bytes: st.size, lines: 0, language: languageOf(rel) }); continue; }
      const buf = fs.readFileSync(abs);
      const isText = !buf.subarray(0, 512).includes(0);
      const text = isText ? buf.toString('utf8') : '';
      let kind = isText ? classifyFile(rel, text) : 'unknown';
      if (!isText && /\.(docx|xlsx)$/i.test(rel) && TEST_PLAN_NAME.test(it.name)) kind = 'test-plan';
      if (opts.languageHint && opts.languageHint !== 'auto' && kind === 'unknown' && languageOf(rel) === opts.languageHint) kind = 'unknown';
      entries.push({ path: rel, kind, bytes: st.size, lines: text ? text.split('\n').length : 0, language: languageOf(rel) });
      if (isText) contents.set(rel, text);
    }
  };
  walk(root);
  return { entries, contents };
}

export function countByKind(entries: InventoryEntry[]): Record<FileKind, number> {
  const counts = Object.fromEntries(['selenium-java', 'selenium-python', 'selenium-csharp', 'selenium-js', 'cypress', 'cucumber-feature', 'step-definitions', 'page-object', 'postman-collection', 'test-plan', 'config', 'unknown'].map((k) => [k, 0])) as Record<FileKind, number>;
  for (const e of entries) counts[e.kind]++;
  return counts;
}
