// Collector: code size. Non-blank lines of source by language and by folder. Lockfiles, generated
// output and vendored code are excluded (the walker already skips build and dependency folders).
import { RepoFiles } from './files.js';

export interface SizeRow { key: string; files: number; lines: number }
export interface SizeResult { total_files: number; source_files: number; source_lines: number; by_language: SizeRow[]; by_folder: SizeRow[] }

const LANG: [RegExp, string][] = [
  [/\.(ts|mts|cts)$/, 'TypeScript'], [/\.tsx$/, 'TypeScript (TSX)'], [/\.(js|mjs|cjs)$/, 'JavaScript'], [/\.jsx$/, 'JavaScript (JSX)'],
  [/\.py$/, 'Python'], [/\.go$/, 'Go'], [/\.rb$/, 'Ruby'], [/\.vue$/, 'Vue'], [/\.svelte$/, 'Svelte'], [/\.astro$/, 'Astro'],
  [/\.(css|scss|sass|less)$/, 'Styles'], [/\.sql$/, 'SQL'], [/\.prisma$/, 'Prisma'], [/\.(sh|bash|zsh)$/, 'Shell'], [/\.html?$/, 'HTML'],
];

/** Folder bucket: the first segment, or the first two under a conventional container folder. */
export function bucket(rel: string): string {
  const s = rel.split('/');
  if (s.length === 1) return '(root)';
  if (['src', 'app', 'apps', 'packages', 'services', 'lib', 'libs'].includes(s[0]!) && s.length > 2) return `${s[0]}/${s[1]}`;
  return s[0]!;
}

export function collectSize(repo: RepoFiles): SizeResult {
  const lang = new Map<string, SizeRow>(); const folder = new Map<string, SizeRow>();
  let files = 0; let lines = 0;
  for (const f of repo.files) {
    if (/\.d\.ts$|\.min\.(js|css)$/.test(f)) continue;
    const l = LANG.find(([re]) => re.test(f))?.[1]; if (!l) continue;
    const t = repo.text(f); if (t === undefined) continue;
    const n = t.split('\n').filter(x => x.trim()).length;
    files++; lines += n;
    const a = lang.get(l) ?? { key: l, files: 0, lines: 0 }; a.files++; a.lines += n; lang.set(l, a);
    const k = bucket(f); const b = folder.get(k) ?? { key: k, files: 0, lines: 0 }; b.files++; b.lines += n; folder.set(k, b);
  }
  const sort = (m: Map<string, SizeRow>) => [...m.values()].sort((a, b) => b.lines - a.lines || a.key.localeCompare(b.key));
  return { total_files: repo.files.length, source_files: files, source_lines: lines, by_language: sort(lang), by_folder: sort(folder) };
}
