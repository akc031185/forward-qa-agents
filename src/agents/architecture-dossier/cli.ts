// CLI: npm run agent:dossier -- --repo <path> --out <dir> [--facts <facts.json>] [--name <app>] [--test-output <file>] [--org <slug>]
import { getDb } from '../../core/db.js';
import { executeAgent } from '../../core/runner.js';
import { architectureDossier } from './index.js';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i++; } else out[a.slice(2)] = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = typeof args.repo === 'string' ? args.repo : undefined;
  const out = typeof args.out === 'string' ? args.out : undefined;
  if (!repo || !out || args.help) {
    console.error('usage: npm run agent:dossier -- --repo <path> --out <dir> [--facts <facts.json>] [--name <app>] [--test-output <file>] [--org <slug>]');
    process.exit(2);
  }
  const input: Record<string, unknown> = { repo_path: repo, out_dir: out };
  if (typeof args.facts === 'string') input.facts_path = args.facts;
  if (typeof args.name === 'string') input.name = args.name;
  if (typeof args['test-output'] === 'string') input.test_output_path = args['test-output'];
  const org = typeof args.org === 'string' ? args.org : 'self';

  const db = getDb();
  const engagement = db.createEngagement({ org, name: `dossier ${repo} ${new Date().toISOString()}` });
  console.error(`engagement ${engagement.id}; recording ${repo} at HEAD ...`);
  const { run, output } = await executeAgent(db, architectureDossier, engagement.id, input);
  console.log(JSON.stringify({ run_id: run.id, engagement_id: engagement.id, status: run.status, ...output }, null, 2));
  console.error(`dossier: ${output.copies?.html ?? output.dossier_html}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
