// CLI: npm run agent:audit -- --url https://site.example.test --org acme [--max-pages 10] [--timeout-ms 15000] [--headed]
import { getDb } from '../../core/db.js';
import { executeAgent } from '../../core/runner.js';
import { aiSiteAuditor } from './index.js';

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
  const url = typeof args.url === 'string' ? args.url : undefined;
  const org = typeof args.org === 'string' ? args.org : undefined;
  if (!url || !org || args.help) {
    console.error('usage: npm run agent:audit -- --url <site_url> --org <org_slug> [--max-pages 10] [--timeout-ms 15000] [--headed] [--engine chromium|firefox|webkit]');
    process.exit(2);
  }
  const input: Record<string, unknown> = { target_url: url, org_slug: org };
  if (typeof args['max-pages'] === 'string') input.max_pages = Number(args['max-pages']);
  if (typeof args['timeout-ms'] === 'string') input.timeout_ms = Number(args['timeout-ms']);
  if (args.headed === true) input.headless = false;
  if (typeof args.engine === 'string') input.engine = args.engine;

  const db = getDb();
  const engagement = db.createEngagement({ org, name: `audit ${new URL(url).host} ${new Date().toISOString()}`, target_url: url });
  console.error(`engagement ${engagement.id}; auditing ${url} ...`);
  const { run, output } = await executeAgent(db, aiSiteAuditor, engagement.id, input);
  console.log(JSON.stringify({ run_id: run.id, engagement_id: engagement.id, status: run.status, ...output }, null, 2));
  console.error(`report: ${output.report_html}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
