// Turns parsed suites into a concrete file plan: which page classes exist, what fields they own,
// which fixture name each spec uses. Pure.
import type { Locator, PageMethod, TestSuite } from '../model.js';
import { chooseTestIdAttribute, fieldNameFor, locatorKey, lowerFirst, standardize, type StdLocator, type StdOptions, upperFirst } from '../locators.js';

export interface PlannedField { name: string; locator: Locator; std: StdLocator }
export interface PlannedPage {
  className: string;
  /** e.g. src/pages/Login.page.ts */
  file: string;
  fixture: string;
  fields: PlannedField[];
  methods: PageMethod[];
  sourceFile: string;
  /** true when synthesised from a test class's inline locators */
  synthetic: boolean;
}

export interface Plan {
  pages: PlannedPage[];
  /** suite.source -> synthetic page for its inline locators */
  pageForSuite: Map<string, PlannedPage>;
  /** page-object class name -> planned page */
  pageByClass: Map<string, PlannedPage>;
  stdOptions: StdOptions;
  stdCache: Map<string, StdLocator>;
}

export function isUiSuite(s: TestSuite): boolean {
  return ['selenium-java', 'selenium-python', 'selenium-csharp', 'selenium-js', 'cypress'].includes(s.kind);
}

export function buildPlan(suites: TestSuite[]): Plan {
  const all = suites.flatMap((s) => s.locators);
  const stdOptions: StdOptions = { testIdAttribute: chooseTestIdAttribute(all) };
  const stdCache = new Map<string, StdLocator>();
  const std = (l: Locator) => { const k = locatorKey(l); let v = stdCache.get(k); if (!v) { v = standardize(l, stdOptions); stdCache.set(k, v); } return v; };
  const pages: PlannedPage[] = [];
  const pageByClass = new Map<string, PlannedPage>();
  const pageForSuite = new Map<string, PlannedPage>();
  const usedClassNames = new Set<string>();
  const usedFiles = new Set<string>();

  const uniqueClass = (base: string) => { let n = base; let i = 2; while (usedClassNames.has(n)) n = `${base}${i++}`; usedClassNames.add(n); return n; };
  const fileFor = (className: string) => {
    let base = className.replace(/Page$/, '') || className;
    let f = `src/pages/${base}.page.ts`; let i = 2;
    while (usedFiles.has(f)) f = `src/pages/${base}${i++}.page.ts`;
    usedFiles.add(f); return f;
  };
  const makeFields = (locators: Locator[]): PlannedField[] => {
    const fields: PlannedField[] = [];
    const seen = new Map<string, PlannedField>();
    const names = new Set<string>();
    for (const l of locators) {
      const k = locatorKey(l);
      if (seen.has(k)) continue;
      const s = std(l);
      let name = fieldNameFor(l, s);
      if (/^(page|constructor|goto)$/.test(name)) name = `${name}Element`;
      let n = name; let i = 2; while (names.has(n)) n = `${name}${i++}`;
      names.add(n);
      const f = { name: n, locator: l, std: s };
      seen.set(k, f); fields.push(f);
    }
    return fields;
  };

  // 1. detected page objects
  for (const s of suites) for (const po of s.pageObjects) {
    const className = uniqueClass(po.name);
    // include locators used inline inside page methods too
    const inline = po.methods.flatMap((m) => m.steps.map((st) => st.locator).filter((x): x is Locator => !!x));
    const p: PlannedPage = { className, file: fileFor(className), fixture: lowerFirst(className), fields: makeFields([...po.locators, ...inline]), methods: po.methods, sourceFile: s.source, synthetic: false };
    pages.push(p); pageByClass.set(po.name, p);
  }
  // 2. one synthetic page per UI test suite / step-definition file that has inline locators
  for (const s of suites) {
    if (!(isUiSuite(s) || s.kind === 'step-definitions')) continue;
    const inline = s.locators.filter((l) => !l.alias);
    if (!inline.length) continue;
    const raw = (s.className ?? s.source.replace(/^.*\//, '').replace(/\..*$/, '')).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').map(upperFirst).join('');
    const base = raw.replace(/^Test(?=[A-Z])/, '').replace(/(Tests?|Specs?|IT|Steps?|StepDefs?|StepDefinitions|Page)$/, '');
    const preferred = `${base || 'Legacy'}Page`;
    const className = usedClassNames.has(preferred) ? uniqueClass(`${raw.replace(/Page$/, '')}Page`) : uniqueClass(preferred);
    const p: PlannedPage = { className, file: fileFor(className), fixture: lowerFirst(className), fields: makeFields(inline), methods: [], sourceFile: s.source, synthetic: true };
    pages.push(p); pageForSuite.set(s.source, p);
  }
  return { pages, pageForSuite, pageByClass, stdOptions, stdCache };
}

export function stdOf(plan: Plan, l: Locator): StdLocator {
  const k = locatorKey(l);
  let v = plan.stdCache.get(k);
  if (!v) { v = standardize(l, plan.stdOptions); plan.stdCache.set(k, v); }
  return v;
}

/** Field name on `page` for a locator, if that page owns it. */
export function fieldOn(page: PlannedPage | undefined, l: Locator): string | undefined {
  if (!page) return undefined;
  const k = locatorKey(l);
  return page.fields.find((f) => locatorKey(f.locator) === k)?.name;
}
