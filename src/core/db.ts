// SQLite persistence on the Node built-in driver. No server, no native build, no cost.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

/** Every agent in the repo. The runs.agent CHECK constraint is generated from this list. */
export const AGENT_NAMES = ['forward-deployed-tester', 'sdet-architect', 'ai-site-auditor'] as const;
const AGENT_CHECK = `CHECK (agent IN (${AGENT_NAMES.map(a => `'${a}'`).join(',')}))`;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS engagements (
  id          TEXT PRIMARY KEY,
  org         TEXT NOT NULL,
  name        TEXT NOT NULL,
  target_url  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS runs (
  id             TEXT PRIMARY KEY,
  engagement_id  TEXT NOT NULL REFERENCES engagements(id),
  agent          TEXT NOT NULL ${AGENT_CHECK},
  status         TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  input_json     TEXT NOT NULL,
  output_json    TEXT,
  error          TEXT,
  started_at     TEXT,
  finished_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS findings (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  severity    TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  category    TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  evidence_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS artifacts (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  kind        TEXT NOT NULL,
  path        TEXT NOT NULL,
  meta_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_runs_engagement ON runs(engagement_id);
CREATE INDEX IF NOT EXISTS idx_findings_run ON findings(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
`;

export type AgentName = typeof AGENT_NAMES[number];
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Engagement { id: string; org: string; name: string; target_url: string | null; created_at: string }
export interface Run {
  id: string; engagement_id: string; agent: AgentName; status: RunStatus;
  input_json: string; output_json: string | null; error: string | null;
  started_at: string | null; finished_at: string | null; created_at: string;
}
export interface Finding {
  id: string; run_id: string; severity: Severity; category: string; title: string;
  detail: string | null; evidence_json: string | null; created_at: string;
}
export interface Artifact { id: string; run_id: string; kind: string; path: string; meta_json: string | null; created_at: string }

export class Db {
  readonly sql: DatabaseSync;
  constructor(file: string = config.dbPath) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.sql = new DatabaseSync(file);
    this.sql.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.sql.exec(SCHEMA);
    this.migrateAgentCheck();
  }

  /**
   * SQLite cannot alter a CHECK constraint. A database created before an agent was added still
   * rejects that agent's runs, so rebuild `runs` with the current constraint, keeping every row.
   * Children (findings, artifacts) reference `runs` by name and are untouched.
   */
  private migrateAgentCheck(): void {
    const row = this.sql.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='runs'").get() as { sql: string } | undefined;
    if (!row || AGENT_NAMES.every(a => row.sql.includes(`'${a}'`))) return;
    this.sql.exec('PRAGMA foreign_keys = OFF;');
    try {
      this.sql.exec('BEGIN;');
      const create = SCHEMA.slice(SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS runs'), SCHEMA.indexOf(');', SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS runs')) + 2)
        .replace('CREATE TABLE IF NOT EXISTS runs', 'CREATE TABLE runs_new');
      this.sql.exec(create);
      this.sql.exec('INSERT INTO runs_new SELECT id, engagement_id, agent, status, input_json, output_json, error, started_at, finished_at, created_at FROM runs;');
      this.sql.exec('DROP TABLE runs;');
      this.sql.exec('ALTER TABLE runs_new RENAME TO runs;');
      this.sql.exec('CREATE INDEX IF NOT EXISTS idx_runs_engagement ON runs(engagement_id);');
      this.sql.exec('COMMIT;');
    } catch (err) {
      this.sql.exec('ROLLBACK;');
      throw err;
    } finally {
      this.sql.exec('PRAGMA foreign_keys = ON;');
    }
  }

  createEngagement(e: { org: string; name: string; target_url?: string | null }): Engagement {
    const id = randomUUID();
    this.sql.prepare('INSERT INTO engagements (id, org, name, target_url) VALUES (?, ?, ?, ?)')
      .run(id, e.org, e.name, e.target_url ?? null);
    return this.getEngagement(id)!;
  }
  getEngagement(id: string): Engagement | undefined {
    return this.sql.prepare('SELECT * FROM engagements WHERE id = ?').get(id) as unknown as Engagement | undefined;
  }
  listEngagements(): Engagement[] {
    return this.sql.prepare('SELECT * FROM engagements ORDER BY created_at DESC').all() as unknown as Engagement[];
  }

  createRun(r: { engagement_id: string; agent: AgentName; input: unknown }): Run {
    const id = randomUUID();
    this.sql.prepare('INSERT INTO runs (id, engagement_id, agent, status, input_json) VALUES (?, ?, ?, ?, ?)')
      .run(id, r.engagement_id, r.agent, 'queued', JSON.stringify(r.input));
    return this.getRun(id)!;
  }
  getRun(id: string): Run | undefined {
    return this.sql.prepare('SELECT * FROM runs WHERE id = ?').get(id) as unknown as Run | undefined;
  }
  listRuns(engagementId?: string): Run[] {
    return engagementId
      ? this.sql.prepare('SELECT * FROM runs WHERE engagement_id = ? ORDER BY created_at DESC').all(engagementId) as unknown as Run[]
      : this.sql.prepare('SELECT * FROM runs ORDER BY created_at DESC').all() as unknown as Run[];
  }
  markRunning(id: string) {
    this.sql.prepare(`UPDATE runs SET status='running', started_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(id);
  }
  markFinished(id: string, output: unknown) {
    this.sql.prepare(`UPDATE runs SET status='succeeded', output_json=?, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .run(JSON.stringify(output), id);
  }
  markFailed(id: string, error: string) {
    this.sql.prepare(`UPDATE runs SET status='failed', error=?, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(error, id);
  }

  addFinding(f: { run_id: string; severity: Severity; category: string; title: string; detail?: string; evidence?: unknown }): Finding {
    const id = randomUUID();
    this.sql.prepare('INSERT INTO findings (id, run_id, severity, category, title, detail, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, f.run_id, f.severity, f.category, f.title, f.detail ?? null, f.evidence === undefined ? null : JSON.stringify(f.evidence));
    return this.sql.prepare('SELECT * FROM findings WHERE id = ?').get(id) as unknown as Finding;
  }
  listFindings(runId: string): Finding[] {
    return this.sql.prepare('SELECT * FROM findings WHERE run_id = ? ORDER BY created_at').all(runId) as unknown as Finding[];
  }

  addArtifact(a: { run_id: string; kind: string; path: string; meta?: unknown }): Artifact {
    const id = randomUUID();
    this.sql.prepare('INSERT INTO artifacts (id, run_id, kind, path, meta_json) VALUES (?, ?, ?, ?, ?)')
      .run(id, a.run_id, a.kind, a.path, a.meta === undefined ? null : JSON.stringify(a.meta));
    return this.sql.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as unknown as Artifact;
  }
  listArtifacts(runId: string): Artifact[] {
    return this.sql.prepare('SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at').all(runId) as unknown as Artifact[];
  }

  close() { this.sql.close(); }
}

let shared: Db | undefined;
export function getDb(): Db { return (shared ??= new Db()); }

if (process.argv.includes('--init')) {
  const db = new Db();
  console.log(`initialised ${config.dbPath}`);
  db.close();
}
