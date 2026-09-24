// CLI: npm run agent:dossier:index -- --in <dir-with-app-subfolders> --out <dir> [--portfolio <portfolio.json>]
// Reads <in>/<app>/dossier.json for every sub-folder and writes <out>/index.html and <out>/portfolio.summary.json
// (never <out>/portfolio.json, so a stated portfolio.json kept in <out> is not overwritten).
// A pure static step over files already written: no repository is read and no run is recorded.
import { buildPortfolio, loadPortfolio } from './portfolio.js';

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === `--${name}`) return argv[i + 1];
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3);
  }
  return undefined;
}

const inDir = arg('in'); const outDir = arg('out'); const pf = arg('portfolio');
if (!inDir || !outDir) {
  console.error('usage: npm run agent:dossier:index -- --in <dir-with-app-subfolders> --out <dir> [--portfolio <portfolio.json>]');
  process.exit(2);
}
try {
  const r = buildPortfolio({ inDir, outDir, portfolio: pf ? loadPortfolio(pf) : null });
  console.log(JSON.stringify({ index_html: r.htmlPath, summary_json: r.jsonPath, apps: r.summary.apps.map(a => a.folder), errors: r.summary.errors, unresolved_links: r.summary.unresolved_links }, null, 2));
  if (!r.summary.apps.length) process.exitCode = 1;
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
