import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import type { Db } from './db.js';
import type { AgentDefinition } from './agent.js';

/** Validate input, create a run row, execute the agent, persist the outcome. */
export async function executeAgent<I, O>(db: Db, agent: AgentDefinition<I, O>, engagementId: string, rawInput: unknown) {
  const input = agent.inputSchema.parse(rawInput);
  const run = db.createRun({ engagement_id: engagementId, agent: agent.name, input });
  const workspaceDir = path.join(config.workspaceDir, run.id);
  fs.mkdirSync(workspaceDir, { recursive: true });
  db.markRunning(run.id);
  const logs: string[] = [];
  try {
    const output = await agent.run(input, {
      db, runId: run.id, engagementId, workspaceDir,
      log: (m) => { logs.push(`${new Date().toISOString()} ${m}`); },
    });
    fs.writeFileSync(path.join(workspaceDir, 'run.log'), logs.join('\n'));
    db.markFinished(run.id, output);
    return { run: db.getRun(run.id)!, output };
  } catch (err) {
    fs.writeFileSync(path.join(workspaceDir, 'run.log'), logs.join('\n'));
    db.markFailed(run.id, err instanceof Error ? err.stack ?? err.message : String(err));
    throw err;
  }
}
