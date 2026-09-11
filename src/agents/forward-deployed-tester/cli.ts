// CLI: npm run agent:fdt -- --url https://app.example.test --org acme [--max-pages 10] [--timeout-ms 15000] [--headed] [--no-mcp]
import { getDb } from '../../core/db.js';
import { executeAgent } from '../../core/runner.js';
import { forwardDeployedTester } from './index.js';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i++; }
    else out[a.slice(2)] = true;
  }
  return out;
}

function usage(): never {
  console.error(`usage: npm run agent:fdt -- --url <target_url> --org <org_slug> [--max-pages 15] [--timeout-ms 15000] [--headed] [--no-mcp]
       [--basic-user u --basic-pass p] [--cookie name=value[;name2=value2] --cookie-domain example.test]`);
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = typeof args.url === 'string' ? args.url : undefined;
  const org = typeof args.org === 'string' ? args.org : undefined;
  if (!url || !org || args.help) usage();

  const input: Record<string, unknown> = { target_url: url, org_slug: org };
  if (typeof args['max-pages'] === 'string') input.max_pages = Number(args['max-pages']);
  if (typeof args['timeout-ms'] === 'string') input.timeout_ms = Number(args['timeout-ms']);
  if (args.headed === true) input.headless = false;
  if (args['no-mcp'] === true) input.mcp = false;
  if (typeof args['basic-user'] === 'string') input.auth = { type: 'basic', username: args['basic-user'], password: String(args['basic-pass'] ?? '') };
  if (typeof args.cookie === 'string') {
    const domain = typeof args['cookie-domain'] === 'string' ? args['cookie-domain'] : new URL(url!).hostname;
    input.auth = {
      type: 'cookie',
      cookies: args.cookie.split(';').map(kv => kv.trim()).filter(Boolean).map(kv => {
        const i = kv.indexOf('=');
        return { name: kv.slice(0, i), value: kv.slice(i + 1), domain };
      }),
    };
  }

  const db = getDb();
  const engagement = db.createEngagement({ org: org!, name: `fdt ${new URL(url!).host} ${new Date().toISOString()}`, target_url: url });
  console.error(`engagement ${engagement.id} created for ${org}; running forward-deployed-tester against ${url} ...`);
  const { run, output } = await executeAgent(db, forwardDeployedTester, engagement.id, input);
  console.log(JSON.stringify({ run_id: run.id, engagement_id: engagement.id, status: run.status, ...output }, null, 2));
  console.error(`report: ${output.report_path}`);
  console.error(`infra:  ${output.infra_dir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
