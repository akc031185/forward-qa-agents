// Collector: background jobs and schedules. Vercel cron entries, scheduled GitHub workflows (and
// which app paths they call), cron-style API routes (and whether they check a secret), queue and
// scheduler libraries.
import { RepoFiles, depsOf, readPackages, sortUniq } from './files.js';
import type { Route } from './routes.js';
import { AUTH_RE } from './signals.js';

export interface CronEntry { path: string; schedule: string; describe: string; file: string }
export interface WorkflowSchedule { file: string; name?: string; cron: { schedule: string; describe: string }[]; calls_paths: string[] }
export interface CronRoute { path: string; file: string; secret_check: boolean; scheduled_by: string[] }
export interface JobsResult { vercel_crons: CronEntry[]; workflow_schedules: WorkflowSchedule[]; cron_routes: CronRoute[]; libraries: string[]; in_process: { file: string; lib: string }[] }

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const two = (s: string) => s.padStart(2, '0');

/** A plain-English reading of the common five-field cron shapes. Anything else is returned as is. */
export function describeCron(expr: string): string {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return expr;
  const [mi, h, dom, mon, dow] = f as [string, string, string, string, string];
  const num = (s: string) => /^\d+$/.test(s);
  const every = /^\*\/(\d+)$/;
  if (every.test(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `every ${every.exec(mi)![1]} minutes`;
  if (mi === '*' && h === '*' && dom === '*' && mon === '*' && dow === '*') return 'every minute';
  if (num(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*') return `hourly at :${two(mi)}`;
  if (num(mi) && every.test(h) && dom === '*' && mon === '*' && dow === '*') return `every ${every.exec(h)![1]} hours at :${two(mi)}`;
  if (num(mi) && num(h) && dom === '*' && mon === '*' && dow === '*') return `daily at ${two(h)}:${two(mi)} UTC`;
  if (num(mi) && num(h) && dom === '*' && mon === '*' && num(dow)) return `weekly on ${DOW[Number(dow) % 7]} at ${two(h)}:${two(mi)} UTC`;
  if (num(mi) && num(h) && dom === '*' && mon === '*' && /^1-5$/.test(dow)) return `weekdays at ${two(h)}:${two(mi)} UTC`;
  if (num(mi) && num(h) && num(dom) && mon === '*' && dow === '*') return `monthly on day ${dom} at ${two(h)}:${two(mi)} UTC`;
  return expr;
}

export function collectJobs(repo: RepoFiles, routes: Route[]): JobsResult {
  const vercel_crons: CronEntry[] = [];
  for (const f of repo.files.filter(x => /(^|\/)vercel\.json$/.test(x))) {
    try {
      const j = JSON.parse(repo.text(f) ?? '{}') as { crons?: { path?: string; schedule?: string }[] };
      for (const c of j.crons ?? []) if (c.path && c.schedule) vercel_crons.push({ path: c.path.split('?')[0]!, schedule: c.schedule, describe: describeCron(c.schedule), file: f });
    } catch { /* malformed vercel.json is reported by the deploy collector */ }
  }

  const workflow_schedules: WorkflowSchedule[] = [];
  for (const f of repo.files.filter(x => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(x))) {
    const y = repo.text(f) ?? '';
    const cron = [...y.matchAll(/-\s*cron\s*:\s*['"]([^'"]+)['"]/g)].map(m => ({ schedule: m[1]!, describe: describeCron(m[1]!) }));
    if (!cron.length) continue;
    const calls = sortUniq([...y.matchAll(/https?:\/\/[^\s'"]+?(\/api\/[\w\-/[\]]+)/g)].map(m => m[1]!.replace(/\/$/, ''))
      .concat([...y.matchAll(/\$\{\{[^}]+\}\}(\/api\/[\w\-/]+)/g)].map(m => m[1]!))
      // A shell variable holding the base URL: curl "$SITE_URL/api/cron/x" or ${BASE_URL}/api/...
      .concat([...y.matchAll(/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?(\/api\/[\w\-/]+)/g)].map(m => m[1]!.replace(/\/$/, ''))));
    workflow_schedules.push({ file: f, name: /^name\s*:\s*['"]?([^'"\n]+)/m.exec(y)?.[1]?.trim(), cron, calls_paths: calls });
  }

  const cron_routes: CronRoute[] = routes.filter(r => r.kind === 'api' && /\/cron(s)?\b|\/jobs?\/run|\/tasks?\/run|\/scheduled/i.test(r.path)).map(r => ({
    path: r.path, file: r.file, secret_check: r.signals.auth || AUTH_RE.test(repo.text(r.file) ?? ''),
    scheduled_by: [
      ...vercel_crons.filter(c => c.path === r.path).map(c => `vercel.json (${c.describe})`),
      ...workflow_schedules.filter(w => w.calls_paths.includes(r.path)).map(w => `${w.file} (${w.cron.map(c => c.describe).join('; ')})`),
    ],
  }));

  const pkgs = readPackages(repo);
  const deps = new Set(pkgs.flatMap(p => Object.keys(depsOf(p, false))));
  const LIBS: [string, string][] = [['bullmq', 'BullMQ'], ['bull', 'Bull'], ['agenda', 'Agenda'], ['node-cron', 'node-cron'], ['cron', 'cron'], ['inngest', 'Inngest'], ['@trigger.dev/sdk', 'Trigger.dev'], ['@upstash/qstash', 'QStash'], ['p-queue', 'p-queue']];
  const libraries = LIBS.filter(([p]) => deps.has(p)).map(([, l]) => l);
  const in_process: { file: string; lib: string }[] = [];
  for (const f of repo.code()) {
    const s = repo.text(f) ?? '';
    if (/cron\.schedule\s*\(/.test(s)) in_process.push({ file: f, lib: 'node-cron' });
    else if (/new\s+(Worker|Queue)\s*\(/.test(s) && /bullmq|bull\b/.test(s)) in_process.push({ file: f, lib: 'BullMQ' });
    else if (/setInterval\s*\([^)]*,\s*\d{5,}/.test(s)) in_process.push({ file: f, lib: 'setInterval' });
  }
  return { vercel_crons, workflow_schedules, cron_routes, libraries, in_process };
}
