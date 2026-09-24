// Orchestration: snapshot HEAD, run every collector over the snapshot (each timed and isolated, so
// one failure empties one section instead of the whole dossier), derive gaps, assemble the record.
import path from 'node:path';
import { RepoFiles } from './files.js';
import { snapshotHead } from './snapshot.js';
import { ImportGraph } from './imports.js';
import { collectStack, type StackResult } from './stack.js';
import { collectRoutes, type RoutesResult } from './routes.js';
import { collectModels, type ModelsResult } from './models.js';
import { collectIntegrations, type IntegrationsResult } from './integrations.js';
import { collectWebhooks, type Webhook } from './webhooks.js';
import { collectAuth, type AuthResult } from './auth.js';
import { collectEnv, type EnvResult } from './env.js';
import { collectJobs, type JobsResult } from './jobs.js';
import { collectDeploy, type DeployResult } from './deploy.js';
import { collectTests, type TestsResult } from './testsuite.js';
import { collectDocs, type Doc } from './docs.js';
import { collectGitStats, type GitStats } from './gitstats.js';
import { collectSize, type SizeResult } from './size.js';
import { buildGraph, type Graph } from './graph.js';
import { deriveGaps } from './gaps.js';
import { monthlyTotal, type Facts } from './facts.js';
import { DOSSIER_SCHEMA_VERSION, TOOL, TOOL_VERSION, type CollectorRun, type Counts, type Dossier } from './types.js';

export const PLATE = 47;

export interface BuildOptions {
  repoPath: string;
  facts?: Facts | null;
  factsFileName?: string;
  name?: string;
  testOutput?: { name: string; text: string };
  tmpDir?: string;
  runId?: string;
  now?: () => Date;
  log?: (m: string) => void;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'app';
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

export function deterministicSummary(d: Omit<Dossier, 'summary'>, c: Counts): string {
  const fw = d.stack.frameworks.filter(f => ['framework', 'server'].includes(f.category)).map(f => f.resolved ? `${f.name} ${f.resolved}` : f.name);
  const parts = [
    `${d.app.name} is ${fw.length ? `a ${list(fw)} codebase` : 'a codebase'} with ${n(c.services, 'service')}, recorded at commit ${d.provenance.commit_short} (${d.provenance.commit_date.slice(0, 10)}, branch ${d.provenance.branch}).`,
    `It serves ${n(c.pages, 'page')} and ${n(c.api_endpoints, 'API endpoint')} across ${n(c.api_routes, 'API route')}${d.models.stores.length ? `, stores data in ${list(d.models.stores.map(s => s.label))} (${n(c.models, 'model')})` : ''}${d.integrations.integrations.length ? `, and integrates with ${list(d.integrations.integrations.map(i => i.label))}` : ''}.`,
    c.webhooks ? `${n(c.webhooks, 'inbound webhook')}, ${c.webhooks_unverified} without a signature check.` : '',
    `${n(c.test_files, 'test file')} with ${n(c.test_cases, 'test case')} by static count${d.tests.ingested ? `; the supplied run shows ${d.tests.ingested.passed} passed and ${d.tests.ingested.failed} failed` : ''}.`,
    d.git ? `${n(c.commits, 'commit')} by ${n(c.contributors, 'contributor')} since ${d.git.first_commit.slice(0, 10)}; ${c.source_lines.toLocaleString('en-US')} non-blank source lines.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

const EMPTY = {
  stack: (): StackResult => ({ packages: [], lockfiles: [], frameworks: [], typescript: false, runtime_pins: [], next: [] }),
  routes: (): RoutesResult => ({ routes: [], middleware: [], services: [] }),
  models: (): ModelsResult => ({ models: [], stores: [] }),
  integrations: (): IntegrationsResult => ({ integrations: [], other_hosts: [] }),
  auth: (): AuthResult => ({ libraries: [], password_hashing: [], api_key_files: [], roles: [], middleware: [], api_routes: { total: 0, with_auth_signal: 0, with_middleware_auth: 0, with_tenant_signal: 0, with_rate_limit: 0, with_validation: 0 }, unguarded_api_routes: [], signals: [] }),
  env: (): EnvResult => ({ vars: [], example_files: [], undocumented: [], unused_examples: [] }),
  jobs: (): JobsResult => ({ vercel_crons: [], workflow_schedules: [], cron_routes: [], libraries: [], in_process: [] }),
  deploy: (): DeployResult => ({ targets: [], docker: [], workflows: [] }),
  tests: (): TestsResult => ({ files: [], total_files: 0, total_cases: 0, by_kind: { unit: { files: 0, cases: 0 }, integration: { files: 0, cases: 0 }, e2e: { files: 0, cases: 0 } }, frameworks: [], config_files: [] }),
  size: (): SizeResult => ({ total_files: 0, source_files: 0, source_lines: 0, by_language: [], by_folder: [] }),
};

export function buildDossier(o: BuildOptions): Dossier {
  const log = o.log ?? (() => {});
  const now = o.now ?? (() => new Date());
  const snap = snapshotHead(o.repoPath, o.tmpDir);
  log(`snapshot ${snap.commit_short} (${snap.branch}) → ${snap.dir}; ${snap.secret_like_committed.length} secret-like files removed unread`);
  try {
    const repo = new RepoFiles(snap.dir);
    const runs: CollectorRun[] = [];
    const run = <T>(name: string, fn: () => T, fallback: () => T): T => {
      const t0 = Date.now();
      try { const v = fn(); runs.push({ name, ok: true, ms: Date.now() - t0 }); return v; } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        runs.push({ name, ok: false, ms: Date.now() - t0, error: msg.slice(0, 300) }); log(`collector ${name} failed: ${msg}`); return fallback();
      }
    };
    const imports = new ImportGraph(repo);
    const stack = run('stack', () => collectStack(repo), EMPTY.stack);
    const routes = run('routes', () => collectRoutes(repo), EMPTY.routes);
    const models = run('data-models', () => collectModels(repo), EMPTY.models);
    const env = run('env-names', () => collectEnv(repo), EMPTY.env);
    const integrations = run('integrations', () => collectIntegrations(repo, env.vars.map(v => v.name)), EMPTY.integrations);
    const webhooks = run('webhooks', () => collectWebhooks(repo, routes.routes, imports), (): Webhook[] => []);
    const auth = run('auth-security', () => collectAuth(repo, routes.routes, routes.middleware), EMPTY.auth);
    const jobs = run('jobs', () => collectJobs(repo, routes.routes), EMPTY.jobs);
    const deploy = run('deploy', () => collectDeploy(repo), EMPTY.deploy);
    const tests = run('tests', () => collectTests(repo, o.testOutput), EMPTY.tests);
    const docs = run('docs', () => collectDocs(repo), (): Doc[] => []);
    const git = run('git-stats', (): GitStats | null => collectGitStats(snap.repoPath, snap.commit_date), () => null);
    const size = run('code-size', () => collectSize(repo), EMPTY.size);
    const graph = run('graph', () => buildGraph(repo, imports, routes, models, integrations, webhooks), (): Graph => ({ nodes: [], edges: [] }));
    log(`collectors: ${runs.map(r => `${r.name}${r.ok ? '' : ' FAILED'} ${r.ms}ms`).join(', ')}`);

    const facts = o.facts ?? null;
    const name = o.name ?? facts?.app?.name ?? stack.packages.find(p => p.path === 'package.json')?.name ?? path.basename(snap.repoPath);
    const provenance: Dossier['provenance'] = {
      tool: TOOL, tool_version: TOOL_VERSION, plate: PLATE,
      repo_name: path.basename(snap.toplevel), remote: snap.remote, subdir: snap.prefix ? snap.prefix.replace(/\/$/, '') : undefined,
      commit: snap.commit, commit_short: snap.commit_short, commit_date: snap.commit_date, branch: snap.branch,
      snapshot: `git archive ${snap.commit_short}${snap.prefix ? `:${snap.prefix}` : ''} (committed HEAD; working tree not read)`,
      generated_at: now().toISOString(), run_id: o.runId, collectors: runs,
      secret_like_files_excluded: snap.secret_like_committed, symlinks_not_followed: repo.symlinks.length,
      facts_file: o.factsFileName, test_output_file: o.testOutput?.name,
    };
    const partial = { provenance, stack, routes, models, integrations, webhooks, auth, env, jobs, deploy, tests, docs, git, size, stated: facts };
    const gaps = deriveGaps(partial, facts);
    const api = routes.routes.filter(r => r.kind === 'api');
    const counts: Counts = {
      services: Math.max(routes.services.length, stack.packages.length ? 1 : 0),
      pages: routes.routes.filter(r => r.kind === 'page').length,
      api_routes: api.length, api_endpoints: api.reduce((k, r) => k + r.methods.length, 0),
      route_groups: new Set(api.map(r => `${r.service}|${r.group}`)).size,
      models: models.models.length, stores: models.stores.length, integrations: integrations.integrations.length,
      webhooks: webhooks.length, webhooks_unverified: webhooks.filter(w => !w.verified).length,
      env_vars: env.vars.length, secret_env_vars: env.vars.filter(v => v.kind === 'secret').length,
      crons: jobs.vercel_crons.length + jobs.workflow_schedules.reduce((k, w) => k + w.cron.length, 0),
      deploy_targets: deploy.targets.length,
      test_files: tests.total_files, test_cases: tests.total_cases, docs: docs.length,
      commits: git?.commits ?? 0, contributors: git?.contributors ?? 0, source_lines: size.source_lines,
      monthly_cost_usd_stated: monthlyTotal(facts ?? undefined),
    };
    const app = { id: slug(name), name, one_liner: facts?.app?.one_liner, status: facts?.app?.status, urls: facts?.app?.urls ?? [] };
    const base = { schema_version: DOSSIER_SCHEMA_VERSION, app, ...partial, graph, gaps };
    return { ...base, summary: { text: deterministicSummary(base, counts), counts } };
  } finally {
    snap.cleanup();
  }
}
