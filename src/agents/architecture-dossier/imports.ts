// Resolve a file's relative and alias (`@/`, `~/`) imports to files in the snapshot, a couple of
// hops deep. Lets a route handler be credited with what its helpers do (a model it queries through
// lib/, a vendor SDK it reaches through a service module).
import path from 'node:path';
import { RepoFiles, packageOf, readPackages, type PackageJson } from './files.js';

const EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

export class ImportGraph {
  private readonly pkgs: PackageJson[];
  private readonly memo = new Map<string, string[]>();
  constructor(private readonly repo: RepoFiles) { this.pkgs = readPackages(repo); }

  private resolve(from: string, spec: string): string | undefined {
    let bases: string[];
    if (spec.startsWith('.')) bases = [path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))];
    else if (/^[@~]\//.test(spec)) {
      const p = packageOf(this.pkgs, from); const root = p?.dir ? `${p.dir}/` : '';
      bases = [`${root}src/${spec.slice(2)}`, `${root}${spec.slice(2)}`];
    } else return undefined;
    for (const b of bases) {
      const stripped = b.replace(/\.(js|mjs|cjs)$/, '');
      for (const cand of [b, ...EXTS.map(e => stripped + e)]) if (this.repo.has(cand)) return cand;
    }
    return undefined;
  }

  direct(file: string): string[] {
    const hit = this.memo.get(file); if (hit) return hit;
    const src = this.repo.text(file) ?? '';
    const out = new Set<string>();
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]((?:\.{1,2}\/|[@~]\/)[^'"]+)['"]/g)) {
      const r = this.resolve(file, m[1]!); if (r && r !== file) out.add(r);
    }
    const list = [...out].sort(); this.memo.set(file, list); return list;
  }

  /** The file plus everything it imports, `depth` hops out, capped. */
  reach(file: string, depth = 2, cap = 40): string[] {
    const seen = new Set([file]); let frontier = [file];
    for (let d = 0; d < depth && frontier.length && seen.size < cap; d++) {
      const next: string[] = [];
      for (const f of frontier) for (const g of this.direct(f)) if (!seen.has(g) && seen.size < cap) { seen.add(g); next.push(g); }
      frontier = next;
    }
    return [...seen];
  }

  reachText(file: string, depth = 2): string { return this.reach(file, depth).map(f => this.repo.text(f) ?? '').join('\n'); }
}
