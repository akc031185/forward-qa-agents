// Standalone worker endpoints for the calling app's adapter (typically named something like
// `src/lib/auditRunner.ts` on the caller's side): submit an audit, poll its status, and — the
// part that matters, since a crawl takes tens of seconds — get a callback POST when it finishes
// or fails. Everything under `/worker/` requires `Authorization: Bearer <AUDIT_WORKER_TOKEN>`;
// see `src/core/auth.ts`. Deliberately kept separate from the generic `/agents/:name/runs` route
// in `server.ts`, which stays synchronous for CLI/dev use and is unauthenticated by design.
import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../core/config.js';
import type { Db } from '../core/db.js';
import type { AgentDefinition } from '../core/agent.js';
import { startRun, finishRun } from '../core/runner.js';
import { isBearerAuthorized } from '../core/auth.js';
import { buildCallbackPayload, deliverCallback } from '../core/callback.js';
import { Gate } from '../core/concurrency.js';
import { aiSiteAuditor, type Input as AuditInput, type Output as AuditOutput } from '../agents/ai-site-auditor/index.js';

/**
 * One gate per worker process, sized from `AUDIT_WORKER_CONCURRENCY` (config.workerConcurrency).
 * Every submission still answers 202 immediately (below); this only delays when the browser for
 * that audit actually launches, so a burst of submissions queues in memory instead of each one
 * launching its own Chromium and OOM-killing the container. Exported so tests can build a worker
 * with a specific limit without going through the environment.
 */
export function createAuditGate(): Gate {
  return new Gate(config.workerConcurrency);
}

const SubmitBody = z.object({
  url: z.string().url(),
  callback_url: z.string().url(),
  org_slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-_]*$/i, 'org_slug must be a slug (letters, digits, - and _)').optional(),
  max_pages: z.number().int().min(1).max(50).optional(),
  timeout_ms: z.number().int().min(1000).max(120_000).optional(),
  // Chromium unless the caller asks for a WebKit (Safari/iOS proxy) or Firefox pass instead —
  // see the `engine` comment on the agent's own inputSchema in ai-site-auditor/index.ts.
  engine: z.enum(['chromium', 'firefox', 'webkit']).optional(),
});

/** A slug good enough to satisfy the agent's `org_slug` schema when the caller does not send one. */
export function slugFromUrl(url: string): string {
  const host = new URL(url).hostname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return host || 'worker';
}

/** Reads the report file the agent wrote; never throws — an unreadable report becomes ''. */
function readReportHtml(agentOutput: AuditOutput, log: (msg: string) => void): string {
  try {
    return fs.readFileSync(agentOutput.report_html, 'utf8');
  } catch (err) {
    log(`could not read report file ${agentOutput.report_html}: ${err instanceof Error ? err.message : String(err)}`);
    return '';
  }
}

export function registerWorkerRoutes(
  app: FastifyInstance,
  db: Db,
  agent: AgentDefinition<AuditInput, AuditOutput> = aiSiteAuditor,
  gate: Gate = createAuditGate(),
): void {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/worker/')) return;
    const token = config.workerToken;
    if (!token) return reply.code(503).send({ error: 'AUDIT_WORKER_TOKEN is not configured on this worker' });
    if (!isBearerAuthorized(req.headers.authorization, token)) return reply.code(401).send({ error: 'unauthorized' });
  });

  app.post('/worker/audits', async (req, reply) => {
    const parsed = SubmitBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input', issues: parsed.error.issues });
    const body = parsed.data;
    const orgSlug = body.org_slug ?? slugFromUrl(body.url);
    const engagement = db.createEngagement({ org: orgSlug, name: `worker audit: ${body.url}`, target_url: body.url });

    const rawInput: Record<string, unknown> = { target_url: body.url, org_slug: orgSlug };
    if (body.max_pages !== undefined) rawInput.max_pages = body.max_pages;
    if (body.timeout_ms !== undefined) rawInput.timeout_ms = body.timeout_ms;
    if (body.engine !== undefined) rawInput.engine = body.engine;

    let started: ReturnType<typeof startRun<AuditInput, AuditOutput>>;
    try {
      started = startRun(db, agent, engagement.id, rawInput);
    } catch (err) {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: 'invalid input', issues: err.issues });
      throw err;
    }
    const { run, input, workspaceDir } = started;

    // Fire-and-forget: the request returns immediately with the run id. `finishRun` persists the
    // terminal state to the DB either way; the callback delivers the same outcome to the caller,
    // with its own retry/backoff, so a network hiccup on their end cannot leave them waiting
    // forever with no signal.
    const log = (m: string) => app.log.error(m);
    void gate.run(() => finishRun(db, agent, run, input, workspaceDir)).then(
      ({ output }) => {
        const reportHtml = readReportHtml(output, (m) => app.log.warn(m));
        return deliverCallback(body.callback_url, config.workerToken, buildCallbackPayload(run.id, 'succeeded', output, reportHtml), { log });
      },
      (err) => deliverCallback(body.callback_url, config.workerToken, buildCallbackPayload(run.id, 'failed', undefined, undefined, err), { log }),
    );

    return reply.code(202).send({ id: run.id, status: 'queued' });
  });

  app.get<{ Params: { id: string } }>('/worker/audits/:id', async (req, reply) => {
    const run = db.getRun(req.params.id);
    if (!run || run.agent !== agent.name) return reply.code(404).send({ error: 'not found' });
    const base = { id: run.id, status: run.status, error: run.error, started_at: run.started_at, finished_at: run.finished_at };
    if (run.status !== 'succeeded' || !run.output_json) return base;
    const output = JSON.parse(run.output_json) as AuditOutput;
    return { ...base, scores: output.scores, grades: output.grades, findings_by_severity: output.findings_by_severity, findings: output.findings ?? [] };
  });

  // Cheap operational visibility into the in-process concurrency gate: how many audits this
  // worker is actually running their browser for right now versus how many are waiting their
  // turn. Not part of the public worker contract in docs/DEPLOYING-THE-WORKER.md; useful for an
  // operator deciding whether AUDIT_WORKER_CONCURRENCY or the replica count needs raising.
  app.get('/worker/queue', async () => ({ active: gate.activeCount, queued: gate.queuedCount, limit: gate.limit }));
}
