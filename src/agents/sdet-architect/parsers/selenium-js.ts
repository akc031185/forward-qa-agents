// selenium-webdriver / WebdriverIO / Cypress parser (mocha, jest and cypress test structure).
import type { Hook, Locator, PageMethod, TestCase, TestSuite } from '../model.js';
import { emptySuite } from '../model.js';
import { lineOf, matchBrace, newScope, normalizeStrategy, parseBody, splitCStatements, stripCComments, unescapeLiteral } from './common.js';

export function classifyJs(src: string): TestSuite['kind'] {
  if (/\bcy\.(visit|get|contains|request)\(/.test(src)) return 'cypress';
  const selenium = /selenium-webdriver|\bBy\.(id|name|css|xpath|className|linkText|partialLinkText|tagName)\(|\bbrowser\.(url|pause|\$)\(|(?<![\w.])\$\(/.test(src);
  if (!selenium) return 'unknown';
  if (/\b(?:it|test|specify)(?:\.(?:only|skip))?\s*\(/.test(src)) return 'selenium-js';
  if (/\bclass\s+\w+/.test(src)) return 'page-object';
  return 'selenium-js';
}

const HOOK_NAMES: Record<string, Hook['kind']> = { before: 'beforeAll', beforeAll: 'beforeAll', beforeEach: 'beforeEach', after: 'afterAll', afterAll: 'afterAll', afterEach: 'afterEach' };
const STR = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + '`[^`]*`' + `)`;
const CALL_RE = new RegExp(String.raw`\b(it|test|specify|before|beforeEach|after|afterEach|beforeAll|afterAll)(?:\.(only|skip))?\s*\(\s*(?:${STR}\s*,\s*)?(?:async\s*)?(?:function\s*\w*\s*\([^)]*\)|\([^)]*\)\s*=>|\w+\s*=>)\s*\{`, 'g');

export function parseSeleniumJs(src: string, file: string, kind: TestSuite['kind'] = classifyJs(src)): TestSuite {
  const suite = emptySuite(file, /\.tsx?$/.test(file) ? 'typescript' : 'javascript', kind);
  const clean = stripCComments(src);
  const constants: Record<string, string> = {};
  for (const m of clean.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*;?\s*$/gm)) constants[m[1]] = unescapeLiteral(m[2]);
  suite.constants = constants;
  const dm = /\b(?:describe|context|suite)\s*\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(clean);
  if (dm) suite.className = unescapeLiteral(dm[1]);

  let m: RegExpExecArray | null;
  const re = new RegExp(CALL_RE.source, 'g');
  while ((m = re.exec(clean))) {
    const open = clean.indexOf('{', m.index + m[0].length - 1);
    const close = matchBrace(clean, open);
    if (close === -1) continue;
    const body = clean.slice(open + 1, close);
    const line = lineOf(clean, m.index);
    const scope = newScope({ constants });
    const { steps, urls } = parseBody(splitCStatements(body, lineOf(clean, open + 1)), 'javascript', scope, file);
    suite.urls.push(...urls);
    for (const s of steps) if (s.locator && !suite.locators.includes(s.locator)) suite.locators.push(s.locator);
    const fn = m[1];
    if (HOOK_NAMES[fn]) suite.hooks.push({ kind: HOOK_NAMES[fn], name: fn, steps, line });
    else {
      const t: TestCase = { name: m[3] ? unescapeLiteral(m[3]) : `${fn}@${line}`, line, steps };
      if (m[2] === 'skip') t.tags = ['skip'];
      suite.tests.push(t);
    }
    re.lastIndex = open + 1; // allow nested describes
  }
  if (kind === 'page-object') suite.pageObjects.push(...parseJsPageObjects(clean, file, suite));
  return suite;
}

function parseJsPageObjects(clean: string, file: string, suite: TestSuite): { name: string; source: string; locators: Locator[]; methods: PageMethod[] }[] {
  const out: { name: string; source: string; locators: Locator[]; methods: PageMethod[] }[] = [];
  const classRe = /\bclass\s+([A-Za-z_]\w*)[^{]*\{/g;
  let cm: RegExpExecArray | null;
  while ((cm = classRe.exec(clean))) {
    const open = clean.indexOf('{', cm.index);
    const close = matchBrace(clean, open);
    if (close === -1) continue;
    const body = clean.slice(open + 1, close);
    const locators: Locator[] = [];
    const byVars = new Map<string, Locator>();
    const elements = new Map<string, Locator>();
    for (const fm of body.matchAll(/this\.([A-Za-z_]\w*)\s*=\s*By\.(\w+)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g)) {
      const strat = normalizeStrategy(fm[2]); if (!strat) continue;
      const loc: Locator = { strategy: strat, value: unescapeLiteral(fm[3]), source: { file, line: lineOf(clean, open + 1 + fm.index!) }, alias: fm[1] };
      locators.push(loc); byVars.set(fm[1], loc);
    }
    for (const gm of body.matchAll(/get\s+([A-Za-z_]\w*)\s*\(\)\s*\{\s*return\s+\$\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)/g)) {
      const loc: Locator = { strategy: 'css', value: unescapeLiteral(gm[2]), source: { file, line: lineOf(clean, open + 1 + gm.index!) }, alias: gm[1] };
      locators.push(loc); elements.set(gm[1], loc);
    }
    const methods: PageMethod[] = [];
    const mre = /^[ \t]*(?:async\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm;
    let mm: RegExpExecArray | null;
    while ((mm = mre.exec(body))) {
      if (/^(constructor|if|for|while|switch|catch|get|set)$/.test(mm[1])) continue;
      const mo = body.indexOf('{', mm.index + mm[0].length - 1);
      const mc = matchBrace(body, mo);
      if (mc === -1) continue;
      const params = mm[2].split(',').map((p) => p.trim()).filter(Boolean);
      const scope = newScope({ constants: suite.constants, byVars, elements, params: new Set(params) });
      const { steps } = parseBody(splitCStatements(body.slice(mo + 1, mc), lineOf(clean, open + 1 + mo + 1)), 'javascript', scope, file);
      methods.push({ name: mm[1], params, steps, line: lineOf(clean, open + 1 + mm.index) });
      mre.lastIndex = mc;
    }
    suite.locators.push(...locators);
    out.push({ name: cm[1], source: file, locators, methods });
  }
  return out;
}

