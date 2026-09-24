// Collector: documentation index. Every Markdown document in the snapshot with its title and
// length, READMEs and architecture / decision records first.
import { RepoFiles } from './files.js';

export type DocKind = 'readme' | 'architecture' | 'decision' | 'runbook' | 'changelog' | 'doc';
export interface Doc { path: string; title: string; lines: number; kind: DocKind }

const ORDER: DocKind[] = ['readme', 'architecture', 'decision', 'runbook', 'changelog', 'doc'];

export function kindOfDoc(rel: string): DocKind {
  const base = (rel.split('/').pop() ?? '').toLowerCase();
  if (base.startsWith('readme')) return 'readme';
  if (base.startsWith('changelog') || base.startsWith('history')) return 'changelog';
  if (/(^|\/)(adr|adrs|decisions)\//i.test(rel) || /^\d{3,4}-/.test(base)) return 'decision';
  if (/architect|design|overview|system/.test(base)) return 'architecture';
  if (/runbook|deploy|operat|handover|onboard|setup|install/.test(base)) return 'runbook';
  return 'doc';
}

export function collectDocs(repo: RepoFiles): Doc[] {
  return repo.files.filter(f => /\.(md|mdx)$/i.test(f) && !/(^|\/)(\.github\/ISSUE_TEMPLATE|fixtures?)\//.test(f)).map(f => {
    const t = repo.text(f) ?? '';
    const h = /^#\s+(.+)$/m.exec(t)?.[1]?.replace(/[*_`[\]]/g, '').trim();
    return { path: f, title: (h || f.split('/').pop()!).slice(0, 120), lines: t ? t.split('\n').length : 0, kind: kindOfDoc(f) };
  }).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path)).slice(0, 300);
}
