// The dossier.json contract. The portfolio index reads dossiers through this schema, so a dossier
// from an older or hand-edited file fails with a clear message instead of rendering half a page.
// Sections a portfolio page reads are typed field by field; the rest are checked for shape only.
import { z } from 'zod';
import { FactsSchema } from './facts.js';
import { DOSSIER_SCHEMA_VERSION } from './types.js';

const count = z.number().int().min(0);
const section = z.object({}).passthrough();

export const CountsSchema = z.object({
  services: count, pages: count, api_routes: count, api_endpoints: count, route_groups: count,
  models: count, stores: count, integrations: count, webhooks: count, webhooks_unverified: count,
  env_vars: count, secret_env_vars: count, crons: count, deploy_targets: count,
  test_files: count, test_cases: count, docs: count, commits: count, contributors: count, source_lines: count,
  monthly_cost_usd_stated: z.number().min(0),
});

export const RouteSchema = z.object({
  path: z.string(), methods: z.array(z.string()), kind: z.enum(['page', 'api']), framework: z.string(),
  file: z.string(), service: z.string(), group: z.string(),
  signals: z.object({ auth: z.boolean(), middleware_auth: z.boolean(), rate_limit: z.boolean(), tenant: z.boolean(), validation: z.boolean() }),
});

export const DossierSchema = z.object({
  schema_version: z.literal(DOSSIER_SCHEMA_VERSION),
  app: z.object({ id: z.string().min(1), name: z.string().min(1), one_liner: z.string().optional(), status: z.string().optional(), urls: z.array(z.string()) }),
  provenance: z.object({
    tool: z.literal('architecture-dossier'), tool_version: z.string(), plate: z.number(),
    repo_name: z.string(), remote: z.string().optional(), subdir: z.string().optional(),
    commit: z.string().regex(/^[0-9a-f]{40,64}$/), commit_short: z.string(), commit_date: z.string(), branch: z.string(),
    snapshot: z.string(), generated_at: z.string(), run_id: z.string().optional(),
    collectors: z.array(z.object({ name: z.string(), ok: z.boolean(), ms: z.number(), error: z.string().optional() })),
    secret_like_files_excluded: z.array(z.string()), symlinks_not_followed: count,
    facts_file: z.string().optional(), test_output_file: z.string().optional(),
  }),
  summary: z.object({ text: z.string(), counts: CountsSchema }),
  stack: z.object({ frameworks: z.array(z.object({ name: z.string(), category: z.string(), package: z.string() }).passthrough()) }).passthrough(),
  routes: z.object({ routes: z.array(RouteSchema), middleware: z.array(section), services: z.array(z.object({ dir: z.string(), name: z.string() })) }),
  models: z.object({
    models: z.array(z.object({ name: z.string(), store: z.string(), orm: z.string(), file: z.string(), fields: z.array(z.object({ name: z.string(), type: z.string() }).passthrough()), indexes: z.array(section) }).passthrough()),
    stores: z.array(z.object({ kind: z.string(), label: z.string(), evidence: z.array(z.string()) })),
  }),
  integrations: z.object({
    integrations: z.array(z.object({ id: z.string(), label: z.string(), category: z.string(), packages: z.array(z.string()), hosts: z.array(z.string()), files: z.array(z.string()), env: z.array(z.string()) })),
    other_hosts: z.array(z.object({ host: z.string(), files: z.array(z.string()) })),
  }),
  webhooks: z.array(z.object({ path: z.string(), file: z.string(), verified: z.boolean(), verification: z.array(z.string()), vendor: z.string().optional() }).passthrough()),
  auth: section, env: z.object({ vars: z.array(z.object({ name: z.string(), sources: z.array(z.string()), kind: z.enum(['secret', 'config', 'public']) }).passthrough()) }).passthrough(),
  jobs: section, deploy: section,
  tests: z.object({ total_files: count, total_cases: count }).passthrough(),
  docs: z.array(z.object({ path: z.string(), title: z.string() }).passthrough()),
  git: z.object({ commits: count, contributors: count, first_commit: z.string(), last_commit: z.string() }).passthrough().nullable(),
  size: z.object({ source_lines: count }).passthrough(),
  graph: z.object({ nodes: z.array(z.object({ id: z.string(), label: z.string(), column: z.number().int().min(0).max(4), kind: z.string() }).passthrough()), edges: z.array(z.object({ from: z.string(), to: z.string() }).passthrough()) }).passthrough(),
  gaps: z.array(z.object({ id: z.string(), severity: z.enum(['high', 'medium', 'low', 'info']), title: z.string(), detail: z.string(), source: z.enum(['measured', 'stated']), evidence: z.array(z.string()).optional() })),
  stated: FactsSchema.nullable(),
});

export type DossierJson = z.infer<typeof DossierSchema>;
