// Known gaps a buyer's diligence would raise, derived only from what the collectors measured, plus
// the owner's stated gaps. Fixed rules, so two runs on the same commit list the same gaps.
import type { Facts } from './facts.js';
import type { Dossier, Gap } from './types.js';

type Measured = Omit<Dossier, 'gaps' | 'summary' | 'app' | 'graph' | 'schema_version'>;
const SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3 } as const;

export function deriveGaps(d: Measured, facts: Facts | null): Gap[] {
  const gaps: Gap[] = [];
  const add = (g: Omit<Gap, 'source'>) => gaps.push({ ...g, source: 'measured' });

  if (d.provenance.secret_like_files_excluded.length) add({
    id: 'secrets.committed-secret-file', severity: 'high', title: 'Secret-like files are committed to the repository',
    detail: 'These files are in the HEAD commit and so in the git history. They were excluded from the dossier unread; assume every value in them is exposed, rotate it, and purge the history before handing the repository over.',
    evidence: d.provenance.secret_like_files_excluded,
  });
  for (const w of d.webhooks.filter(x => !x.verified)) add({
    id: 'webhooks.unverified', severity: 'high', title: `Webhook ${w.path} does not verify a signature`,
    detail: `No signature check was found in the handler or the helpers it imports${w.vendor ? ` (sender looks like ${w.vendor})` : ''}. Anyone who finds the URL can post forged events to it.`,
    evidence: [w.file],
  });
  const ingested = d.tests.ingested;
  if (ingested && ingested.failed > 0) add({ id: 'tests.failing', severity: 'high', title: `${ingested.failed} failing test${ingested.failed === 1 ? '' : 's'} in the supplied run`, detail: `From ${ingested.file_name} (${ingested.format}): ${ingested.passed} passed, ${ingested.failed} failed, ${ingested.skipped} skipped.` });
  if (d.tests.total_files === 0) add({ id: 'tests.none', severity: 'medium', title: 'No automated tests found', detail: 'No test files were found by name or folder. Behaviour cannot be checked after a handover without them.' });
  for (const c of d.jobs.cron_routes.filter(x => !x.secret_check)) add({
    id: 'jobs.cron-unauthenticated', severity: 'medium', title: `Cron route ${c.path} shows no secret check`,
    detail: 'A scheduled endpoint without a shared-secret or session check can be triggered by anyone, as often as they like.', evidence: [c.file],
  });
  if (d.auth.unguarded_api_routes.length) add({
    id: 'auth.unguarded-api-routes', severity: 'medium', title: `${d.auth.unguarded_api_routes.length} API route${d.auth.unguarded_api_routes.length === 1 ? '' : 's'} show no auth signal`,
    detail: 'No session, token, key or middleware check was seen for these routes (auth, health, webhook and cron routes are excluded). Some may be public on purpose; each should be confirmed.',
    evidence: d.auth.unguarded_api_routes.slice(0, 30),
  });
  const usedInCode = d.env.vars.filter(v => v.code_files > 0).length;
  if (!d.env.example_files.length && usedInCode) add({ id: 'env.no-example', severity: 'medium', title: 'No .env.example documents the environment', detail: `${usedInCode} variables are read in code, but no .env.example, .env.sample or .env.template lists them. A new owner has to find each one by reading the source.` });
  else if (d.env.undocumented.length) add({ id: 'env.undocumented', severity: 'low', title: `${d.env.undocumented.length} environment variable${d.env.undocumented.length === 1 ? ' is' : 's are'} used in code but missing from the example file`, detail: 'The example file is the handover list of settings; these names are not in it.', evidence: d.env.undocumented });
  if (!d.deploy.workflows.length) add({ id: 'ci.none', severity: 'low', title: 'No CI workflow', detail: 'No GitHub Actions workflow runs the tests or the build on each change.' });
  if (!d.stack.lockfiles.length && d.stack.packages.length) add({ id: 'deps.no-lockfile', severity: 'low', title: 'No dependency lockfile', detail: 'Without a lockfile, a fresh install can pull different versions from the ones in production.' });
  if (!d.docs.some(x => x.kind === 'readme' && !x.path.includes('/'))) add({ id: 'docs.no-readme', severity: 'low', title: 'No README at the repository root', detail: 'There is no top-level README explaining how to run, configure and deploy the app.' });
  const api = d.routes.routes.filter(r => r.kind === 'api').length;
  if (api && !d.auth.signals.find(s => s.id === 'rate-limit')?.present) add({ id: 'security.no-rate-limit', severity: 'low', title: 'No rate limiting found', detail: `${api} API routes and no rate-limiting code or plugin. Sign-in, sign-up and form endpoints are the usual targets.` });
  if (api && !d.auth.signals.find(s => s.id === 'security-headers')?.present) add({ id: 'security.no-headers', severity: 'low', title: 'No security headers configured in code', detail: 'No Content-Security-Policy, HSTS or frame-options headers were found in next.config, vercel.json or server code. The host may still add some.' });
  for (const img of d.deploy.docker.filter(x => !x.user || x.user === 'root')) add({ id: 'deploy.docker-root', severity: 'low', title: `${img.file} runs as root`, detail: 'The image never switches to an unprivileged USER.', evidence: [img.file] });
  if (d.integrations.other_hosts.length) add({ id: 'integrations.unlisted-hosts', severity: 'info', title: `${d.integrations.other_hosts.length} outbound host${d.integrations.other_hosts.length === 1 ? '' : 's'} not in the vendor catalogue`, detail: 'The code calls these hosts. Each is a dependency or an account to account for in the handover.', evidence: d.integrations.other_hosts.map(h => h.host).slice(0, 20) });
  if (d.provenance.symlinks_not_followed) add({ id: 'repo.symlinks', severity: 'info', title: `${d.provenance.symlinks_not_followed} symbolic link${d.provenance.symlinks_not_followed === 1 ? '' : 's'} not followed`, detail: 'Linked files were not read, so anything behind them is missing from this dossier.' });
  for (const c of d.provenance.collectors.filter(x => !x.ok)) add({ id: `dossier.collector-failed.${c.name}`, severity: 'info', title: `The ${c.name} collector failed`, detail: `That section is empty because the collector raised an error: ${c.error ?? 'unknown'}.` });

  for (const [i, g] of (facts?.known_gaps ?? []).entries()) gaps.push({ id: `stated.${i + 1}`, severity: g.severity, title: g.title, detail: g.detail ?? '', source: 'stated' });
  return gaps.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (a.source === b.source ? 0 : a.source === 'measured' ? -1 : 1));
}
