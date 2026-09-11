// The SDET Architect (plate 45): inventories any legacy test estate and rebuilds it as ONE
// standardised Playwright + Playwright MCP architecture. Works fully offline with LLM_PROVIDER=none.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AgentDefinition, AgentContext } from '../../core/agent.js';
import { getDb } from '../../core/db.js';
import { maybeLlm } from '../../core/llm.js';
import { countByKind, inventory } from './inventory.js';
import { generateEstate, parseEstate, parseOne, unknownSteps } from './convert.js';
import { buildMigrationReport } from './report.js';
import type { FileKind, Step } from './model.js';
import { FILE_KINDS } from './model.js';
import { genSpec, specFileName } from './generators/spec.js';
import { buildPlan } from './generators/plan.js';
import { genPageClass } from './generators/pages.js';
import { genApiSpec } from './generators/api.js';
import { genStepDefinitions } from './generators/bdd.js';
import { classifyFile } from './inventory.js';

export const InputSchema = z.object({
  source_dir: z.string().min(1).refine((p) => path.isAbsolute(p), 'source_dir must be an absolute path'),
  org_slug: z.string().min(1).regex(/^[a-z0-9][a-z0-9-_]*$/i, 'org_slug: letters, digits, - and _ only'),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  base_url: z.string().url().optional(),
  language_hint: z.enum(['java', 'python', 'csharp', 'javascript', 'typescript', 'auto']).optional(),  // default 'auto'
  dry_run: z.boolean().optional(),                                                                     // default false
});
export type Input = z.infer<typeof InputSchema>;

export interface Output {
  inventory: Record<FileKind, number>;
  files_scanned: number;
  tests_found: number;
  tests_converted: number;
  tests_partial: number;
  tests_manual: number;
  locators_total: number;
  locators_low_confidence: number;
  coverage_pct: number;
  output_dir: string;
  migration_report: string;
}

export async function run(input: Input, ctx: AgentContext): Promise<Output> {
  const outputDir = path.join(ctx.workspaceDir, 'playwright');
  const dryRun = input.dry_run ?? false;
  const languageHint = input.language_hint ?? 'auto';
  if (!fs.existsSync(input.source_dir) || !fs.statSync(input.source_dir).isDirectory()) throw new Error(`source_dir not found: ${input.source_dir}`);

  // a. Inventory
  ctx.log(`[inventory] walking ${input.source_dir}`);
  const inv = inventory(input.source_dir, { include: input.include, exclude: input.exclude, languageHint });
  const counts = countByKind(inv.entries);
  ctx.log(`[inventory] ${inv.entries.length} files: ${FILE_KINDS.filter((k) => counts[k]).map((k) => `${k}=${counts[k]}`).join(', ')}`);

  // b. Extraction
  const suites = parseEstate(inv.entries, inv.contents);
  const testsFound = suites.reduce((n, s) => n + s.tests.length, 0);
  ctx.log(`[extraction] ${suites.length} suites, ${testsFound} tests, ${suites.reduce((n, s) => n + s.locators.length, 0)} locator references`);

  // optional model assistance for leftovers (comment-only suggestions; deterministic fallback = TODO stub)
  const leftovers = unknownSteps(suites);
  const hints = new Map<Step, string>();
  if (leftovers.length) {
    const sample = leftovers.slice(0, 25);
    const suggestions = await maybeLlm(async (llm) => {
      const prompt = ['Convert each legacy Selenium line to ONE Playwright TypeScript line. Answer with the same numbering, one line each, no prose.', ...sample.map((l, i) => `${i + 1}. [${l.file}] ${l.step.raw.trim()}`)].join('\n');
      const text = await llm.complete(prompt, { system: 'You are a senior SDET migrating Selenium to Playwright.', maxTokens: 1500 });
      return text.split('\n').map((l) => /^\s*(\d+)[.)]\s*(.+)$/.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => [Number(m[1]) - 1, m[2].trim()] as const);
    }, [] as readonly (readonly [number, string])[]);
    for (const [i, s] of suggestions) if (sample[i]) hints.set(sample[i].step, s);
    ctx.log(`[extraction] ${leftovers.length} unconvertible lines; model suggestions: ${hints.size}`);
  }

  // c + d. Standardisation and generation (pure)
  const gen = generateEstate(suites, { orgSlug: input.org_slug, baseUrl: input.base_url, hints });
  ctx.log(`[locators] ${gen.uniqueLocators} unique, ${gen.lowLocators.length} low confidence; testIdAttribute=${gen.plan.stdOptions.testIdAttribute}`);
  ctx.log(`[generation] ${gen.files.size} files planned; coverage ${gen.totals.coveragePct}%`);

  // findings
  const db = ctx.db;
  for (const l of gen.lowLocators) db.addFinding({ run_id: ctx.runId, severity: l.confidence < 0.4 ? 'high' : 'medium', category: 'locator', title: `Brittle locator (${l.strategy}): ${l.value.slice(0, 80)}`, detail: `${l.note ?? 'low confidence'} -> generated ${l.expr}`, evidence: { file: l.file, line: l.line, confidence: l.confidence } });
  for (const t of gen.todos) db.addFinding({ run_id: ctx.runId, severity: 'medium', category: 'conversion', title: `Unconvertible: ${t.raw.slice(0, 80)}`, detail: `in ${t.where}`, evidence: { file: t.file, line: t.line } });
  for (const f of gen.flaky) db.addFinding({ run_id: ctx.runId, severity: 'low', category: 'flakiness', title: `Hard wait removed: ${f.raw.slice(0, 80)}`, detail: 'Playwright auto-waits; the sleep was replaced with a NOTE comment.', evidence: { file: f.file, line: f.line } });
  for (const d of gen.duplicates.slice(0, 50)) db.addFinding({ run_id: ctx.runId, severity: 'low', category: 'duplication', title: `Locator duplicated in ${d.files.length} files: ${d.strategy}=${d.value.slice(0, 60)}`, detail: d.files.join(', '), evidence: d });
  for (const n of gen.noAssertion) db.addFinding({ run_id: ctx.runId, severity: 'low', category: 'quality', title: `Test without assertion: ${n.test}`, evidence: { file: n.file } });

  // report
  const migration = buildMigrationReport({
    orgSlug: input.org_slug, sourceDir: input.source_dir, outputDir, baseUrl: gen.baseUrl, dryRun,
    inventory: inv.entries, counts, files: gen.fileStatuses, totals: gen.totals, todos: gen.todos,
    locators: { total: gen.uniqueLocators, low: gen.lowLocators.length, histogram: gen.histogram, byStrategy: gen.byStrategy, lowList: gen.lowLocators },
    findings: { flaky: gen.flaky.length, duplication: gen.duplicates.length, quality: gen.noAssertion.length, conversion: gen.todos.length, locator: gen.lowLocators.length },
    generatedFiles: [...gen.files.keys(), 'MIGRATION.md'].sort(), llmUsed: hints.size > 0,
  });
  gen.files.set('MIGRATION.md', migration);

  // write
  if (!dryRun) {
    for (const [rel, content] of gen.files) {
      const abs = path.join(outputDir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      db.addArtifact({ run_id: ctx.runId, kind: rel === 'MIGRATION.md' ? 'migration-report' : rel.endsWith('.spec.ts') ? 'playwright-spec' : rel.startsWith('src/pages/') ? 'page-object' : 'project-file', path: abs, meta: { relative: rel, bytes: content.length } });
    }
    ctx.log(`[generation] wrote ${gen.files.size} files to ${outputDir}`);
  } else ctx.log('[generation] dry run: nothing written');

  return {
    inventory: counts,
    files_scanned: inv.entries.length,
    tests_found: gen.totals.tests,
    tests_converted: gen.totals.converted,
    tests_partial: gen.totals.partial,
    tests_manual: gen.totals.manual,
    locators_total: gen.uniqueLocators,
    locators_low_confidence: gen.lowLocators.length,
    coverage_pct: gen.totals.coveragePct,
    output_dir: outputDir,
    migration_report: migration,
  };
}

export const PreviewSchema = z.object({
  language: z.enum(['java', 'python', 'csharp', 'javascript', 'typescript', 'gherkin', 'postman', 'markdown', 'auto']).optional(),
  code: z.string().min(1),
  filename: z.string().optional(),
  base_url: z.string().url().optional(),
});

/** Convert a single source file in memory. No disk, no DB. */
export function preview(body: z.infer<typeof PreviewSchema>): { kind: FileKind; output_file: string; spec: string; tests_found: number; todos: number; coverage_pct: number } {
  const ext = { java: 'java', python: 'py', csharp: 'cs', javascript: 'js', typescript: 'ts', gherkin: 'feature', postman: 'json', markdown: 'md', auto: '' }[body.language ?? 'auto'];
  const rel = body.filename ?? `Preview.${ext || guessExt(body.code)}`;
  const kind = classifyFile(rel, body.code);
  const suite = parseOne(rel, body.code, kind);
  if (!suite) return { kind, output_file: '', spec: `// sdet-architect: nothing to convert (classified as ${kind})`, tests_found: 0, todos: 0, coverage_pct: 0 };
  const plan = buildPlan([suite]);
  const baseUrl = body.base_url;
  const pageCode = plan.pages.map((p) => `// ---- ${p.file}\n${genPageClass(p, plan, baseUrl).code}`).join('\n');
  let spec = ''; let out = ''; let statuses: { total: number; todos: number }[] = []; let todos = 0;
  if (kind === 'postman-collection') { const r = genApiSpec(suite); spec = r.code; out = `tests/api/${rel.replace(/\.json$/, '')}.spec.ts`; statuses = r.tests; todos = r.todos.length; }
  else if (kind === 'cucumber-feature') { const r = genStepDefinitions(suite, [], plan, baseUrl); spec = r.code; out = `tests/steps/${rel.replace(/\.feature$/, '')}.steps.ts`; statuses = r.scenarios; todos = r.todos.length; }
  else if (kind === 'page-object' || kind === 'step-definitions') { spec = pageCode; out = plan.pages[0]?.file ?? ''; statuses = []; todos = 0; }
  else { const r = genSpec(suite, plan, baseUrl); spec = (pageCode ? pageCode + '\n' : '') + `// ---- ${specFileName(suite)}\n` + r.code; out = specFileName(suite); statuses = r.tests; todos = r.todos.length; }
  const total = statuses.reduce((n, s) => n + s.total, 0);
  const done = statuses.reduce((n, s) => n + s.total - s.todos, 0);
  return { kind, output_file: out, spec, tests_found: suite.tests.length, todos, coverage_pct: total ? Math.round((done / total) * 1000) / 10 : 0 };
}

function guessExt(code: string): string {
  if (/^\s*Feature:/m.test(code)) return 'feature';
  if (/getpostman/.test(code)) return 'json';
  if (/^\s*(?:package|import)\s+[\w.]+;|org\.openqa/.test(code)) return 'java';
  if (/OpenQA\.Selenium|\busing\s+\w+(\.\w+)*;/.test(code)) return 'cs';
  if (/^\s*(?:from|import)\s+selenium|^\s*def\s+\w+\(/m.test(code)) return 'py';
  if (/require\(|^\s*import .* from /m.test(code)) return 'js';
  if (/^#\s/m.test(code)) return 'md';
  return 'txt';
}

export function registerRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>('/agents/sdet-architect/runs/:id/migration', async (req, reply) => {
    const run = getDb().getRun(req.params.id);
    if (!run || run.agent !== 'sdet-architect') return reply.code(404).send({ error: 'run not found' });
    if (!run.output_json) return reply.code(409).send({ error: `run is ${run.status}` });
    const out = JSON.parse(run.output_json) as Output;
    return reply.type('text/markdown; charset=utf-8').send(out.migration_report);
  });
  app.post('/agents/sdet-architect/preview', async (req, reply) => {
    const parsed = PreviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input', issues: parsed.error.issues });
    return preview(parsed.data);
  });
}

export const sdetArchitect: AgentDefinition<Input, Output> = {
  name: 'sdet-architect',
  plate: 45,
  oneLiner: 'Inventories any legacy test estate (Selenium in any language, Cucumber, Postman, test plans) and rebuilds it as one standardised Playwright + Playwright MCP architecture, offline.',
  inputSchema: InputSchema,
  run,
  registerRoutes,
};

export default sdetArchitect;
