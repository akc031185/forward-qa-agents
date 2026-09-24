import Fastify from 'fastify';
import { z } from 'zod';
import { config } from '../core/config.js';
import { getDb, type AgentName } from '../core/db.js';
import { executeAgent } from '../core/runner.js';
import type { AgentDefinition } from '../core/agent.js';
import { forwardDeployedTester } from '../agents/forward-deployed-tester/index.js';
import { sdetArchitect } from '../agents/sdet-architect/index.js';
import { aiSiteAuditor } from '../agents/ai-site-auditor/index.js';
import { architectureDossier } from '../agents/architecture-dossier/index.js';
import { registerWorkerRoutes } from './worker.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AGENTS: Record<AgentName, AgentDefinition<any, any>> = {
  'forward-deployed-tester': forwardDeployedTester,
  'sdet-architect': sdetArchitect,
  'ai-site-auditor': aiSiteAuditor,
  'architecture-dossier': architectureDossier,
};

export function buildApp() {
  const app = Fastify({ logger: false });
  const db = getDb();

  app.get('/health', async () => ({ ok: true, llm: config.llmProvider, agents: Object.keys(AGENTS) }));

  /**
   * Deep health check for a host that can only tell a container is "up" by probing it: launches
   * and closes a real Chromium instance. A worker whose browser cannot start (missing system
   * libraries, wrong base image, out of memory) is useless even though the Fastify process is
   * fine, so this is the endpoint `docs/DEPLOYING-THE-WORKER.md` tells the host to probe, not
   * `/health` above. No auth: a load balancer's health probe does not carry the worker token, and
   * the response reveals nothing but a boolean and a timing number.
   */
  app.get('/health/browser', async (_req, reply) => {
    const startedAt = Date.now();
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true, args: config.chromiumNoSandbox ? ['--no-sandbox'] : [] });
      await browser.close();
      return { ok: true, chromium: true, launch_ms: Date.now() - startedAt };
    } catch (err) {
      reply.code(503);
      return { ok: false, chromium: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  app.get('/agents', async () => Object.values(AGENTS).map(a => ({ name: a.name, plate: a.plate, oneLiner: a.oneLiner })));

  const EngagementBody = z.object({ org: z.string().min(1), name: z.string().min(1), target_url: z.string().url().optional() });
  app.post('/engagements', async (req, reply) => {
    const body = EngagementBody.parse(req.body);
    return reply.code(201).send(db.createEngagement(body));
  });
  app.get('/engagements', async () => db.listEngagements());
  app.get<{ Params: { id: string } }>('/engagements/:id', async (req, reply) => {
    const e = db.getEngagement(req.params.id);
    return e ? e : reply.code(404).send({ error: 'not found' });
  });

  app.post<{ Params: { name: AgentName }; Body: { engagement_id: string; input: unknown } }>('/agents/:name/runs', async (req, reply) => {
    const agent = AGENTS[req.params.name];
    if (!agent) return reply.code(404).send({ error: `unknown agent ${req.params.name}` });
    const { engagement_id, input } = z.object({ engagement_id: z.string(), input: z.unknown() }).parse(req.body);
    if (!db.getEngagement(engagement_id)) return reply.code(404).send({ error: 'engagement not found' });
    try {
      const { run, output } = await executeAgent(db, agent, engagement_id, input);
      return reply.code(201).send({ run, output });
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: 'invalid input', issues: err.issues });
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Querystring: { engagement_id?: string } }>('/runs', async (req) => db.listRuns(req.query.engagement_id));
  app.get<{ Params: { id: string } }>('/runs/:id', async (req, reply) => {
    const run = db.getRun(req.params.id);
    if (!run) return reply.code(404).send({ error: 'not found' });
    return { ...run, findings: db.listFindings(run.id), artifacts: db.listArtifacts(run.id) };
  });
  app.get<{ Params: { id: string } }>('/runs/:id/findings', async (req) => db.listFindings(req.params.id));
  app.get<{ Params: { id: string } }>('/runs/:id/artifacts', async (req) => db.listArtifacts(req.params.id));

  for (const a of Object.values(AGENTS)) a.registerRoutes?.(app);
  registerWorkerRoutes(app, db);
  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''));
if (isMain) {
  buildApp().listen({ port: config.port, host: '0.0.0.0' })
    .then(() => console.log(`forward-qa-agents API on http://localhost:${config.port}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
