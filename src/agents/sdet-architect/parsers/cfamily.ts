// Class-structure parser for brace languages (Java, C#). Finds classes, fields, annotated methods
// and delegates statement parsing to the shared engine.
import type { Hook, Locator, PageMethod, PageObject, Step, StepDefinition, TestCase, TestSuite } from '../model.js';
import { emptySuite } from '../model.js';
import {
  type Dialect, type Scope, lineOf, matchBrace, newScope, normalizeStrategy, parseBody, splitCStatements, stripCComments, unescapeLiteral,
} from './common.js';

export interface MethodInfo {
  name: string;
  params: string[];
  annotations: string[];
  body: string;
  bodyLine: number;
  line: number;
  isPublic: boolean;
}

export interface ClassInfo {
  name: string;
  line: number;
  fields: { elements: Map<string, Locator>; byVars: Map<string, Locator>; constants: Record<string, string>; objects: Map<string, string> };
  methods: MethodInfo[];
  fieldLocators: Locator[];
}

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'else', 'try', 'do', 'foreach', 'using', 'lock']);

const METHOD_RE = /^[ \t]*(?:(?:public|private|protected|internal|static|final|async|override|virtual|synchronized|default)\s+)*([\w<>\[\],.?]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:throws\s+[\w., ]+)?\s*(\{)?\s*$/;

/** Parse all classes of a Java/C# file. */
export function parseClasses(src: string, dialect: Dialect, file: string): ClassInfo[] {
  const clean = stripCComments(src);
  const classes: ClassInfo[] = [];
  const classRe = /^[ \t]*(?:(?:public|private|protected|internal|static|final|abstract|sealed|partial)\s+)*class\s+([A-Za-z_]\w*)[^{]*\{/gm;
  let cm: RegExpExecArray | null;
  while ((cm = classRe.exec(clean))) {
    const open = clean.indexOf('{', cm.index);
    const close = matchBrace(clean, open);
    if (close === -1) continue;
    const bodyStart = open + 1;
    const body = clean.slice(bodyStart, close);
    const bodyLine = lineOf(clean, bodyStart);
    classes.push(parseClassBody(cm[1], lineOf(clean, cm.index), body, bodyLine, dialect, file));
    // nested classes are rare in test code; do not descend
    classRe.lastIndex = close;
  }
  return classes;
}

function parseClassBody(name: string, line: number, body: string, bodyLine: number, dialect: Dialect, file: string): ClassInfo {
  const info: ClassInfo = { name, line, fields: { elements: new Map(), byVars: new Map(), constants: {}, objects: new Map() }, methods: [], fieldLocators: [] };
  const lines = body.split('\n');
  let pendingAnnotations: string[] = [];
  let pendingFindBy: Locator | undefined;
  let i = 0;
  // Track regions consumed by method bodies so field scanning skips them.
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    const absLine = bodyLine + i;
    if (!t) { i++; continue; }

    // annotations / attributes
    const ann = dialect === 'java' ? /^@([A-Za-z_]\w*)(?:\((.*)\))?\s*$/.exec(t) : /^\[([A-Za-z_]\w*)(?:\((.*)\))?\]\s*$/.exec(t);
    if (ann) {
      pendingAnnotations.push(ann[1] + (ann[2] !== undefined ? `(${ann[2]})` : ''));
      const fb = parseFindBy(ann[1], ann[2] ?? '', file, absLine);
      if (fb) pendingFindBy = fb;
      i++; continue;
    }
    // Java: annotation on the same line as the field: @FindBy(id="x") WebElement foo;
    const inlineFb = /^@(FindBy)\((.*?)\)\s+(?:private|public|protected)?\s*(?:I?WebElement|By)\s+([A-Za-z_]\w*)\s*;/.exec(t);
    if (inlineFb) {
      const loc = parseFindBy('FindBy', inlineFb[2], file, absLine);
      if (loc) { loc.alias = inlineFb[3]; info.fields.elements.set(inlineFb[3], loc); info.fieldLocators.push(loc); }
      i++; continue;
    }

    const mm = METHOD_RE.exec(raw);
    if (mm && !KEYWORDS.has(mm[2]) && !KEYWORDS.has(mm[1]) && mm[2] !== name) {
      // locate the opening brace: same line or the next non-empty line
      let j = i;
      if (!mm[4]) { j = i + 1; while (j < lines.length && !lines[j].trim()) j++; if (j >= lines.length || !lines[j].trim().startsWith('{')) { pendingAnnotations = []; i++; continue; } }
      const offset = lines.slice(0, j).join('\n').length + (j > 0 ? 1 : 0) + lines[j].indexOf('{');
      const close = matchBrace(body, offset);
      if (close === -1) { pendingAnnotations = []; i++; continue; }
      const mbody = body.slice(offset + 1, close);
      const params = mm[3].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.replace(/^.*\s/, '').replace(/^[@\w]+\s+/, ''));
      info.methods.push({ name: mm[2], params, annotations: pendingAnnotations, body: mbody, bodyLine: lineOf(body, offset + 1) + bodyLine - 1, line: absLine, isPublic: /\bpublic\b/.test(raw) || dialect === 'java' && !/\b(private|protected)\b/.test(raw) });
      pendingAnnotations = []; pendingFindBy = undefined;
      const endLine = lineOf(body, close);
      i = endLine; // endLine is 1-based line of `}` -> index endLine-1, then +1
      continue;
    }
    if (mm && mm[2] === name) {
      // constructor: still useful for JS-style `this.x = By...` bindings, and driver.get in ctor
      const open = raw.indexOf('{') >= 0 ? lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0) + raw.indexOf('{') : -1;
      if (open >= 0) { const close = matchBrace(body, open); if (close !== -1) { i = lineOf(body, close); pendingAnnotations = []; continue; } }
    }

    // fields
    let fm: RegExpExecArray | null;
    if ((fm = /^(?:(?:private|public|protected|internal|static|final|readonly)\s+)*(?:I?WebElement)\s+([A-Za-z_]\w*)\s*;/.exec(t))) {
      if (pendingFindBy) { pendingFindBy.alias = fm[1]; info.fields.elements.set(fm[1], pendingFindBy); info.fieldLocators.push(pendingFindBy); }
      pendingFindBy = undefined; pendingAnnotations = []; i++; continue;
    }
    if ((fm = /^(?:(?:private|public|protected|internal|static|final|readonly)\s+)*By\s+([A-Za-z_]\w*)\s*=\s*By\.(\w+)\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)\s*;/.exec(t))) {
      const strat = normalizeStrategy(fm[2]);
      if (strat) { const loc: Locator = { strategy: strat, value: unescapeLiteral(fm[3]), source: { file, line: absLine }, alias: fm[1] }; info.fields.byVars.set(fm[1], loc); info.fieldLocators.push(loc); }
      pendingAnnotations = []; i++; continue;
    }
    if ((fm = /^(?:(?:private|public|protected|internal|static|final|readonly|const)\s+)*(?:String|string)\s+([A-Za-z_]\w*)\s*=\s*("(?:[^"\\]|\\.)*")\s*;/.exec(t))) {
      info.fields.constants[fm[1]] = unescapeLiteral(fm[2]);
      pendingAnnotations = []; i++; continue;
    }
    if ((fm = /^(?:(?:private|public|protected|internal|static|final|readonly)\s+)*([A-Z]\w*)\s+([A-Za-z_]\w*)\s*(?:=\s*new\s+\1\s*\(.*\))?\s*;/.exec(t))) {
      if (!/^(?:I?WebDriver|WebDriverWait|Actions|String|Duration|TimeSpan)$/.test(fm[1])) info.fields.objects.set(fm[2], fm[1]);
      pendingAnnotations = []; i++; continue;
    }
    pendingAnnotations = [];
    i++;
  }
  return info;
}

function parseFindBy(annotation: string, args: string, file: string, line: number): Locator | undefined {
  if (!/^(FindBy|FindsBy|FindBys?)$/.test(annotation)) return undefined;
  let m: RegExpExecArray | null;
  if ((m = /^\s*(\w+)\s*=\s*("(?:[^"\\]|\\.)*")\s*$/.exec(args))) {
    const strat = normalizeStrategy(m[1]); if (!strat) return undefined;
    return { strategy: strat, value: unescapeLiteral(m[2]), source: { file, line } };
  }
  const how = /(?:how|How)\s*=\s*How\.(\w+)/.exec(args); const using = /(?:using|Using)\s*=\s*("(?:[^"\\]|\\.)*")/.exec(args);
  if (how && using) {
    const strat = normalizeStrategy(how[1].replace(/_/g, '')) ?? normalizeStrategy(how[1]);
    if (strat) return { strategy: strat, value: unescapeLiteral(using[1]), source: { file, line } };
  }
  return undefined;
}

const TEST_ANN = /^(Test|ParameterizedTest|RepeatedTest|TestMethod|Fact|Theory|TestCase|DataTestMethod)\b/;
const HOOK_ANN: Record<string, Hook['kind']> = {
  BeforeMethod: 'beforeEach', BeforeEach: 'beforeEach', Before: 'beforeEach', SetUp: 'beforeEach', TestInitialize: 'beforeEach',
  AfterMethod: 'afterEach', AfterEach: 'afterEach', After: 'afterEach', TearDown: 'afterEach', TestCleanup: 'afterEach',
  BeforeClass: 'beforeAll', BeforeAll: 'beforeAll', BeforeSuite: 'beforeAll', OneTimeSetUp: 'beforeAll', ClassInitialize: 'beforeAll',
  AfterClass: 'afterAll', AfterAll: 'afterAll', AfterSuite: 'afterAll', OneTimeTearDown: 'afterAll', ClassCleanup: 'afterAll',
};
const STEP_ANN = /^(Given|When|Then|And|But)\((.*)\)$/;

export function hasTestAnnotations(src: string, dialect: Dialect): boolean {
  return dialect === 'java' ? /^\s*@(Test|ParameterizedTest|RepeatedTest)\b/m.test(src) : /^\s*\[(Test|TestMethod|Fact|Theory|TestCase)\b/m.test(src);
}
export function hasStepAnnotations(src: string, dialect: Dialect): boolean {
  return dialect === 'java' ? /^\s*@(Given|When|Then|And|But)\(/m.test(src) : /^\s*\[(Given|When|Then|And|But)\(/m.test(src);
}

function classScope(c: ClassInfo, params: string[] = []): Scope {
  return newScope({ elements: c.fields.elements, byVars: c.fields.byVars, constants: c.fields.constants, objects: c.fields.objects, params: new Set(params) });
}

function methodSteps(m: MethodInfo, c: ClassInfo, dialect: Dialect, file: string): { steps: Step[]; urls: string[] } {
  const scope = classScope(c, m.params);
  const stmts = splitCStatements(m.body, m.bodyLine);
  return parseBody(stmts, dialect, scope, file);
}

/** Build a TestSuite for a Java/C# source file. `kind` decides test-class vs page-object vs step-definitions. */
export function buildSuite(src: string, dialect: Dialect, file: string, kind: TestSuite['kind']): TestSuite {
  const suite = emptySuite(file, dialect, kind);
  const classes = parseClasses(src, dialect, file);
  for (const c of classes) {
    suite.className ??= c.name;
    Object.assign(suite.constants, c.fields.constants);
    suite.locators.push(...c.fieldLocators);
    const stepDefs: StepDefinition[] = [];
    const pageMethods: PageMethod[] = [];
    for (const m of c.methods) {
      const { steps, urls } = methodSteps(m, c, dialect, file);
      suite.urls.push(...urls);
      for (const s of steps) if (s.locator && !suite.locators.includes(s.locator)) suite.locators.push(s.locator);
      const testAnn = m.annotations.find((a) => TEST_ANN.test(a));
      const hookAnn = m.annotations.map((a) => a.replace(/\(.*$/, '')).find((a) => HOOK_ANN[a]);
      const stepAnn = m.annotations.map((a) => STEP_ANN.exec(a)).find(Boolean);
      if (testAnn) {
        const t: TestCase = { name: m.name, line: m.line, steps };
        suite.tests.push(t);
      } else if (hookAnn) {
        suite.hooks.push({ kind: HOOK_ANN[hookAnn], name: m.name, steps, line: m.line });
      } else if (stepAnn) {
        const patternLit = stepAnn[2].trim();
        const pattern = /^["']/.test(patternLit) ? unescapeLiteral(patternLit.replace(/^@/, '')) : patternLit;
        stepDefs.push({ keyword: stepAnn[1], pattern, regex: cucumberToRegex(pattern), params: m.params, steps, line: m.line, source: file });
      } else if (kind === 'page-object' || (m.isPublic && steps.length > 0)) {
        pageMethods.push({ name: m.name, params: m.params, steps, line: m.line });
      }
    }
    if (stepDefs.length) suite.stepDefinitions = [...(suite.stepDefinitions ?? []), ...stepDefs];
    if (kind === 'page-object') suite.pageObjects.push({ name: c.name, source: file, locators: c.fieldLocators, methods: pageMethods });
  }
  return suite;
}

/** Convert a Cucumber expression (or anchored regex) into a JS regex source. */
export function cucumberToRegex(pattern: string): string {
  if (/^\^.*\$$/.test(pattern) || /[\\()[\]|]/.test(pattern) && !/\{(string|int|word|float)\}/.test(pattern)) {
    return pattern; // already a regex
  }
  let out = '';
  for (const part of pattern.split(/(\{string\}|\{int\}|\{word\}|\{float\}|\{\}|\([^)]*\))/g)) {
    if (part === '{string}') out += '"([^"]*)"';
    else if (part === '{int}') out += '(-?\\d+)';
    else if (part === '{float}') out += '(-?\\d+(?:\\.\\d+)?)';
    else if (part === '{word}') out += '(\\w+)';
    else if (part === '{}') out += '(.*)';
    else if (/^\([^)]*\)$/.test(part)) out += `(?:${part.slice(1, -1)})?`;
    else out += part.replace(/[.*+?^${}|[\]\\]/g, '\\$&').replace(/\//g, '/');
  }
  return `^${out}$`;
}
