// Collector: git history. Commit count, how many distinct authors (a count only: no names or
// addresses are kept), first and last commit dates, recent activity, and churn by folder. History
// is read from the repository's object store up to HEAD; the working tree is not consulted.
import { git } from './snapshot.js';
import { bucket } from './size.js';

export interface ChurnRow { folder: string; commits: number; added: number; deleted: number }
export interface GitStats {
  commits: number; contributors: number; first_commit: string; last_commit: string;
  active_days: number; commits_last_30d: number; commits_last_90d: number;
  by_month: { month: string; commits: number }[];
  churn: ChurnRow[];
}

/** Aggregate `git log --numstat --format=@%cI` output. Pure, for tests. */
export function parseNumstat(out: string, headDate: string): Pick<GitStats, 'churn' | 'by_month' | 'active_days' | 'commits_last_30d' | 'commits_last_90d'> {
  const churn = new Map<string, ChurnRow>();
  const months = new Map<string, number>(); const days = new Set<string>();
  const head = Date.parse(headDate); let c30 = 0; let c90 = 0;
  let touched = new Set<string>();
  const flush = () => { for (const k of touched) churn.get(k)!.commits++; touched = new Set(); };
  for (const line of out.split('\n')) {
    if (line.startsWith('@')) {
      flush();
      const iso = line.slice(1).trim(); const t = Date.parse(iso);
      months.set(iso.slice(0, 7), (months.get(iso.slice(0, 7)) ?? 0) + 1); days.add(iso.slice(0, 10));
      if (head - t <= 30 * 864e5) c30++;
      if (head - t <= 90 * 864e5) c90++;
      continue;
    }
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line); if (!m) continue;
    let file = m[3]!;
    const rename = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(file); if (rename) file = `${rename[1]}${rename[3]}${rename[4]}`.replace(/\/\//g, '/');
    else if (file.includes(' => ')) file = file.split(' => ')[1]!;
    const k = bucket(file);
    const row = churn.get(k) ?? { folder: k, commits: 0, added: 0, deleted: 0 };
    if (m[1] !== '-') row.added += Number(m[1]); if (m[2] !== '-') row.deleted += Number(m[2]);
    churn.set(k, row); touched.add(k);
  }
  flush();
  const by_month = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, commits]) => ({ month, commits }));
  return {
    churn: [...churn.values()].sort((a, b) => (b.added + b.deleted) - (a.added + a.deleted) || a.folder.localeCompare(b.folder)).slice(0, 25),
    by_month, active_days: days.size, commits_last_30d: c30, commits_last_90d: c90,
  };
}

export function collectGitStats(repoPath: string, headDate: string): GitStats {
  const commits = Number(git(repoPath, ['rev-list', '--count', 'HEAD', '--', '.']).trim());
  const authors = new Set(git(repoPath, ['log', '--format=%aE', 'HEAD', '--', '.']).split('\n').map(s => s.trim().toLowerCase()).filter(Boolean));
  const dates = git(repoPath, ['log', '--format=%cI', 'HEAD', '--', '.']).split('\n').filter(Boolean);
  const numstat = git(repoPath, ['log', '--relative', '--numstat', '--format=@%cI', 'HEAD', '--', '.']);
  return {
    commits, contributors: authors.size,
    first_commit: dates[dates.length - 1] ?? headDate, last_commit: dates[0] ?? headDate,
    ...parseNumstat(numstat, headDate),
  };
}
