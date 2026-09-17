import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import type { Db, Run } from './db.js';
import type { AgentDefinition, AgentContext } from './agent.js';

/**
 * Phase 1 (synchronous): validate input, create the run row, prepare its workspace, and mark it
 * running. Split out of `executeAgent` so a caller that needs the run id *before* the agent
 * finishes — the worker routes in `src/api/worker.ts`, which must answer with a run id
 * immediately and let a slow audit finish in the background — can get it without waiting on
 * `agent.run`. `executeAgent` below is unchanged in behaviour: it is just `startRun` followed by
 * `finishRun`.
 */
export function startRun<I, O>(db: Db, agent: AgentDefinition<I, O>, engagementId: string, rawInput: unknown): { run: Run; input: I; workspaceDir: string } {
  const input = agent.inputSchema.parse(rawInput);
  const run = db.createRun({ engagement_id: engagementId, agent: agent.name, input });
  const workspaceDir = path.join(config.workspaceDir, run.id);
  fs.mkdirSync(workspaceDir, { recursive: true });
  db.markRunning(run.id);
  return { run, input, workspaceDir };
}

/** Phase 2 (asynchronous): run the agent against an already-started run, and persist the outcome. */
export async function finishRun<I, O>(db: Db, agent: AgentDefinition<I, O>, run: Run, input: I, workspaceDir: string): Promise<{ run: Run; output: O }> {
  const logs: string[] = [];
  const ctx: AgentContext = {
    db, runId: run.id, engagementId: run.engagement_id, workspaceDir,
    log: (m) => { logs.push(`${new Date().toISOString()} ${m}`); },
  };
  try {
    const output = await agent.run(input, ctx);
    fs.writeFileSync(path.join(workspaceDir, 'run.log'), logs.join('\n'));
    db.markFinished(run.id, output);
    return { run: db.getRun(run.id)!, output };
  } catch (err) {
    fs.writeFileSync(path.join(workspaceDir, 'run.log'), logs.join('\n'));
    db.markFailed(run.id, err instanceof Error ? err.stack ?? err.message : String(err));
    throw err;
  }
}

/** Validate input, create a run row, execute the agent, persist the outcome. */
export async function executeAgent<I, O>(db: Db, agent: AgentDefinition<I, O>, engagementId: string, rawInput: unknown): Promise<{ run: Run; output: O }> {
  const { run, input, workspaceDir } = startRun(db, agent, engagementId, rawInput);
  return finishRun(db, agent, run, input, workspaceDir);
}
