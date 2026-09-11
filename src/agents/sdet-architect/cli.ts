// npm run agent:sdet -- --src /abs/path/to/tests --org acme [--base-url https://...] [--dry-run] [--include glob]... [--exclude glob]... [--lang java]
import path from 'node:path';
import { getDb } from '../../core/db.js';
import { executeAgent } from '../../core/runner.js';
import { sdetArchitect } from './index.js';

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean | string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (key === 'dry-run' || key === 'help') { out[key] = true; continue; }
    if (next === undefined || next.startsWith('--')) { out[key] = true; continue; }
    if (key === 'include' || key === 'exclude') { (out[key] as string[] | undefined) ? (out[key] as string[]).push(next) : (out[key] = [next]); }
    else out[key] = next;
    i++;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.src || !args.org) {
  console.error('usage: npm run agent:sdet -- --src /abs/path/to/tests --org acme [--base-url https://app.example.test] [--dry-run] [--include "**/*.java"] [--exclude "**/legacy/**"] [--lang java|python|csharp|javascript|typescript|auto]');
  process.exit(args.help ? 0 : 2);
}

const db = getDb();
const engagement = db.createEngagement({ org: String(args.org), name: `sdet-architect ${path.basename(String(args.src))}`, target_url: args['base-url'] ? String(args['base-url']) : null });
const input = {
  source_dir: path.resolve(String(args.src)),
  org_slug: String(args.org),
  base_url: args['base-url'] ? String(args['base-url']) : undefined,
  dry_run: !!args['dry-run'],
  include: args.include as string[] | undefined,
  exclude: args.exclude as string[] | undefined,
  language_hint: (args.lang as string | undefined) ?? 'auto',
};

executeAgent(db, sdetArchitect, engagement.id, input)
  .then(({ run, output }) => {
    const { migration_report, ...rest } = output;
    console.log(JSON.stringify({ run_id: run.id, engagement_id: engagement.id, status: run.status, ...rest }, null, 2));
    console.log(input.dry_run ? '\n(dry run) MIGRATION.md was not written; it is available via GET /agents/sdet-architect/runs/' + run.id + '/migration' : `\nMIGRATION.md: ${path.join(output.output_dir, 'MIGRATION.md')}`);
    void migration_report;
    db.close();
  })
  .catch((err) => { console.error(err instanceof Error ? err.message : err); db.close(); process.exit(1); });
