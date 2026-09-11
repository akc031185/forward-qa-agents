// The Forward Deployed Tester (plate 44): point it at a running web app and it performs
// reconnaissance, records findings, provisions a Playwright + Playwright MCP project and writes a report.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AgentDefinition, AgentContext } from '../../core/agent.js';
import { getDb, type Severity } from '../../core/db.js';
import { maybeLlm } from '../../core/llm.js';
import { crawl } from './crawler.js';
import { deriveFindings } from './findings.js';
import { generateInfra } from './generators.js';
import { buildReportJson, countBySeverity, deterministicSummary, renderReportMarkdown, totalLocators } from './report.js';

export const inputSchema = z.object({
  target_url: z.string().url(),
  org_slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-_]*$/i, 'org_slug must be a slug (letters, digits, - and _)'),
  max_pages: z.number().int().min(1).max(50).default(15),
  auth: z.discriminatedUnion('type', [
    z.object({ type: z.literal('basic'), username: z.string(), password: z.string() }),
    z.object({ type: z.literal('cookie'), cookies: z.array(z.object({ name: z.string(), value: z.string(), domain: z.string() })).min(1) }),
  ]).optional(),
  headless: z.boolean().default(true),
  timeout_ms: z.number().int().min(1000).max(120_000).default(15_000),
  mcp: z.boolean().default(true),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  pages_crawled: number;
  findings_by_severity: Record<Severity, number>;
  infra_dir: string;
  report_path: string;
  locators_total: number;
  summary: string;
}

async function run(input: Input, ctx: AgentContext): Promise<Output> {
  const generatedAt = new Date().toISOString();

  // a. Reconnaissance
  ctx.log(`phase 1/4 reconnaissance: ${input.target_url} (max_pages=${input.max_pages}, timeout=${input.timeout_ms} ms, auth=${input.auth?.type ?? 'none'})`);
  const result = await crawl({
    startUrl: input.target_url, maxPages: input.max_pages, timeoutMs: input.timeout_ms,
    headless: input.headless, auth: input.auth, log: ctx.log,
  });
  ctx.log(`reconnaissance done: ${result.pages.length} pages rendered, ${result.brokenLinks.length} broken links, ${result.skipped.length} skipped, ${result.durationMs} ms`);

  // b. Findings
  ctx.log('phase 2/4 findings');
  const drafts = deriveFindings(result);
  for (const d of drafts) ctx.db.addFinding({ run_id: ctx.runId, ...d });
  const findings = ctx.db.listFindings(ctx.runId);
  const bySeverity = countBySeverity(findings);
  ctx.log(`recorded ${findings.length} findings: ${JSON.stringify(bySeverity)}`);

  // c. Infra provisioning
  ctx.log('phase 3/4 infra provisioning');
  const infraDir = path.join(ctx.workspaceDir, 'infra');
  const files = generateInfra(result.pages, { targetUrl: input.target_url, orgSlug: input.org_slug, mcp: input.mcp, generatedAt });
  for (const f of files) {
    const abs = path.join(infraDir, f.relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content);
    ctx.db.addArtifact({ run_id: ctx.runId, kind: f.kind, path: abs, meta: { rel: f.relPath, bytes: Buffer.byteLength(f.content) } });
  }
  ctx.log(`wrote ${files.length} files to ${infraDir}`);

  // d. Report
  ctx.log('phase 4/4 report');
  const fallback = deterministicSummary(result, findings);
  const summary = await maybeLlm(async (llm) => {
    const text = await llm.complete(
      `Rewrite this QA executive summary in two or three crisp sentences for an engineering manager. Keep every number exactly as given. Do not add facts.\n\n${fallback}`,
      { system: 'You are a senior QA lead writing a short, factual executive summary.', maxTokens: 300 },
    );
    const cleaned = text.trim();
    return cleaned.length > 40 && cleaned.length < 1200 ? cleaned : fallback;
  }, fallback);

  const reportInput = {
    orgSlug: input.org_slug, targetUrl: input.target_url, runId: ctx.runId, generatedAt,
    crawl: result, findings, infraDir, infraFiles: files.map(f => f.relPath), summary,
  };
  const reportPath = path.join(ctx.workspaceDir, 'report.md');
  const reportJsonPath = path.join(ctx.workspaceDir, 'report.json');
  fs.writeFileSync(reportPath, renderReportMarkdown(reportInput));
  fs.writeFileSync(reportJsonPath, JSON.stringify(buildReportJson(reportInput), null, 2));
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'report/markdown', path: reportPath });
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'report/json', path: reportJsonPath });
  ctx.log(`report written to ${reportPath}`);

  return {
    pages_crawled: result.pages.length,
    findings_by_severity: bySeverity,
    infra_dir: infraDir,
    report_path: reportPath,
    locators_total: totalLocators(result.pages),
    summary,
  };
}

function registerRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>('/agents/forward-deployed-tester/runs/:id/report', async (req, reply) => {
    const db = getDb();
    const run = db.getRun(req.params.id);
    if (!run || run.agent !== 'forward-deployed-tester') return reply.code(404).send({ error: 'run not found' });
    const artifact = db.listArtifacts(run.id).find(a => a.kind === 'report/markdown');
    if (!artifact || !fs.existsSync(artifact.path)) return reply.code(404).send({ error: 'report not available for this run' });
    return reply.type('text/markdown; charset=utf-8').send(fs.readFileSync(artifact.path, 'utf8'));
  });
}

export const forwardDeployedTester: AgentDefinition<Input, Output> = {
  name: 'forward-deployed-tester',
  plate: 44,
  oneLiner: 'Point it at a running web app; it crawls, records findings and provisions a complete Playwright + MCP test project in one run.',
  // The schema applies defaults, so its input type is wider than Input; the contract only calls .parse().
  inputSchema: inputSchema as unknown as z.ZodType<Input>,
  run,
  registerRoutes,
};
