// Selenium Python parser (pytest, unittest, pytest-bdd step definitions, page objects).
import type { Hook, Locator, PageMethod, Step, StepDefinition, TestCase, TestSuite } from '../model.js';
import { emptySuite } from '../model.js';
import { newScope, normalizeStrategy, parseBody, splitPyStatements, stripHashComment, unescapeLiteral, type Scope } from './common.js';
import { cucumberToRegex } from './cfamily.js';

export function isSeleniumPython(src: string): boolean {
  return /^\s*(?:from|import)\s+selenium\b/m.test(src) || /find_element(?:_by_\w+)?\(/.test(src);
}

export function classifyPython(src: string): TestSuite['kind'] {
  if (/^\s*@(?:given|when|then)\(/m.test(src) || /pytest_bdd|from behave/.test(src)) return 'step-definitions';
  if (/^\s*(?:async\s+)?def\s+test_?\w*\s*\(/m.test(src) || /unittest\.TestCase/.test(src)) return 'selenium-python';
  if (isSeleniumPython(src)) return 'page-object';
  return 'unknown';
}

interface PyFunc { name: string; params: string[]; decorators: string[]; body: { text: string; line: number }[]; line: number; indent: number; cls?: string }

function collectFunctions(src: string): { funcs: PyFunc[]; constants: Record<string, string>; classLocators: Map<string, Locator[]>; classNames: string[]; file: string } {
  const lines = src.split('\n');
  const funcs: PyFunc[] = [];
  const constants: Record<string, string> = {};
  const classLocators = new Map<string, Locator[]>();
  const classNames: string[] = [];
  let currentClass: { name: string; indent: number } | undefined;
  let decorators: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = stripHashComment(lines[i]);
    const t = raw.trim();
    if (!t) continue;
    const indent = raw.length - raw.trimStart().length;
    if (currentClass && indent <= currentClass.indent && !t.startsWith('@')) currentClass = undefined;
    let m: RegExpExecArray | null;
    if ((m = /^@(.+)$/.exec(t))) { decorators.push(m[1]); continue; }
    if ((m = /^class\s+([A-Za-z_]\w*)\s*(?:\(.*\))?\s*:/.exec(t))) { currentClass = { name: m[1], indent }; classNames.push(m[1]); classLocators.set(m[1], []); decorators = []; continue; }
    if ((m = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\((.*?)\)\s*(?:->\s*[^:]+)?:\s*$/.exec(t))) {
      const params = m[2].split(',').map((p) => p.trim().replace(/[:=].*$/, '').trim()).filter((p) => p && p !== 'self' && p !== 'cls');
      const body: { text: string; line: number }[] = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (!l.trim()) continue;
        const ind = l.length - l.trimStart().length;
        if (ind <= indent) break;
        body.push({ text: l, line: j + 1 });
      }
      funcs.push({ name: m[1], params, decorators, body, line: i + 1, indent, cls: currentClass?.name });
      decorators = [];
      i = j - 1;
      continue;
    }
    decorators = [];
    if (!currentClass && (m = /^([A-Za-z_]\w*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*$/.exec(t))) { constants[m[1]] = unescapeLiteral(m[2]); continue; }
    if (currentClass && (m = /^([A-Za-z_]\w*)\s*=\s*\(\s*By\.(\w+)\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,?\s*\)\s*$/.exec(t))) {
      const strat = normalizeStrategy(m[2]);
      if (strat) classLocators.get(currentClass.name)!.push({ strategy: strat, value: unescapeLiteral(m[3]), source: { file: '', line: i + 1 }, alias: m[1] });
    }
  }
  return { funcs, constants, classLocators, classNames, file: '' };
}

const HOOK_NAMES: Record<string, Hook['kind']> = {
  setUp: 'beforeEach', setup_method: 'beforeEach', setup: 'beforeEach', setUpClass: 'beforeAll', setup_class: 'beforeAll', setup_module: 'beforeAll',
  tearDown: 'afterEach', teardown_method: 'afterEach', teardown: 'afterEach', tearDownClass: 'afterAll', teardown_class: 'afterAll', teardown_module: 'afterAll',
};

export function parseSeleniumPython(src: string, file: string, kind: TestSuite['kind'] = classifyPython(src)): TestSuite {
  const suite = emptySuite(file, 'python', kind);
  const { funcs, constants, classLocators, classNames } = collectFunctions(src);
  suite.constants = constants;
  for (const locs of classLocators.values()) for (const l of locs) { l.source.file = file; suite.locators.push(l); }
  const pageMethods = new Map<string, PageMethod[]>();
  const stepDefs: StepDefinition[] = [];
  for (const f of funcs) {
    const byVars = new Map<string, Locator>();
    for (const l of classLocators.get(f.cls ?? '') ?? []) byVars.set(l.alias!, l);
    const scope: Scope = newScope({ constants, byVars, params: new Set(f.params) });
    // pytest fixtures: only the part before `yield` is setup
    const yieldIdx = f.body.findIndex((l) => /^\s*yield\b/.test(l.text));
    const setupBody = yieldIdx >= 0 ? f.body.slice(0, yieldIdx) : f.body;
    const { steps, urls } = parseBody(splitPyStatements(setupBody), 'python', scope, file);
    suite.urls.push(...urls);
    for (const s of steps) if (s.locator && !suite.locators.includes(s.locator)) suite.locators.push(s.locator);
    suite.className ??= f.cls;
    const stepDec = f.decorators.map((d) => /^(given|when|then|step)\((.*)\)$/i.exec(d)).find(Boolean);
    if (stepDec) {
      const inner = stepDec[2].trim();
      const litm = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(inner);
      const pattern = litm ? unescapeLiteral(litm[1]) : inner;
      stepDefs.push({ keyword: cap(stepDec[1]), pattern, regex: cucumberToRegex(pattern), params: f.params, steps, line: f.line, source: file });
    } else if (/^test/i.test(f.name) && !/fixture/.test(f.decorators.join(' '))) {
      const t: TestCase = { name: f.name, line: f.line, steps };
      if (f.decorators.some((d) => /skip/.test(d))) t.tags = ['skip'];
      suite.tests.push(t);
    } else if (HOOK_NAMES[f.name] || f.decorators.some((d) => /^pytest\.fixture|^fixture/.test(d))) {
      if (steps.length) suite.hooks.push({ kind: HOOK_NAMES[f.name] ?? 'beforeEach', name: f.name, steps, line: f.line });
    } else if (f.cls && f.name !== '__init__') {
      if (!pageMethods.has(f.cls)) pageMethods.set(f.cls, []);
      pageMethods.get(f.cls)!.push({ name: f.name, params: f.params, steps, line: f.line });
    }
  }
  if (stepDefs.length) suite.stepDefinitions = stepDefs;
  if (kind === 'page-object') {
    for (const cls of classNames) suite.pageObjects.push({ name: cls, source: file, locators: classLocators.get(cls) ?? [], methods: pageMethods.get(cls) ?? [] });
  }
  return suite;
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
