// Separate file, on purpose: config.ts reads AUDIT_WORKER_TOKEN once at import time, and node's
// test runner gives each matched file its own process, so this file — which never sets the
// variable — is the one place that exercises "the operator forgot to configure it".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { Db } from '../../src/core/db.js';
import { registerWorkerRoutes } from '../../src/api/worker.js';
import { config } from '../../src/core/config.js';
import type { AgentDefinition } from '../../src/core/agent.js';

test('AUDIT_WORKER_TOKEN unset in the environment for this process', () => {
  assert.equal(config.workerToken, '');
});

test('worker endpoints refuse (503) rather than run open when no token is configured', async () => {
  const db = new Db(':memory:');
  const app = Fastify({ logger: false });
  const fakeAgent = { name: 'ai-site-auditor', plate: 46, oneLiner: 'x', inputSchema: { parse: (v: unknown) => v } } as unknown as AgentDefinition<unknown, unknown>;
  registerWorkerRoutes(app, db, fakeAgent as never);

  const submit = await app.inject({ method: 'POST', url: '/worker/audits', payload: { url: 'https://site.example.test', callback_url: 'https://caller.example.test/hook' } });
  assert.equal(submit.statusCode, 503);
  assert.match(submit.json().error, /AUDIT_WORKER_TOKEN/);

  const status = await app.inject({ method: 'GET', url: '/worker/audits/does-not-exist' });
  assert.equal(status.statusCode, 503);

  // Even a request that (incorrectly) supplies a bearer header is still refused: there is no
  // configured token to check it against.
  const withHeader = await app.inject({ method: 'GET', url: '/worker/audits/does-not-exist', headers: { authorization: 'Bearer anything' } });
  assert.equal(withHeader.statusCode, 503);

  db.close();
});
