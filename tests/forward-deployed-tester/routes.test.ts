// The extra REST route serves report.md for a run. Uses a throwaway DB file so getDb() never touches ./data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fdt-routes-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.WORKSPACE_DIR = path.join(tmp, 'ws');
// Dynamic imports so the env above is read by core/config.js.
const { getDb } = await import('../../src/core/db.js');
const { forwardDeployedTester } = await import('../../src/agents/forward-deployed-tester/index.js');

test('GET /agents/forward-deployed-tester/runs/:id/report serves markdown', async () => {
  const db = getDb();
  const e = db.createEngagement({ org: 'acme', name: 'routes' });
  const run = db.createRun({ engagement_id: e.id, agent: 'forward-deployed-tester', input: {} });
  const reportPath = path.join(tmp, 'report.md');
  fs.writeFileSync(reportPath, '# Forward Deployed Tester report: acme\n\nhello\n');
  db.addArtifact({ run_id: run.id, kind: 'report/markdown', path: reportPath });
  const other = db.createRun({ engagement_id: e.id, agent: 'sdet-architect', input: {} });

  const app = Fastify();
  forwardDeployedTester.registerRoutes!(app);

  const ok = await app.inject({ method: 'GET', url: `/agents/forward-deployed-tester/runs/${run.id}/report` });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.headers['content-type'] as string, /^text\/markdown/);
  assert.match(ok.body, /^# Forward Deployed Tester report: acme/);

  const missing = await app.inject({ method: 'GET', url: '/agents/forward-deployed-tester/runs/nope/report' });
  assert.equal(missing.statusCode, 404);
  const wrongAgent = await app.inject({ method: 'GET', url: `/agents/forward-deployed-tester/runs/${other.id}/report` });
  assert.equal(wrongAgent.statusCode, 404);

  await app.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
