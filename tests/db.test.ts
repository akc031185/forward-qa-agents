import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Db } from '../src/core/db.js';

test('engagement → run → finding round-trip', () => {
  const db = new Db(':memory:');
  const e = db.createEngagement({ org: 'acme', name: 'checkout', target_url: 'https://example.test' });
  const r = db.createRun({ engagement_id: e.id, agent: 'sdet-architect', input: { a: 1 } });
  db.markRunning(r.id); db.markFinished(r.id, { ok: true });
  db.addFinding({ run_id: r.id, severity: 'high', category: 'locator', title: 'xpath', evidence: { line: 3 } });
  assert.equal(db.getRun(r.id)!.status, 'succeeded');
  assert.equal(db.listFindings(r.id).length, 1);
  assert.equal(db.listRuns(e.id).length, 1);
  db.close();
});
