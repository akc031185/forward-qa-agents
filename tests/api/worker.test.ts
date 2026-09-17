// Exercises the worker contract end to end against a fake agent (no Chromium, no real network):
// submit returns immediately with a run id, status can be polled while it runs, and a callback
// carrying the terminal state is POSTed with the shared bearer token — on both success and
// failure. AUDIT_WORKER_TOKEN must be set before `../../src/core/config.js` is first evaluated,
// and node's test runner gives every matched file its own process, so this file sets it via
// dynamic imports (a static import would already have been evaluated with the token unset).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AgentDefinition, AgentContext } from '../../src/core/agent.js';
import type { Input as AuditInput, Output as AuditOutput } from '../../src/agents/ai-site-auditor/index.js';

process.env.AUDIT_WORKER_TOKEN = 'test-worker-token';

const httpMod = await import('node:http');
const pathMod = await import('node:path');
const fsMod = await import('node:fs');
const FastifyMod = await import('fastify');
const zodMod = await import('zod');
const { Db } = await import('../../src/core/db.js');
const { registerWorkerRoutes } = await import('../../src/api/worker.js');

const Fastify = FastifyMod.default;
const { z } = zodMod;
const TOKEN = 'test-worker-token';

interface FakeInput { target_url: string; org_slug: string }
interface FakeOutput {
  pages_audited: number;
  scores: Record<string, number>;
  grades: Record<string, string>;
  findings_by_severity: Record<string, number>;
  report_html: string;
  report_md: string;
  summary: string;
}

function fakeAgent(behavior: 'succeed' | 'fail'): AgentDefinition<FakeInput, FakeOutput> {
  return {
    name: 'ai-site-auditor',
    plate: 46,
    oneLiner: 'fake agent for worker-route tests',
    inputSchema: z.object({ target_url: z.string().url(), org_slug: z.string() }) as unknown as import('zod').ZodType<FakeInput>,
    async run(input: FakeInput, ctx: AgentContext): Promise<FakeOutput> {
      if (behavior === 'fail') throw new Error('audit blew up');
      const reportPath = pathMod.join(ctx.workspaceDir, 'report.html');
      fsMod.writeFileSync(reportPath, `<html><body>report for ${input.target_url}</body></html>`);
      return {
        pages_audited: 2,
        scores: { 'ai-visibility': 80, search: 70, build: 90, design: 60, readiness: 75 },
        grades: { 'ai-visibility': 'B', search: 'C', build: 'A', design: 'D', readiness: 'C' },
        findings_by_severity: { critical: 0, high: 1, medium: 2, low: 3, info: 4 },
        report_html: reportPath,
        report_md: reportPath,
        summary: 'fake summary',
      };
    },
  };
}

function buildTestApp(behavior: 'succeed' | 'fail') {
  const db = new Db(':memory:');
  const app = Fastify({ logger: false });
  // The fake agent is deliberately a smaller shape than the real ai-site-auditor input/output
  // (no headless/max_pages/timeout_ms, a looser output) — enough to exercise the worker route
  // contract without Chromium. Cast rather than widen registerWorkerRoutes's production typing.
  registerWorkerRoutes(app, db, fakeAgent(behavior) as unknown as AgentDefinition<AuditInput, AuditOutput>);
  return { app, db };
}

/** A tiny HTTP server standing in for the calling app's callbackUrl. Resolves its promise on the first POST. */
function startCallbackReceiver(): { url: string; server: http.Server; received: Promise<{ body: unknown; headers: http.IncomingHttpHeaders }> } {
  let resolve!: (v: { body: unknown; headers: http.IncomingHttpHeaders }) => void;
  const received = new Promise<{ body: unknown; headers: http.IncomingHttpHeaders }>((r) => { resolve = r; });
  const server = httpMod.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      resolve({ body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'), headers: req.headers });
      res.writeHead(200); res.end('ok');
    });
  });
  return { url: '', server, received };
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
}

test('rejects a request with no bearer header, and one with the wrong token', async () => {
  const { app, db } = buildTestApp('succeed');
  const noAuth = await app.inject({ method: 'POST', url: '/worker/audits', payload: { url: 'https://site.example.test', callback_url: 'https://caller.example.test/hook' } });
  assert.equal(noAuth.statusCode, 401);

  const wrongAuth = await app.inject({
    method: 'POST', url: '/worker/audits', headers: { authorization: 'Bearer nope' },
    payload: { url: 'https://site.example.test', callback_url: 'https://caller.example.test/hook' },
  });
  assert.equal(wrongAuth.statusCode, 401);
  db.close();
});

test('rejects malformed input with 400 before creating any run', async () => {
  const { app, db } = buildTestApp('succeed');
  const res = await app.inject({
    method: 'POST', url: '/worker/audits', headers: { authorization: `Bearer ${TOKEN}` },
    payload: { url: 'not-a-url', callback_url: 'https://caller.example.test/hook' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(db.listRuns().length, 0);
  db.close();
});

test('submit returns 202 with a run id immediately, status can be polled, and a success callback is delivered with the shared token', async () => {
  const { app, db } = buildTestApp('succeed');
  const receiver = startCallbackReceiver();
  const callbackUrl = await listen(receiver.server);

  const submit = await app.inject({
    method: 'POST', url: '/worker/audits', headers: { authorization: `Bearer ${TOKEN}` },
    payload: { url: 'https://site.example.test/', callback_url: callbackUrl },
  });
  assert.equal(submit.statusCode, 202);
  const { id, status } = submit.json();
  assert.ok(id);
  assert.equal(status, 'queued');

  // Immediately after submit, the run should not yet be in a terminal state — the whole point of
  // being asynchronous. (It may already be 'succeeded' if the fake agent's promise microtask ran
  // first, so this only asserts it is one of the valid statuses, not a specific one.)
  const firstPoll = await app.inject({ method: 'GET', url: `/worker/audits/${id}`, headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(firstPoll.statusCode, 200);
  assert.ok(['queued', 'running', 'succeeded'].includes(firstPoll.json().status));

  const { body, headers } = await receiver.received;
  assert.equal(headers.authorization, `Bearer ${TOKEN}`);
  const payload = body as Record<string, unknown>;
  assert.equal(payload.run_id, id);
  assert.equal(payload.status, 'succeeded');
  assert.deepEqual(payload.grades, { 'ai-visibility': 'B', search: 'C', build: 'A', design: 'D', readiness: 'C' });
  assert.deepEqual(payload.findings_by_severity, { critical: 0, high: 1, medium: 2, low: 3, info: 4 });
  assert.match(String(payload.report_html), /<html>.*report for https:\/\/site\.example\.test\/.*<\/html>/s);

  const finalPoll = await app.inject({ method: 'GET', url: `/worker/audits/${id}`, headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(finalPoll.json().status, 'succeeded');
  assert.deepEqual(finalPoll.json().scores, { 'ai-visibility': 80, search: 70, build: 90, design: 60, readiness: 75 });

  await new Promise<void>((r) => receiver.server.close(() => r()));
  db.close();
});

test('a failing audit still reaches a terminal state and the callback carries status "failed"', async () => {
  const { app, db } = buildTestApp('fail');
  const receiver = startCallbackReceiver();
  const callbackUrl = await listen(receiver.server);

  const submit = await app.inject({
    method: 'POST', url: '/worker/audits', headers: { authorization: `Bearer ${TOKEN}` },
    payload: { url: 'https://site.example.test/', callback_url: callbackUrl },
  });
  assert.equal(submit.statusCode, 202);
  const { id } = submit.json();

  const { body } = await receiver.received;
  const payload = body as Record<string, unknown>;
  assert.equal(payload.run_id, id);
  assert.equal(payload.status, 'failed');
  assert.match(String(payload.error), /audit blew up/);
  assert.equal(payload.scores, undefined);
  assert.equal(payload.report_html, undefined);

  const finalPoll = await app.inject({ method: 'GET', url: `/worker/audits/${id}`, headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(finalPoll.json().status, 'failed');
  assert.match(String(finalPoll.json().error), /audit blew up/);

  await new Promise<void>((r) => receiver.server.close(() => r()));
  db.close();
});

test('unknown run id, and a run belonging to a different agent name, both 404', async () => {
  const { app, db } = buildTestApp('succeed');
  const missing = await app.inject({ method: 'GET', url: '/worker/audits/nope', headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(missing.statusCode, 404);

  const e = db.createEngagement({ org: 'acme', name: 'other-agent-run' });
  const otherRun = db.createRun({ engagement_id: e.id, agent: 'sdet-architect', input: {} });
  const wrongAgent = await app.inject({ method: 'GET', url: `/worker/audits/${otherRun.id}`, headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(wrongAgent.statusCode, 404);
  db.close();
});
