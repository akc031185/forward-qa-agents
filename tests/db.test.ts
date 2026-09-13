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

test('an old database whose runs CHECK predates an agent is migrated in place', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dbmig-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE engagements (id TEXT PRIMARY KEY, org TEXT NOT NULL, name TEXT NOT NULL, target_url TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE TABLE runs (id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL REFERENCES engagements(id),
      agent TEXT NOT NULL CHECK (agent IN ('forward-deployed-tester','sdet-architect')),
      status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
      input_json TEXT NOT NULL, output_json TEXT, error TEXT, started_at TEXT, finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE TABLE findings (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), severity TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, evidence_json TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    INSERT INTO engagements (id, org, name) VALUES ('e1', 'acme', 'old');
    INSERT INTO runs (id, engagement_id, agent, status, input_json) VALUES ('r1', 'e1', 'sdet-architect', 'succeeded', '{}');
    INSERT INTO findings (id, run_id, severity, category, title) VALUES ('f1', 'r1', 'low', 'x', 'kept');`);
  old.close();

  const db = new Db(file);
  assert.equal(db.getRun('r1')!.agent, 'sdet-architect', 'old run kept');
  assert.equal(db.listFindings('r1')[0]!.title, 'kept', 'child rows kept');
  const r = db.createRun({ engagement_id: 'e1', agent: 'ai-site-auditor', input: {} });
  db.addFinding({ run_id: r.id, severity: 'high', category: 'llm', title: 'new agent accepted' });
  assert.equal(db.listRuns('e1').length, 2);
  assert.throws(() => db.createRun({ engagement_id: 'e1', agent: 'nope' as never, input: {} }), /CHECK constraint/);
  db.close();
  const again = new Db(file);   // idempotent: second open does nothing
  assert.equal(again.listRuns('e1').length, 2);
  again.close();
});
