// The AI Site Auditor (plate 46): point it at a site built with an AI tool (Lovable, Bolt, v0,
// Replit, Cursor, a Vite or CRA export) and it evaluates three things — whether AI assistants can
// read and cite it, whether search engines will index it correctly, and which build mistakes the
// generator left behind — then writes a self-contained evaluation page. No model required.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AgentDefinition, AgentContext } from '../../core/agent.js';
import { getDb } from '../../core/db.js';
import { maybeLlm } from '../../core/llm.js';
import { collect } from './collect.js';
import { evaluate, grade, scores } from './rules.js';
import { buildReportJson, countBySeverity, deterministicSummary, renderReportHtml, renderReportMarkdown } from './report.js';
import type { Area, Severity } from './types.js';

export const inputSchema = z.object({
  target_url: z.string().url(),
  org_slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-_]*$/i, 'org_slug must be a slug (letters, digits, - and _)'),
  max_pages: z.number().int().min(1).max(50).default(10),
  timeout_ms: z.number().int().min(1000).max(120_000).default(15_000),
  headless: z.boolean().default(true),
});
export type Input = z.infer<typeof inputSchema>;

export interface Output {
  pages_audited: number;
  scores: Record<Area, number>;
  grades: Record<Area, string>;
  findings_by_severity: Record<Severity, number>;
  report_html: string;
  report_md: string;
  summary: string;
}

async function run(input: Input, ctx: AgentContext): Promise<Output> {
  const generatedAt = new Date().toISOString();
  ctx.log(`phase 1/3 collect: ${input.target_url} (max_pages=${input.max_pages}, timeout=${input.timeout_ms} ms)`);
  const facts = await collect({ startUrl: input.target_url, maxPages: input.max_pages, timeoutMs: input.timeout_ms, headless: input.headless, log: ctx.log });
  ctx.log(`collected ${facts.pages.length} pages, ${facts.skipped.length} skipped, ${facts.secrets.length} key-like strings, ${facts.durationMs} ms`);

  ctx.log('phase 2/3 evaluate');
  const results = evaluate(facts);
  for (const r of results) {
    ctx.db.addFinding({ run_id: ctx.runId, severity: r.severity, category: r.area, title: r.title, detail: `${r.why} Fix: ${r.fix}`, evidence: { id: r.id, pages: r.pages, evidence: r.evidence, source: r.source } });
  }
  const s = scores(results);
  ctx.log(`scores ${JSON.stringify(s)}; ${results.length} findings`);

  ctx.log('phase 3/3 report');
  const fallback = deterministicSummary(facts, results);
  let modelUsed = false;
  const summary = await maybeLlm(async (llm) => {
    const text = (await llm.complete(
      `Rewrite this website audit summary in two or three plain sentences for a site owner. Keep every number exactly. Do not add facts.\n\n${fallback}`,
      { system: 'You are a technical SEO lead writing a short factual summary.', maxTokens: 300 },
    )).trim();
    if (text.length > 40 && text.length < 1200) { modelUsed = true; return text; }
    return fallback;
  }, fallback);

  const input2 = { orgSlug: input.org_slug, runId: ctx.runId, generatedAt, facts, results, summary, modelUsed };
  const htmlPath = path.join(ctx.workspaceDir, 'report.html');
  const mdPath = path.join(ctx.workspaceDir, 'report.md');
  const jsonPath = path.join(ctx.workspaceDir, 'report.json');
  fs.writeFileSync(htmlPath, renderReportHtml(input2));
  fs.writeFileSync(mdPath, renderReportMarkdown(input2));
  fs.writeFileSync(jsonPath, JSON.stringify(buildReportJson(input2), null, 2));
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'report/html', path: htmlPath });
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'report/markdown', path: mdPath });
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'report/json', path: jsonPath });
  ctx.log(`report written to ${htmlPath}`);

  return {
    pages_audited: facts.pages.length,
    scores: s,
    grades: { 'ai-visibility': grade(s['ai-visibility']), search: grade(s.search), build: grade(s.build), design: grade(s.design) },
    findings_by_severity: countBySeverity(results),
    report_html: htmlPath,
    report_md: mdPath,
    summary,
  };
}

function registerRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>('/agents/ai-site-auditor/runs/:id/report', async (req, reply) => {
    const db = getDb();
    const r = db.getRun(req.params.id);
    if (!r || r.agent !== 'ai-site-auditor') return reply.code(404).send({ error: 'run not found' });
    const a = db.listArtifacts(r.id).find(x => x.kind === 'report/html');
    if (!a || !fs.existsSync(a.path)) return reply.code(404).send({ error: 'report not available for this run' });
    return reply.type('text/html; charset=utf-8').send(fs.readFileSync(a.path, 'utf8'));
  });
}

export const aiSiteAuditor: AgentDefinition<Input, Output> = {
  name: 'ai-site-auditor',
  plate: 46,
  oneLiner: 'Point it at a site built with an AI tool; it scores whether AI assistants can read and cite it, whether search engines will index it, and which build mistakes were left behind, then writes an evaluation page.',
  inputSchema: inputSchema as unknown as z.ZodType<Input>,
  run,
  registerRoutes,
};
