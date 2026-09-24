// Snapshot the committed HEAD of a repository with `git archive` into a temporary directory.
// The working tree is never read: other people and agents may be mid-edit in it, and a dossier
// has to describe a commit someone can check out. Git is only ever asked read-only questions,
// with optional locks off so it never touches the repository's index.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSecretLikePath } from './files.js';

export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  });
}

export interface Snapshot {
  /** Extracted HEAD tree (only the requested subdirectory when the repo path is one). */
  dir: string;
  repoPath: string;
  toplevel: string;
  prefix: string;
  commit: string;
  commit_short: string;
  commit_date: string;
  branch: string;
  remote?: string;
  /** Secret-like files that were committed at HEAD. Deleted from the snapshot unread. */
  secret_like_committed: string[];
  cleanup(): void;
}

/** `git@host:owner/repo.git` or `https://user:token@host/owner/repo.git` → `host/owner/repo`. */
export function sanitizeRemote(url: string): string | undefined {
  const s = url.trim();
  const scp = /^[\w.-]+@([\w.-]+):(.+?)(\.git)?$/.exec(s);
  if (scp) return `${scp[1]}/${scp[2]}`;
  try {
    const u = new URL(s);
    if (u.protocol === 'file:') return undefined;
    return `${u.hostname}${u.pathname.replace(/\.git$/, '')}`;
  } catch { return undefined; }
}

function removeSecretLike(root: string): string[] {
  const removed: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) walk(abs, r);
      else if (isSecretLikePath(r)) { fs.rmSync(abs, { force: true }); removed.push(r); }
    }
  };
  walk(root, '');
  return removed.sort();
}

export function snapshotHead(repoPath: string, tmpParent: string = os.tmpdir()): Snapshot {
  const abs = path.resolve(repoPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error(`repo path not found: ${abs}`);
  let toplevel: string;
  try { toplevel = git(abs, ['rev-parse', '--show-toplevel']).trim(); } catch { throw new Error(`${abs} is not inside a git repository`); }
  const prefix = git(abs, ['rev-parse', '--show-prefix']).trim();
  let commit: string;
  try { commit = git(abs, ['rev-parse', '--verify', 'HEAD']).trim(); } catch { throw new Error(`${abs} has no commits; nothing to snapshot`); }
  const commit_date = git(abs, ['log', '-1', '--format=%cI', 'HEAD']).trim();
  const branch = git(abs, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  let remote: string | undefined;
  try { remote = sanitizeRemote(git(abs, ['remote', 'get-url', 'origin'])); } catch { remote = undefined; }

  fs.mkdirSync(tmpParent, { recursive: true });
  const base = fs.mkdtempSync(path.join(tmpParent, 'dossier-'));
  const dir = path.join(base, 'tree');
  fs.mkdirSync(dir);
  const tar = path.join(base, 'head.tar');
  const treeish = prefix ? `${commit}:${prefix.replace(/\/$/, '')}` : commit;
  try {
    git(toplevel, ['archive', '--format=tar', '-o', tar, treeish]);
    execFileSync('tar', ['-xf', tar, '-C', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  } finally { fs.rmSync(tar, { force: true }); }
  const secret_like_committed = removeSecretLike(dir);

  return {
    dir, repoPath: abs, toplevel, prefix, commit, commit_short: commit.slice(0, 7), commit_date, branch, remote,
    secret_like_committed,
    cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
  };
}
