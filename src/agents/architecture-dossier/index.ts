// The Architecture Dossier (plate 47): point it at a git repository and it records, from the
// committed HEAD only, how the app is built, what it talks to, how it ships and what is missing —
// the record a buyer's due diligence asks for — as a static page and a machine-readable JSON.
// Deterministic: no model, no network, nothing executed from the analysed repository.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AgentDefinition, AgentContext } from '../../core/agent.js';
import { getDb, type Severity } from '../../core/db.js';
import { buildDossier, PLATE } from './build.js';
import { loadFacts } from './facts.js';
import { isSecretLikePath } from './files.js';
import { renderDossierHtml } from './render.js';
import { DossierSchema } from './schema.js';
import type { GapSeverity } from './types.js';

export const inputSchema = z.object({
  repo_path: z.string().min(1),
  out_dir: z.string().min(1).optional(),
  facts_path: z.string().min(1).optional(),
  test_output_path: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
});
export type Input = z.infer<typeof inputSchema>;

export interface Output {
  app: string;
  commit: string;
  dossier_html: string;
  dossier_json: string;
  copies?: { html: string; json: string };
  counts: Record<string, number>;
  gaps_by_severity: Record<GapSeverity, number>;
  summary: string;
}

const SEVERITY: Record<GapSeverity, Severity> = { high: 'high', medium: 'medium', low: 'low', info: 'info' };

async function run(input: Input, ctx: AgentContext): Promise<Output> {
  const facts = input.facts_path ? loadFacts(input.facts_path) : null;
  let testOutput: { name: string; text: string } | undefined;
  if (input.test_output_path) {
    const base = path.basename(input.test_output_path);
    if (isSecretLikePath(base)) throw new Error(`refusing to read ${base}: it looks like a secrets file`);
    testOutput = { name: base, text: fs.readFileSync(input.test_output_path, 'utf8').slice(0, 5_000_000) };
  }
  ctx.log(`phase 1/2 collect: ${input.repo_path} (committed HEAD only)`);
  const dossier = buildDossier({
    repoPath: input.repo_path, facts, factsFileName: input.facts_path ? path.basename(input.facts_path) : undefined,
    name: input.name, testOutput, runId: ctx.runId, log: ctx.log,
  });
  DossierSchema.parse(dossier);

  ctx.log('phase 2/2 render');
  for (const g of dossier.gaps.filter(x => x.source === 'measured')) {
    ctx.db.addFinding({ run_id: ctx.runId, severity: SEVERITY[g.severity], category: g.id.split('.')[0]!, title: g.title, detail: g.detail, evidence: { id: g.id, evidence: g.evidence } });
  }
  const html = renderDossierHtml(dossier);
  const json = JSON.stringify(dossier, null, 2);
  const htmlPath = path.join(ctx.workspaceDir, 'index.html');
  const jsonPath = path.join(ctx.workspaceDir, 'dossier.json');
  fs.writeFileSync(htmlPath, html); fs.writeFileSync(jsonPath, json);
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'dossier/html', path: htmlPath, meta: { commit: dossier.provenance.commit } });
  ctx.db.addArtifact({ run_id: ctx.runId, kind: 'dossier/json', path: jsonPath, meta: { commit: dossier.provenance.commit } });
  let copies: Output['copies'];
  if (input.out_dir) {
    fs.mkdirSync(input.out_dir, { recursive: true });
    copies = { html: path.resolve(input.out_dir, 'index.html'), json: path.resolve(input.out_dir, 'dossier.json') };
    fs.writeFileSync(copies.html, html); fs.writeFileSync(copies.json, json);
    ctx.log(`copied to ${input.out_dir}`);
  }
  const bySev: Record<GapSeverity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const g of dossier.gaps) bySev[g.severity]++;
  return {
    app: dossier.app.name, commit: dossier.provenance.commit,
    dossier_html: htmlPath, dossier_json: jsonPath, copies,
    counts: { ...dossier.summary.counts }, gaps_by_severity: bySev, summary: dossier.summary.text,
  };
}

function registerRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>('/agents/architecture-dossier/runs/:id/dossier', async (req, reply) => {
    const db = getDb();
    const r = db.getRun(req.params.id);
    if (!r || r.agent !== 'architecture-dossier') return reply.code(404).send({ error: 'run not found' });
    const a = db.listArtifacts(r.id).find(x => x.kind === 'dossier/html');
    if (!a || !fs.existsSync(a.path)) return reply.code(404).send({ error: 'dossier not available for this run' });
    return reply.type('text/html; charset=utf-8').send(fs.readFileSync(a.path, 'utf8'));
  });
}

export const architectureDossier: AgentDefinition<Input, Output> = {
  name: 'architecture-dossier',
  plate: PLATE,
  oneLiner: 'Point it at a git repository; from the committed HEAD it records the stack, routes, data model, integrations, webhooks, auth posture, jobs, deploy, tests and history, merges the owner\'s stated facts, and writes a buyer-grade architecture dossier.',
  inputSchema: inputSchema as unknown as z.ZodType<Input>,
  run,
  registerRoutes,
};
