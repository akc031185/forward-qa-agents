// Contract every agent in this repo implements. The API layer and CLIs only talk to this.
import type { FastifyInstance } from 'fastify';
import type { Db, AgentName } from './db.js';
import type { z } from 'zod';

export interface AgentContext {
  db: Db;
  runId: string;
  engagementId: string;
  workspaceDir: string;          // per-run scratch/output directory, already created
  log: (msg: string) => void;
}

export interface AgentDefinition<I, O> {
  name: AgentName;
  plate: number;                 // field-guide plate number
  oneLiner: string;
  inputSchema: z.ZodType<I>;
  run(input: I, ctx: AgentContext): Promise<O>;
  /** Optional extra REST routes beyond the generic /agents/:name/runs. */
  registerRoutes?(app: FastifyInstance): void;
}
