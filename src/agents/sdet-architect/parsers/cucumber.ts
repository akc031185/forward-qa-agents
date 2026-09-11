// Gherkin .feature parser plus step-definition linking. Pure functions on strings.
import type { Feature, GherkinStep, Scenario, StepDefinition, TestSuite } from '../model.js';
import { emptySuite } from '../model.js';

export function parseFeature(src: string, file: string): TestSuite {
  const suite = emptySuite(file, 'gherkin', 'cucumber-feature');
  const feature: Feature = { name: '', tags: [], background: [], scenarios: [] };
  let pendingTags: string[] = [];
  let current: Scenario | undefined;
  let inBackground = false;
  let inExamples = false;
  let lastKeyword = 'Given';
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const line = i + 1;
    if (!t || t.startsWith('#')) continue;
    let m: RegExpExecArray | null;
    if (t.startsWith('@')) { pendingTags.push(...t.split(/\s+/).filter((x) => x.startsWith('@'))); continue; }
    if ((m = /^Feature:\s*(.*)$/.exec(t))) { feature.name = m[1].trim(); feature.tags = pendingTags; pendingTags = []; continue; }
    if (/^Background:/.test(t)) { inBackground = true; inExamples = false; current = undefined; continue; }
    if ((m = /^(Scenario Outline|Scenario Template|Scenario|Example):\s*(.*)$/.exec(t))) {
      inBackground = false; inExamples = false;
      current = { name: m[2].trim(), line, steps: [], outline: /Outline|Template/.test(m[1]), tags: pendingTags, examples: undefined };
      pendingTags = [];
      feature.scenarios.push(current);
      continue;
    }
    if (/^(Examples|Scenarios):/.test(t)) { inExamples = true; continue; }
    if (inExamples && t.startsWith('|') && current) {
      const cells = t.slice(1, -1).split('|').map((c) => c.trim());
      if (!current.examples) current.examples = { headers: cells, rows: [] };
      else current.examples.rows.push(cells);
      continue;
    }
    if ((m = /^(Given|When|Then|And|But|\*)\s+(.*)$/.exec(t))) {
      const kw = m[1] === 'And' || m[1] === 'But' || m[1] === '*' ? lastKeyword : m[1];
      lastKeyword = kw;
      const step: GherkinStep = { keyword: kw, text: m[2].trim(), line };
      if (inBackground) feature.background.push(step);
      else if (current) current.steps.push(step);
      continue;
    }
    // docstrings / data tables inside steps are attached to the raw text of the previous step
    if ((t.startsWith('|') || t.startsWith('"""')) && current && current.steps.length) {
      current.steps[current.steps.length - 1].text += ' ' + t;
    }
  }
  suite.feature = feature;
  for (const sc of feature.scenarios) {
    const rows = sc.outline && sc.examples ? sc.examples.rows : [undefined];
    for (const row of rows) {
      const name = row ? `${sc.name} [${row.join(', ')}]` : sc.name;
      suite.tests.push({ name, line: sc.line, tags: sc.tags, steps: [...feature.background, ...sc.steps].map((s) => ({ kind: 'unknown' as const, raw: `${s.keyword} ${expand(s.text, sc.examples?.headers, row)}`, line: s.line })) });
    }
  }
  return suite;
}

function expand(text: string, headers?: string[], row?: string[]): string {
  if (!headers || !row) return text;
  return text.replace(/<([^>]+)>/g, (_, h: string) => { const i = headers.indexOf(h); return i >= 0 ? row[i] : `<${h}>`; });
}

export interface LinkedStep { step: GherkinStep; def?: StepDefinition; args: string[] }

/** Find the step definition matching a Gherkin step text (keyword-agnostic, like Cucumber). */
export function linkStep(step: GherkinStep, defs: StepDefinition[]): LinkedStep {
  for (const def of defs) {
    let re: RegExp;
    try { re = new RegExp(def.regex); } catch { continue; }
    const m = re.exec(step.text);
    if (m) return { step, def, args: m.slice(1) };
  }
  return { step, args: [] };
}

/** Distinct step texts across a feature (background + scenarios) with outline placeholders intact. */
export function uniqueSteps(feature: Feature): GherkinStep[] {
  const seen = new Set<string>();
  const out: GherkinStep[] = [];
  for (const s of [...feature.background, ...feature.scenarios.flatMap((sc) => sc.steps)]) {
    const key = `${s.keyword} ${s.text}`;
    if (!seen.has(key)) { seen.add(key); out.push(s); }
  }
  return out;
}
