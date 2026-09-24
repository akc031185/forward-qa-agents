// The dossier: one record per app at one commit. Everything under a collector key is "measured"
// (read from the committed source or git history); everything under `stated` came from the
// owner's facts file. dossier.json is this object, validated by schema.ts.
import type { StackResult } from './stack.js';
import type { RoutesResult } from './routes.js';
import type { ModelsResult } from './models.js';
import type { IntegrationsResult } from './integrations.js';
import type { Webhook } from './webhooks.js';
import type { AuthResult } from './auth.js';
import type { EnvResult } from './env.js';
import type { JobsResult } from './jobs.js';
import type { DeployResult } from './deploy.js';
import type { TestsResult } from './testsuite.js';
import type { Doc } from './docs.js';
import type { GitStats } from './gitstats.js';
import type { SizeResult } from './size.js';
import type { Graph } from './graph.js';
import type { Facts } from './facts.js';

export const DOSSIER_SCHEMA_VERSION = 1 as const;
export const TOOL = 'architecture-dossier';
export const TOOL_VERSION = '0.1.0';

export interface CollectorRun { name: string; ok: boolean; ms: number; error?: string }

export interface Provenance {
  tool: string; tool_version: string; plate: number;
  repo_name: string; remote?: string; subdir?: string;
  commit: string; commit_short: string; commit_date: string; branch: string;
  snapshot: string; generated_at: string; run_id?: string;
  collectors: CollectorRun[];
  secret_like_files_excluded: string[];
  symlinks_not_followed: number;
  facts_file?: string; test_output_file?: string;
}

export type GapSeverity = 'high' | 'medium' | 'low' | 'info';
export interface Gap { id: string; severity: GapSeverity; title: string; detail: string; source: 'measured' | 'stated'; evidence?: string[] }

export interface Counts {
  services: number; pages: number; api_routes: number; api_endpoints: number; route_groups: number;
  models: number; stores: number; integrations: number; webhooks: number; webhooks_unverified: number;
  env_vars: number; secret_env_vars: number; crons: number; deploy_targets: number;
  test_files: number; test_cases: number; docs: number;
  commits: number; contributors: number; source_lines: number;
  monthly_cost_usd_stated: number;
}

export interface Dossier {
  schema_version: typeof DOSSIER_SCHEMA_VERSION;
  app: { id: string; name: string; one_liner?: string; status?: string; urls: string[] };
  provenance: Provenance;
  summary: { text: string; counts: Counts };
  stack: StackResult;
  routes: RoutesResult;
  models: ModelsResult;
  integrations: IntegrationsResult;
  webhooks: Webhook[];
  auth: AuthResult;
  env: EnvResult;
  jobs: JobsResult;
  deploy: DeployResult;
  tests: TestsResult;
  docs: Doc[];
  git: GitStats | null;
  size: SizeResult;
  graph: Graph;
  gaps: Gap[];
  stated: Facts | null;
}
