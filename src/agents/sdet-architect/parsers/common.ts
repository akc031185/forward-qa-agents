// Shared, pure, regex/line-based statement engine used by every Selenium-dialect parser.
// Strategy: tokenise string literals -> tokenise By(...) locators -> substitute known variables
// -> tokenise element wrappers (findElement) -> classify the normalised statement into a Step.
import type { Assertion, AssertionType, Locator, LocatorStrategy, Step, StepKind } from '../model.js';

export type Dialect = 'java' | 'csharp' | 'javascript' | 'python';

/** Typed runtime values that Selenium code reads from the browser (el.getText(), driver.getTitle(), ...). */
export interface TypedValue {
  type: 'text' | 'title' | 'url' | 'attribute' | 'value' | 'visible' | 'enabled' | 'count' | 'pageSource' | 'selected';
  locator?: Locator;
  attribute?: string;
}

/** Lexical scope used while parsing one method body. Class-level bindings are copied in at creation. */
export interface Scope {
  elements: Map<string, Locator>;    // WebElement variables / @FindBy fields
  byVars: Map<string, Locator>;      // By variables
  values: Map<string, TypedValue>;   // String variables holding text/title/url...
  objects: Map<string, string>;      // variable -> page object class name
  params: Set<string>;               // method parameters
  constants: Record<string, string>; // class/module level string constants
}

export function newScope(init?: Partial<Scope>): Scope {
  return {
    elements: new Map(init?.elements ?? []),
    byVars: new Map(init?.byVars ?? []),
    values: new Map(init?.values ?? []),
    objects: new Map(init?.objects ?? []),
    params: new Set(init?.params ?? []),
    constants: { ...(init?.constants ?? {}) },
  };
}

export interface Statement { text: string; line: number }

// ---------------------------------------------------------------- text utilities

const STRING_RE = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

export function unescapeLiteral(lit: string): string {
  const body = lit.slice(1, -1);
  return body.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
}

/** Remove // and /* *\/ comments outside string literals (C-family). */
export function stripCComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = findStringEnd(src, i);
      out += src.slice(i, end);
      i = end;
    } else if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      // preserve newlines so line numbers stay stable
      out += src.slice(i, stop).replace(/[^\n]/g, '');
      i = stop;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function findStringEnd(src: string, start: number): number {
  const q = src[start];
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    if (src[i] === '\n' && q !== '`') return i; // unterminated, bail at EOL
    i++;
  }
  return src.length;
}

/** Remove # comments outside string literals (Python). */
export function stripHashComment(line: string): string {
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === '#') return line.slice(0, i);
  }
  return line;
}

/** Index of the `}` matching the `{` at `open` (string-aware). Returns -1 when unbalanced. */
export function matchBrace(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') { i = findStringEnd(src, i) - 1; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

export function lineOf(src: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

function parenDelta(text: string): number {
  let d = 0;
  const noStr = text.replace(STRING_RE, '""');
  for (const ch of noStr) {
    if (ch === '(' || ch === '[') d++;
    else if (ch === ')' || ch === ']') d--;
  }
  return d;
}

/** Split a C-family block body (already comment-stripped) into `;`-terminated statements. */
export function splitCStatements(body: string, firstLine: number): Statement[] {
  const out: Statement[] = [];
  const lines = body.split('\n');
  let buf = '';
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) continue;
    if (start === -1) start = firstLine + i;
    buf += (buf ? ' ' : '') + t;
    depth += parenDelta(t);
    const closes = depth <= 0 && (/[;{}]$/.test(t) || /^\}/.test(t));
    if (closes) {
      const stmt = buf.replace(/^\{+|\}+$/g, '').replace(/[;{]+$/g, '').trim();
      // flatten nested block openers like "if (x) {" or "try {" -> keep the condition as noise
      if (stmt && !/^(?:\}|else|try|finally|catch\b|\{)$/.test(stmt)) out.push({ text: stmt, line: start });
      buf = ''; start = -1; depth = 0;
    }
  }
  if (buf.trim()) out.push({ text: buf.replace(/[;{}]+$/g, '').trim(), line: start });
  return out;
}

/** Split Python body lines into logical statements (handles open parens). */
export function splitPyStatements(lines: { text: string; line: number }[]): Statement[] {
  const out: Statement[] = [];
  let buf = '';
  let start = -1;
  let depth = 0;
  for (const { text, line } of lines) {
    const t = stripHashComment(text).trim();
    if (!t) continue;
    if (start === -1) start = line;
    buf += (buf ? ' ' : '') + t.replace(/\\$/, '');
    depth += parenDelta(t);
    if (depth <= 0 && !/\\$/.test(t)) {
      out.push({ text: buf.trim(), line: start });
      buf = ''; start = -1; depth = 0;
    }
  }
  if (buf.trim()) out.push({ text: buf.trim(), line: start });
  return out;
}

/** Split `a, b(c, d), e` on top-level commas. Strings are assumed to be tokenised already. */
export function splitTopLevel(s: string, sep = ','): string[] {
  const parts: string[] = [];
  let depth = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === sep && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// ---------------------------------------------------------------- locator helpers

const STRATEGY_MAP: Record<string, LocatorStrategy> = {
  id: 'id', name: 'name', css: 'css', cssselector: 'css', css_selector: 'css', xpath: 'xpath',
  classname: 'className', class_name: 'className', linktext: 'linkText', link_text: 'linkText',
  partiallinktext: 'partialLinkText', partial_link_text: 'partialLinkText', tagname: 'tagName', tag_name: 'tagName',
};

export function normalizeStrategy(raw: string): LocatorStrategy | undefined {
  return STRATEGY_MAP[raw.toLowerCase()];
}

export const KEY_MAP: Record<string, string> = {
  ENTER: 'Enter', RETURN: 'Enter', TAB: 'Tab', ESCAPE: 'Escape', ESC: 'Escape', SPACE: 'Space',
  BACK_SPACE: 'Backspace', BACKSPACE: 'Backspace', DELETE: 'Delete', ARROW_DOWN: 'ArrowDown', DOWN: 'ArrowDown',
  ARROW_UP: 'ArrowUp', UP: 'ArrowUp', ARROW_LEFT: 'ArrowLeft', LEFT: 'ArrowLeft', ARROW_RIGHT: 'ArrowRight', RIGHT: 'ArrowRight',
  HOME: 'Home', END: 'End', PAGE_DOWN: 'PageDown', PAGE_UP: 'PageUp', SHIFT: 'Shift', CONTROL: 'Control', ALT: 'Alt',
};
export function mapKey(name: string): string {
  const up = name.toUpperCase();
  if (KEY_MAP[up]) return KEY_MAP[up];
  return name.toLowerCase().replace(/(^|_)(\w)/g, (_, __, c: string) => c.toUpperCase());
}

// ---------------------------------------------------------------- normalisation

interface Normalized {
  n: string;
  strs: string[];
  locs: Locator[];
  vals: TypedValue[];
}

const DRIVER = String.raw`(?:\w*[dD]river|browser|cy|wd|d|page)`;

/** Normalise one statement into a token string. Pure; scope is read-only here. */
export function normalize(text: string, dialect: Dialect, scope: Scope, file: string, line: number): Normalized {
  const strs: string[] = [];
  const locs: Locator[] = [];
  const vals: TypedValue[] = [];
  const S = (i: number) => `«S${i}»`;
  const L = (loc: Locator) => { locs.push(loc); return `«L${locs.length - 1}»`; };
  const E = (loc: Locator) => { locs.push(loc); return `«E${locs.length - 1}»`; };
  const ES = (loc: Locator) => { locs.push(loc); return `«ES${locs.length - 1}»`; };
  const V = (v: TypedValue) => { vals.push(v); return `«V${vals.length - 1}»`; };
  const lit = (tok: string) => { const m = /«S(\d+)»/.exec(tok); return m ? strs[Number(m[1])] : undefined; };
  const mk = (strategy: LocatorStrategy, value: string): Locator => ({ strategy, value, source: { file, line } });

  let n = text.trim().replace(/;+$/, '').trim();
  n = n.replace(/\bawait\s+/g, '').replace(/^return\s+/, 'return ');
  n = n.replace(/\b(?:this|self)\.(?=\w*[dD]river\b|browser\b)/g, '');
  n = n.replace(STRING_RE, (m) => { strs.push(unescapeLiteral(m)); return S(strs.length - 1); });
  // C# verbatim/interpolated prefixes
  n = n.replace(/[@$]«S/g, '«S');

  // By.xxx("...")  (java / csharp / js)
  n = n.replace(/\bBy\.(\w+)\s*\(\s*«S(\d+)»\s*\)/g, (m, strat: string, si: string) => {
    const s = normalizeStrategy(strat); return s ? L(mk(s, strs[Number(si)])) : m;
  });
  // python tuple form ((By.ID, "x")) -> only when the paren is not a call paren; then the bare form By.ID, "x"
  n = n.replace(/(?<![\w])\(\s*By\.(\w+)\s*,\s*«S(\d+)»\s*,?\s*\)/g, (m, strat: string, si: string) => {
    const s = normalizeStrategy(strat); return s ? L(mk(s, strs[Number(si)])) : m;
  });
  n = n.replace(/\bBy\.(\w+)\s*,\s*«S(\d+)»/g, (m, strat: string, si: string) => {
    const s = normalizeStrategy(strat); return s ? L(mk(s, strs[Number(si)])) : m;
  });
  // python legacy: find_element_by_id("x")
  n = n.replace(/[\w.]*\bfind_elements?_by_(\w+)\s*\(\s*«S(\d+)»\s*\)/g, (m, strat: string, si: string) => {
    const s = normalizeStrategy(strat); if (!s) return m;
    return m.includes('find_elements_') ? ES(mk(s, strs[Number(si)])) : E(mk(s, strs[Number(si)]));
  });
  // WebdriverIO / jQuery-style and Cypress
  n = n.replace(/(?<![\w.])\$\$\(\s*«S(\d+)»\s*\)/g, (_, si: string) => ES(mk('css', strs[Number(si)])));
  n = n.replace(/(?<![\w.])\$\(\s*«S(\d+)»\s*\)/g, (_, si: string) => E(mk('css', strs[Number(si)])));
  n = n.replace(/\bcy\.get\(\s*«S(\d+)»\s*\)/g, (_, si: string) => E(mk('css', strs[Number(si)])));
  n = n.replace(/\bcy\.contains\(\s*«S(\d+)»\s*\)/g, (_, si: string) => E(mk('text', strs[Number(si)])));

  // variable substitution (strings are tokenised, so word-boundary replace is safe)
  const ident = (name: string) => new RegExp(String.raw`(?<![\w.«])(?:this\.|self\.|_?)?\b${escapeRe(name)}\b(?!\s*\()`, 'g');
  for (const [name, loc] of scope.byVars) n = n.replace(ident(name), () => L(loc));
  for (const [name, loc] of scope.elements) n = n.replace(ident(name), () => E(loc));
  for (const [name, v] of scope.values) n = n.replace(ident(name), () => V(v));

  // driver.findElement(«L0») -> «E0» ; findElements -> «ES0»
  n = n.replace(/[\w.]*\b(?:findElements|FindElements|find_elements)\s*\(\s*«L(\d+)»\s*\)/g, (_, li: string) => `«ES${li}»`);
  n = n.replace(/[\w.]*\b(?:findElement|FindElement|find_element)\s*\(\s*«L(\d+)»\s*\)/g, (_, li: string) => `«E${li}»`);
  // new Select(«E0») / SelectElement / Select(...)
  n = n.replace(/(?:new\s+)?\b(?:Select|SelectElement)\s*\(\s*«E(\d+)»\s*\)/g, (_, ei: string) => `«E${ei}»`);

  // typed values
  n = n.replace(/«E(\d+)»\.(?:getText\(\)|Text\b|text\b|innerText\b|getText\b)/g, (_, ei: string) => V({ type: 'text', locator: locs[Number(ei)] }));
  n = n.replace(/«E(\d+)»\.(?:getAttribute|GetAttribute|get_attribute|getProperty|getValue)\(\s*(«S\d+»)?\s*\)/g, (_, ei: string, s?: string) => {
    const attr = s ? lit(s) ?? 'value' : 'value';
    return V(attr === 'value' ? { type: 'value', locator: locs[Number(ei)] } : { type: 'attribute', locator: locs[Number(ei)], attribute: attr });
  });
  n = n.replace(/«E(\d+)»\.(?:isDisplayed\(\)|Displayed\b|is_displayed\(\)|isDisplayed\b|isVisible\(\)|isExisting\(\))/g, (_, ei: string) => V({ type: 'visible', locator: locs[Number(ei)] }));
  n = n.replace(/«E(\d+)»\.(?:isEnabled\(\)|Enabled\b|is_enabled\(\)|isEnabled\b)/g, (_, ei: string) => V({ type: 'enabled', locator: locs[Number(ei)] }));
  n = n.replace(/«E(\d+)»\.(?:isSelected\(\)|Selected\b|is_selected\(\))/g, (_, ei: string) => V({ type: 'selected', locator: locs[Number(ei)] }));
  n = n.replace(/«ES(\d+)»\.(?:size\(\)|Count\b|length\b|Count\(\))/g, (_, ei: string) => V({ type: 'count', locator: locs[Number(ei)] }));
  n = n.replace(/\blen\(\s*«ES(\d+)»\s*\)/g, (_, ei: string) => V({ type: 'count', locator: locs[Number(ei)] }));
  n = n.replace(new RegExp(String.raw`${DRIVER}\.(?:getTitle\(\)|Title\b|title\b|getTitle\b)`, 'g'), () => V({ type: 'title' }));
  n = n.replace(new RegExp(String.raw`${DRIVER}\.(?:getCurrentUrl\(\)|Url\b|current_url\b|getUrl\(\)|getCurrentUrl\b)`, 'g'), () => V({ type: 'url' }));
  n = n.replace(new RegExp(String.raw`${DRIVER}\.(?:getPageSource\(\)|PageSource\b|page_source\b)`, 'g'), () => V({ type: 'pageSource' }));
  if (dialect === 'javascript') n = n.replace(/\bcy\.(?:title|url)\(\)/g, (m) => V({ type: m.includes('title') ? 'title' : 'url' }));

  return { n, strs, locs, vals };
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ---------------------------------------------------------------- classification

const NOISE_RE = /\b(?:quit|Quit|close|Close|Dispose|maximize|Maximize|manage\(\)|Manage\(\)|implicitly_wait|implicitlyWait|ImplicitWait|PageFactory|initElements|WebDriverManager|setProperty|ChromeDriver|FirefoxDriver|EdgeDriver|webdriver\.(?:Chrome|Firefox|Edge)|forBrowser|Builder\(\)|this\.timeout|timeout\(|save_screenshot|getScreenshotAs|TakesScreenshot|executeScript|execute_script|ExecuteScript|deleteAllCookies|yield)\b/;

export interface ParseResult { steps: Step[]; url?: string }

/**
 * Parse one statement into zero or more Steps. Mutates `scope` for assignments.
 * Statements that are driver lifecycle noise produce no steps.
 */
export function parseStatement(stmt: Statement, dialect: Dialect, scope: Scope, file: string): ParseResult {
  const { text, line } = stmt;
  const norm = normalize(text, dialect, scope, file, line);
  let { n } = norm;
  const { strs, locs, vals } = norm;
  const lit = (tok: string | undefined) => { const m = tok && /^«S(\d+)»$/.exec(tok.trim()); return m ? strs[Number(m[1])] : undefined; };
  const locOf = (tok: string | undefined) => { const m = tok && /«(?:E|ES|L)(\d+)»/.exec(tok); return m ? locs[Number(m[1])] : undefined; };
  const valOf = (tok: string | undefined) => { const m = tok && /^«V(\d+)»$/.exec(tok.trim()); return m ? vals[Number(m[1])] : undefined; };
  const step = (kind: StepKind, extra: Partial<Step> = {}): Step => ({ kind, raw: text, line, ...extra });
  const unknown = (): ParseResult => ({ steps: [step('unknown')] });
  const none: ParseResult = { steps: [] };

  // -- assignments (declaration keywords are optional)
  const assign = /^(?:(?:final|private|public|protected|internal|static|readonly|var|let|const|val|IWebElement|WebElement|By|Select|SelectElement|String|string|int|long|bool|boolean|List<\w+>|IList<\w+>|ReadOnlyCollection<\w+>)\s+)*([A-Za-z_]\w*)\s*=\s*(?!=)(.+)$/.exec(n);
  if (assign) {
    const [, name, rhs] = assign;
    const r = rhs.trim();
    if (/^«E\d+»$/.test(r)) { scope.elements.set(name, locOf(r)!); return none; }
    if (/^«ES\d+»$/.test(r)) { scope.elements.set(name, locOf(r)!); return none; }
    if (/^«L\d+»$/.test(r)) { scope.byVars.set(name, locOf(r)!); return none; }
    if (/^«V\d+»$/.test(r)) { scope.values.set(name, valOf(r)!); return none; }
    const s = lit(r); if (s !== undefined) { scope.constants[name] = s; return none; }
    const obj = /^new\s+([A-Z]\w*)\s*\(|^([A-Z]\w*)\s*\(/.exec(r);
    if (obj) {
      const cls = obj[1] ?? obj[2];
      if (!/Driver$|^Builder$|^WebDriverWait$|^Actions$|^Select(?:Element)?$|^Duration$|^TimeSpan$/.test(cls)) scope.objects.set(name, cls);
      return none;
    }
    if (NOISE_RE.test(r) || /^new\s+\w*Wait/.test(r) || /^new\s+Actions/.test(r)) return none;
    // something else assigned: keep as unknown only if it touches the browser
    if (/«[EL]\d+»|driver|browser/.test(r)) return unknown();
    return none;
  }

  if (NOISE_RE.test(n) && !/«E\d+»\.(?:click|Click|sendKeys|send_keys|SendKeys)/.test(n)) return none;

  // -- navigate
  const nav = new RegExp(String.raw`(?:^|[^\w.])${DRIVER}\.(?:get|navigate\(\)\.to|Navigate\(\)\.GoToUrl|visit|url|open|goto|navigateTo)\s*\((.*)\)$`).exec(n);
  if (nav) {
    const { value, expr, resolved } = resolveConcat(nav[1], strs, scope);
    return { steps: [step('navigate', { value, valueExpr: resolved ? undefined : expr })], url: resolved && /^https?:\/\//.test(value) ? value : undefined };
  }

  // -- element actions
  let m: RegExpExecArray | null;
  if ((m = /«E(\d+)»\.(?:click|Click|doubleClick)\(\)/.exec(n))) return { steps: [step('click', { locator: locs[Number(m[1])] })] };
  if ((m = /«E(\d+)»\.(?:clear|Clear|clearValue)\(\)/.exec(n))) return { steps: [step('clear', { locator: locs[Number(m[1])] })] };
  if ((m = /«E(\d+)»\.(?:submit|Submit)\(\)/.exec(n))) return { steps: [step('press', { locator: locs[Number(m[1])], value: 'Enter' })] };
  if ((m = /«E(\d+)»\.(?:sendKeys|send_keys|SendKeys|setValue|addValue|type)\((.*)\)$/.exec(n))) {
    const loc = locs[Number(m[1])];
    const steps: Step[] = [];
    for (const arg of splitTopLevel(m[2])) {
      const key = /^Keys?\.(\w+)$/.exec(arg);
      if (key) { steps.push(step('press', { locator: loc, value: mapKey(key[1]) })); continue; }
      const { value, expr, resolved } = resolveConcat(arg, strs, scope);
      steps.push(step('fill', { locator: loc, value: resolved ? value : undefined, valueExpr: resolved ? undefined : expr }));
    }
    return { steps: steps.length ? steps : [step('unknown')] };
  }
  if ((m = /«E(\d+)»\.(?:selectByVisibleText|SelectByText|select_by_visible_text|selectByValue|SelectByValue|select_by_value|selectOption|selectByIndex|SelectByIndex|select_by_index|select)\((.*)\)$/.exec(n))) {
    const loc = locs[Number(m[1])];
    const byValue = /ByValue|by_value/.test(n);
    const byIndex = /ByIndex|by_index/.test(n);
    const { value, expr, resolved } = resolveConcat(m[2], strs, scope);
    if (byIndex) return { steps: [step('select', { locator: loc, value: value || m[2], valueExpr: 'index', byValue: true })] };
    return { steps: [step('select', { locator: loc, value: resolved ? value : undefined, valueExpr: resolved ? undefined : expr, byValue })] };
  }
  if ((m = /(?:moveToElement|MoveToElement|move_to_element)\(\s*«E(\d+)»|«E(\d+)»\.(?:hover|moveTo|trigger)\(/.exec(n))) {
    return { steps: [step('hover', { locator: locs[Number(m[1] ?? m[2])] })] };
  }

  // -- waits
  if ((m = /\b(?:Thread\.sleep|Thread\.Sleep|time\.sleep|sleep|cy\.wait|pause)\s*\(\s*(\d+(?:\.\d+)?)?/.exec(n)) && !/until|Until/.test(n)) {
    const num = m[1] ? Number(m[1]) : undefined;
    const ms = num === undefined ? undefined : dialect === 'python' || /time\.sleep/.test(n) ? Math.round(num * 1000) : Math.round(num);
    return { steps: [step('wait', { hard: true, value: ms === undefined ? undefined : String(ms) })] };
  }
  if (/\b(?:WebDriverWait|until|Until|wait|Wait|waitFor\w*|ExpectedConditions|EC\.)\b/.test(n)) {
    const loc = locOf(n);
    if (loc) {
      const hidden = /invisibility|Invisibility|not\(|stalenessOf|Staleness/.test(n);
      return { steps: [step('wait', { locator: loc, hard: false, value: hidden ? 'hidden' : 'visible' })] };
    }
    return unknown();
  }

  // -- assertions
  const a = parseAssertion(n, dialect, lit, valOf, locOf, strs, scope);
  if (a === 'unknown') return unknown();
  if (a) return { steps: [step('assert', { assertion: a, locator: a.locator })] };

  // -- return of a typed value (page object getters)
  if ((m = /^return\s+«V(\d+)»$/.exec(n))) {
    const v = vals[Number(m[1])];
    return { steps: [step('read', { locator: v.locator, value: v.type, valueExpr: v.attribute })] };
  }

  // -- page-object method call
  if ((m = /^(?:this\.|self\.)?([A-Za-z_]\w*)\.([A-Za-z_]\w*)\((.*)\)$/.exec(n)) && scope.objects.has(m[1])) {
    const args = splitTopLevel(m[3]).map((arg) => {
      const r = resolveConcat(arg, strs, scope);
      return r.resolved ? JSON.stringify(r.value) : r.expr;
    });
    return { steps: [step('call', { call: { object: scope.objects.get(m[1])!, method: m[2], args } })] };
  }

  // Bare `«E0»` like a lone findElement (Java `driver.findElement(...).isDisplayed();` w/o assert) -> treat as visibility wait
  if (/^«V\d+»$/.test(n)) {
    const v = valOf(n)!;
    if (v.type === 'visible' && v.locator) return { steps: [step('wait', { locator: v.locator, value: 'visible' })] };
  }

  if (!n) return none;
  return unknown();
}

export interface Resolved { value: string; expr: string; resolved: boolean }

/** Resolve `BASE_URL + "/path"` style expressions using constants; reports whether everything resolved. */
export function resolveConcat(expr: string, strs: string[], scope: Scope): Resolved {
  const parts = splitTopLevel(expr.trim(), '+');
  let value = '';
  let resolved = true;
  const names: string[] = [];
  for (const p of parts) {
    const s = /^«S(\d+)»$/.exec(p);
    if (s) { value += strs[Number(s[1])]; continue; }
    const idm = /^(?:this\.|self\.)?([A-Za-z_]\w*)$/.exec(p);
    if (idm && scope.constants[idm[1]] !== undefined) { value += scope.constants[idm[1]]; continue; }
    if (/^\d+(?:\.\d+)?$/.test(p)) { value += p; continue; }
    resolved = false;
    names.push(idm ? idm[1] : p);
  }
  const pretty = expr.replace(/«S(\d+)»/g, (_, i: string) => JSON.stringify(strs[Number(i)]));
  return { value, expr: names.length === 1 && parts.length === 1 ? names[0] : pretty, resolved };
}

type LitFn = (tok: string | undefined) => string | undefined;
type ValFn = (tok: string | undefined) => TypedValue | undefined;
type LocFn = (tok: string | undefined) => Locator | undefined;

function parseAssertion(n: string, dialect: Dialect, lit: LitFn, valOf: ValFn, locOf: LocFn, strs: string[], scope: Scope): (Assertion & { locator?: Locator }) | 'unknown' | null {
  let m: RegExpExecArray | null;
  let op: Op | null = null;
  let args: string[] = [];
  const run = (o: Op, a: string[]) => interpret(o, a, lit, valOf, strs, scope);

  const am = /^(?:(Assert|Assertions|assert|self|StringAssert|CollectionAssert)\.)?(assert)?([A-Za-z]+)\((.*)\)$/.exec(n);
  const isAssertLib = !!am && (!!am[2] || /^(Assert|Assertions|assert|StringAssert|CollectionAssert)$/.test(am[1] ?? ''));
  if (am && isAssertLib) {
    const kind = am[3];
    args = splitTopLevel(am[4]);
    if (/^(Equals|Equal|AreEqual|AreSame|strictEqual|deepEqual|deepStrictEqual|equal|eq|same)$/.test(kind)) op = 'equals';
    else if (/^(NotEquals|NotEqual|AreNotEqual|notEqual|notStrictEqual|notDeepEqual|notDeepStrictEqual)$/.test(kind)) op = 'notEquals';
    else if (/^(True|IsTrue|isTrue|ok|assert)$/.test(kind)) op = 'true';
    else if (/^(False|IsFalse|isFalse|notOk)$/.test(kind)) op = 'false';
    else if (/^(In|Contains|Contain|include|includes|StringContains)$/.test(kind)) op = 'contains';
    else if (kind === 'That') {
      // NUnit: Assert.That(actual, Is.EqualTo(x) | Does.Contain(x) | Is.True)
      const c = /^(?:Is|Does)\.(EqualTo|Not\.EqualTo|Contain|True|False)\((.*)\)$|^Is\.(True|False)$/.exec(args[1] ?? '');
      if (!c) return 'unknown';
      const k = c[1] ?? c[3];
      op = k === 'EqualTo' ? 'equals' : k === 'Not.EqualTo' ? 'notEquals' : k === 'Contain' ? 'contains' : k === 'True' ? 'true' : 'false';
      args = c[2] !== undefined ? [args[0], c[2]] : [args[0]];
    } else return 'unknown';
  } else if ((m = /^assert\s+(.+)$/.exec(n)) && dialect === 'python') {
    const e = m[1];
    let c: RegExpExecArray | null;
    if ((c = /^(.+?)\s*(==|!=)\s*(.+)$/.exec(e))) { op = c[2] === '==' ? 'equals' : 'notEquals'; args = [c[1], c[3]]; }
    else if ((c = /^(.+?)\s+not\s+in\s+(.+)$/.exec(e))) { return negateOf(run('contains', [c[1], c[2]])); }
    else if ((c = /^(.+?)\s+in\s+(.+)$/.exec(e))) { op = 'contains'; args = [c[1], c[2]]; }
    else if ((c = /^not\s+(.+)$/.exec(e))) { op = 'false'; args = [c[1]]; }
    else { op = 'true'; args = [e]; }
  } else if ((m = /^expect\((.*?)\)\.(?:to\.|toBe|to)?(?:be\.|have\.|not\.)*?(equal|eql|eq|Be|Equal|Truthy|true|false|contain|include|Contain|visible|ok|exist|text)\b(?:\((.*)\))?$/.exec(n))) {
    const kind = m[2];
    args = [m[1], ...(m[3] !== undefined ? splitTopLevel(m[3]) : [])];
    if (/^(equal|eql|eq|Be|Equal)$/.test(kind)) op = 'equals';
    else if (/^(Truthy|true|ok|exist|visible)$/.test(kind)) op = 'true';
    else if (kind === 'false') op = 'false';
    else if (/^(contain|include|Contain|text)$/.test(kind)) op = 'contains';
    if (op && /\.not\./.test(n)) return negateOf(run(op, args));
  } else if ((m = /^«E(\d+)»\.should\(\s*«S(\d+)»\s*(?:,\s*(.*))?\)$/.exec(n))) {
    // cypress chains
    const chain = strs[Number(m[2])];
    const loc = locOf(`«E${m[1]}»`);
    const arg = m[3] ? lit(m[3]) : undefined;
    const neg = chain.startsWith('not.');
    const c = chain.replace(/^not\./, '');
    const base = (type: AssertionType, expected?: string): Assertion & { locator?: Locator } => ({ type, expected, negate: neg || undefined, locator: loc });
    if (c === 'be.visible') return base('visible');
    if (c === 'exist') return base('visible');
    if (c === 'have.text') return base('text', arg);
    if (c === 'contain' || c === 'contain.text' || c === 'include.text') return base('containsText', arg);
    if (c === 'have.value') return base('value', arg);
    if (c === 'be.enabled') return base('enabled');
    if (c === 'be.disabled') return { ...base('enabled'), negate: !neg };
    if (c === 'have.length') return base('count', arg);
    return 'unknown';
  } else if (/^(?:Assert|Assertions|assert|expect|should|StringAssert|self\.assert)\b/.test(n)) {
    return 'unknown';
  }
  if (!op) return null;
  return run(op, args);
}

type Op = 'equals' | 'notEquals' | 'true' | 'false' | 'contains';

function negateOf(a: (Assertion & { locator?: Locator }) | 'unknown' | null) {
  if (!a || a === 'unknown') return a;
  return { ...a, negate: !a.negate };
}

function interpret(op: Op, args: string[], lit: LitFn, valOf: ValFn, strs: string[], scope: Scope): (Assertion & { locator?: Locator }) | 'unknown' | null {
  const literalOf = (tok: string): string | undefined => {
    const s = lit(tok); if (s !== undefined) return s;
    if (/^-?\d+(?:\.\d+)?$/.test(tok.trim())) return tok.trim();
    if (/^(true|false|True|False)$/.test(tok.trim())) return tok.trim().toLowerCase();
    return undefined;
  };
  const pick = (): { v?: TypedValue; expected?: string; expectedExpr?: string; containsCall?: boolean } => {
    let v: TypedValue | undefined; let expected: string | undefined; let expectedExpr: string | undefined; let containsCall = false;
    for (const a of args) {
      const direct = valOf(a);
      if (direct && !v) { v = direct; continue; }
      const cc = /^«V(\d+)»\.(?:contains|Contains|includes|indexOf|__contains__)\(\s*(«S\d+»|[A-Za-z_]\w*)\s*\)(?:\s*(?:>=?|!==?)\s*-?\d)?$/.exec(a.trim());
      if (cc && !v) {
        v = valOf(`«V${cc[1]}»`); containsCall = true;
        const l = lit(cc[2]); if (l !== undefined) expected = l; else if (scope.constants[cc[2]] !== undefined) expected = scope.constants[cc[2]]; else if (scope.params.has(cc[2])) expectedExpr = cc[2];
        continue;
      }
      const l = literalOf(a);
      if (l !== undefined && expected === undefined) { expected = l; continue; }
      const idm = /^(?:this\.|self\.)?([A-Za-z_]\w*)$/.exec(a.trim());
      if (idm && expected === undefined && expectedExpr === undefined) {
        if (scope.constants[idm[1]] !== undefined) expected = scope.constants[idm[1]];
        else if (scope.params.has(idm[1])) expectedExpr = idm[1];
      }
    }
    return { v, expected, expectedExpr, containsCall };
  };
  const { v, expected, expectedExpr, containsCall } = pick();
  if (!v) return 'unknown';
  const loc = v.locator;
  const neg = op === 'notEquals' || op === 'false' ? true : undefined;
  const withLoc = (type: AssertionType, exp?: string, negate = neg): Assertion & { locator?: Locator } => ({ type, expected: exp, expectedExpr: exp === undefined ? expectedExpr : undefined, negate: negate || undefined, locator: loc });
  const hasExpected = expected !== undefined || expectedExpr !== undefined;

  if (containsCall || op === 'contains') {
    if (!hasExpected) return 'unknown';
    switch (v.type) {
      case 'text': return withLoc('containsText', expected);
      case 'url': return withLoc('urlContains', expected);
      case 'title': return withLoc('titleContains', expected);
      case 'pageSource': return withLoc('pageContains', expected);
      case 'value': return withLoc('value', expected);
      default: return 'unknown';
    }
  }
  if (op === 'true' || op === 'false') {
    const flip = op === 'false';
    switch (v.type) {
      case 'visible': return withLoc(flip ? 'hidden' : 'visible', undefined, undefined);
      case 'enabled': return withLoc('enabled', undefined, flip || undefined);
      case 'selected': return { type: 'attribute', attribute: 'checked', expected: '', negate: flip || undefined, locator: loc };
      default: return 'unknown';
    }
  }
  // equals / notEquals
  if (!hasExpected) return 'unknown';
  switch (v.type) {
    case 'text': return withLoc('text', expected);
    case 'title': return withLoc('title', expected);
    case 'url': return withLoc('url', expected);
    case 'value': return withLoc('value', expected);
    case 'attribute': return { type: 'attribute', attribute: v.attribute, expected, expectedExpr: expected === undefined ? expectedExpr : undefined, negate: neg, locator: loc };
    case 'count': return withLoc('count', expected);
    case 'visible': return withLoc(expected === 'true' ? 'visible' : 'hidden', undefined, undefined);
    case 'enabled': return withLoc('enabled', undefined, (expected === 'false') !== !!neg || undefined);
    default: return 'unknown';
  }
}

/** Parse a method body (list of statements) into steps, threading the scope. */
export function parseBody(statements: Statement[], dialect: Dialect, scope: Scope, file: string): { steps: Step[]; urls: string[] } {
  const steps: Step[] = [];
  const urls: string[] = [];
  for (const s of statements) {
    const r = parseStatement(s, dialect, scope, file);
    steps.push(...r.steps);
    if (r.url) urls.push(r.url);
  }
  return { steps, urls };
}

/** Collect every locator referenced by a list of steps (deduped by identity). */
export function locatorsOf(steps: Step[]): Locator[] {
  const out: Locator[] = [];
  for (const s of steps) if (s.locator && !out.includes(s.locator)) out.push(s.locator);
  return out;
}
