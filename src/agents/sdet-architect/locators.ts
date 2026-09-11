// Locator standardisation: Selenium strategy -> most robust Playwright form, with a confidence score.
// Pure functions; no I/O.
import type { Locator, LocatorStrategy } from './model.js';

export interface StdLocator {
  /** Playwright expression relative to `page`, e.g. `page.locator('#x')` or `page.getByRole('link', { name: 'x' })`. */
  expr: string;
  confidence: number;    // 0..1
  strategy: LocatorStrategy;
  /** Short human reason when confidence is below the review threshold. */
  note?: string;
}

export const LOW_CONFIDENCE = 0.6;

export interface StdOptions {
  /** Attribute Playwright's getByTestId should use. When 'id', ids that look like test ids become getByTestId. */
  testIdAttribute?: 'data-testid' | 'id' | 'data-test' | 'data-qa' | 'data-cy';
}

/** Quote a string for a single-quoted TS literal. */
export function q(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

export function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); }

const TEST_ID_RE = /^(?:test|qa|e2e|tid|testid|data-test|cy)[-_:]/i;
export function looksLikeTestId(id: string): boolean { return TEST_ID_RE.test(id) || /[-_](?:test|testid|qa)$/i.test(id); }

const CSS_IDENT = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;
function cssId(id: string): string { return CSS_IDENT.test(id) ? `#${id}` : `[id=${JSON.stringify(id)}]`; }
function cssAttr(attr: string, value: string, tag = ''): string { return `${tag === '*' ? '' : tag}[${attr}=${JSON.stringify(value)}]`; }

const ROLE_TAGS: Record<string, string> = { a: 'link', button: 'button', input: 'textbox', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', li: 'listitem', img: 'img', th: 'columnheader', option: 'option' };

export function standardize(loc: Locator, opts: StdOptions = {}): StdLocator {
  const v = loc.value.trim();
  const base = (expr: string, confidence: number, note?: string): StdLocator => ({ expr, confidence, strategy: loc.strategy, note });
  switch (loc.strategy) {
    case 'id':
      if (opts.testIdAttribute === 'id' && looksLikeTestId(v)) return base(`page.getByTestId(${q(v)})`, 0.95);
      if (/\s/.test(v) || !v) return base(`page.locator(${q(cssId(v))})`, 0.3, 'id contains whitespace or is empty');
      if (/\d{3,}/.test(v) || /^(?::|j_id|gwt-uid|ext-|yui_|ember\d|react-select-\d)/.test(v)) return base(`page.locator(${q(cssId(v))})`, 0.5, 'id looks auto-generated');
      return base(`page.locator(${q(cssId(v))})`, 0.95);
    case 'testId':
      return base(`page.getByTestId(${q(v)})`, 0.95);
    case 'name':
      return base(`page.locator(${q(cssAttr('name', v))})`, 0.85);
    case 'linkText':
      return base(`page.getByRole('link', { name: ${q(v)}, exact: true })`, 0.9);
    case 'partialLinkText':
      return base(`page.getByRole('link', { name: /${escapeRegex(v)}/ })`, 0.8);
    case 'className': {
      const classes = v.split(/\s+/).filter(Boolean);
      if (!classes.length) return base(`page.locator('.undefined')`, 0.1, 'empty class name');
      const sel = classes.map((c) => `.${c}`).join('');
      const utility = classes.some((c) => /^(?:col|row|btn|mt|mb|p|m|px|py|text|d|w|h|flex|grid|bg)-/.test(c));
      return base(`page.locator(${q(sel)})`, utility ? 0.5 : 0.65, utility ? 'utility/layout class names are not stable' : undefined);
    }
    case 'tagName':
      return base(`page.locator(${q(v)})`, 0.5, 'tag name alone is ambiguous');
    case 'text':
      return base(`page.getByText(${q(v)})`, 0.85);
    case 'css': {
      const v = normalizeCssQuotes(loc.value.trim());
      const dt = /^\[(data-testid|data-test|data-qa|data-cy)=["']?([^"'\]]+)["']?\]$/.exec(v);
      if (dt && (!opts.testIdAttribute || opts.testIdAttribute === dt[1])) return base(`page.getByTestId(${q(dt[2])})`, 0.95);
      if (/:nth-child\(|:nth-of-type\(|>\s*\w+\s*>\s*\w+\s*>/.test(v)) return base(`page.locator(${q(v)})`, 0.5, 'positional/deeply chained css');
      if (/\d{3,}/.test(v)) return base(`page.locator(${q(v)})`, 0.55, 'css contains generated-looking numbers');
      return base(`page.locator(${q(v)})`, 0.8);
    }
    case 'xpath':
      return standardizeXpath(v, base);
  }
}

type BaseFn = (expr: string, confidence: number, note?: string) => StdLocator;

/** `[type='submit']` -> `[type="submit"]` so generated single-quoted TS literals need no escaping. */
export function normalizeCssQuotes(css: string): string {
  return css.replace(/\[([\w-]+)([~|^$*]?=)'([^'"]*)'\]/g, (_, a: string, op: string, val: string) => `[${a}${op}"${val}"]`);
}

const SEG_RE = /^([a-zA-Z][\w-]*|\*)((?:\[[^\]]*\])*)$/;

/** Convert simple xpaths to css/text/role; anything else stays xpath at low confidence. */
function standardizeXpath(xp: string, base: BaseFn): StdLocator {
  const s = xp.trim();
  if (/^\/html\b|^\/body\b/.test(s) || /^\/[^/]/.test(s)) return base(`page.locator(${q(`xpath=${s}`)})`, 0.2, 'absolute xpath is brittle');

  // text() forms on a single segment
  let m: RegExpExecArray | null;
  if ((m = /^\/\/([a-zA-Z][\w-]*|\*)\[(?:normalize-space\(\)|text\(\)|\.)\s*=\s*(['"])(.*?)\2\]$/.exec(s))) {
    const role = ROLE_TAGS[m[1]];
    if (role) return base(`page.getByRole(${q(role)}, { name: ${q(m[3])}, exact: true })`, 0.85);
    return base(`page.getByText(${q(m[3])}, { exact: true })`, 0.8);
  }
  if ((m = /^\/\/([a-zA-Z][\w-]*|\*)\[contains\((?:text\(\)|\.|normalize-space\(\))\s*,\s*(['"])(.*?)\2\)\]$/.exec(s))) {
    const role = ROLE_TAGS[m[1]];
    if (role) return base(`page.getByRole(${q(role)}, { name: /${escapeRegex(m[3])}/ })`, 0.8);
    return base(`page.getByText(${q(m[3])})`, 0.75);
  }

  // segment chains: //tag[@a='v']//tag2  ->  tag[a="v"] tag2
  const chain = s.replace(/^\/\//, '');
  const parts: string[] = [];
  let rest = chain;
  let combinator = '';
  let confidence = 0.85;
  let note: string | undefined;
  let ok = true;
  while (rest.length) {
    let segEnd = indexOfTopLevelSlash(rest);
    const seg = segEnd === -1 ? rest : rest.slice(0, segEnd);
    const sm = SEG_RE.exec(seg);
    if (!sm) { ok = false; break; }
    let css = sm[1] === '*' ? '' : sm[1];
    const preds = sm[2].match(/\[[^\]]*\]/g) ?? [];
    for (const p of preds) {
      const inner = p.slice(1, -1).trim();
      let pm: RegExpExecArray | null;
      if ((pm = /^@id\s*=\s*(['"])(.*?)\1$/.exec(inner))) { css += cssId(pm[2]); continue; }
      if ((pm = /^@([\w-]+)\s*=\s*(['"])(.*?)\2$/.exec(inner))) { css += `[${pm[1]}=${JSON.stringify(pm[3])}]`; if (pm[1] === 'class' && /\s/.test(pm[3])) { confidence = Math.min(confidence, 0.6); note = 'exact multi-class match; prefer a single stable class or test id'; } continue; }
      if ((pm = /^contains\(@class\s*,\s*(['"])(.*?)\1\)$/.exec(inner))) { css += `.${pm[2].trim().split(/\s+/).join('.')}`; confidence = Math.min(confidence, 0.7); continue; }
      if ((pm = /^contains\(@([\w-]+)\s*,\s*(['"])(.*?)\2\)$/.exec(inner))) { css += `[${pm[1]}*=${JSON.stringify(pm[3])}]`; confidence = Math.min(confidence, 0.7); continue; }
      if ((pm = /^starts-with\(@([\w-]+)\s*,\s*(['"])(.*?)\2\)$/.exec(inner))) { css += `[${pm[1]}^=${JSON.stringify(pm[3])}]`; confidence = Math.min(confidence, 0.7); continue; }
      if ((pm = /^(\d+)$/.exec(inner))) { css += `:nth-of-type(${pm[1]})`; confidence = Math.min(confidence, 0.5); note = 'positional index in xpath'; continue; }
      if (/^(?:contains\()?(?:text\(\)|\.)/.test(inner)) {
        // text predicate mid-chain: emit :has-text
        const tm = /(['"])(.*?)\1/.exec(inner);
        if (tm) { css += `:has-text(${JSON.stringify(tm[2])})`; confidence = Math.min(confidence, 0.7); continue; }
      }
      ok = false; break;
    }
    if (!ok) break;
    parts.push(combinator + (css || '*'));
    if (segEnd === -1) break;
    if (rest.startsWith('//', segEnd)) { combinator = ' '; rest = rest.slice(segEnd + 2); }
    else { combinator = ' > '; rest = rest.slice(segEnd + 1); }
    if (!rest) { ok = false; break; }
  }
  if (ok && parts.length) {
    const sel = parts.join('');
    if (parts.length > 3) { confidence = Math.min(confidence, 0.55); note = 'long xpath chain'; }
    return base(`page.locator(${q(sel)})`, confidence, note);
  }
  return base(`page.locator(${q(`xpath=${s}`)})`, 0.35, 'brittle xpath: could not reduce to css/text/role');
}

function indexOfTopLevelSlash(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === '/' && depth === 0) return i;
  }
  return -1;
}

/** Stable identity for dedup: strategy + value. */
export function locatorKey(loc: Locator): string { return `${loc.strategy}:${loc.value}`; }

/** Decide which attribute getByTestId should target, based on what the estate actually uses. */
export function chooseTestIdAttribute(locators: Locator[]): StdOptions['testIdAttribute'] {
  const counts: Record<string, number> = {};
  for (const l of locators) {
    if (l.strategy === 'css') { const m = /^\[(data-testid|data-test|data-qa|data-cy)=/.exec(l.value.trim()); if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1; }
    if (l.strategy === 'id' && looksLikeTestId(l.value)) counts.id = (counts.id ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (best?.[0] as StdOptions['testIdAttribute']) ?? 'data-testid';
}

/** Derive a camelCase field name for a locator (used when generating page objects). */
export function fieldNameFor(loc: Locator, std: StdLocator): string {
  if (loc.alias) return lowerFirst(loc.alias.replace(/^_+/, ''));
  const v = loc.value;
  let words = '';
  let suffix = '';
  const fromExpr = () => {
    const m = /name: (?:'([^']*)'|\/([^/]*)\/)/.exec(std.expr) ?? /getBy(?:Text|TestId)\('([^']*)'/.exec(std.expr);
    if (m) { words = m[1] ?? m[2]; suffix = /getByRole\('link'/.test(std.expr) ? 'Link' : /getByRole\('button'/.test(std.expr) ? 'Button' : /getByText/.test(std.expr) ? 'Text' : ''; return; }
    const sel = /page\.locator\('((?:[^'\\]|\\.)*)'\)/.exec(std.expr)?.[1]?.replace(/\\'/g, "'") ?? v;
    const named = cssName(sel.replace(/^xpath=/, ''));
    words = named.words; suffix = named.suffix;
  };
  switch (loc.strategy) {
    case 'id': case 'name': case 'testId': words = v; break;
    case 'linkText': case 'partialLinkText': words = v; suffix = 'Link'; break;
    case 'text': words = v; suffix = 'Text'; break;
    case 'className': words = v.split(/\s+/)[0]; break;
    case 'tagName': words = v; suffix = 'Element'; break;
    default: fromExpr();
  }
  const camel = toCamel(words);
  const name = (camel || 'element') + suffix;
  return /^[0-9]/.test(name) ? `el${name}` : name;
}

function toCamel(words: string): string {
  return words.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))).join('');
}

/** Name a css selector by its most specific final segment: #id > .class > [attr=val]+tag > tag. */
function cssName(sel: string): { words: string; suffix: string } {
  const segs = sel.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const last = segs[segs.length - 1] ?? sel;
  const prev = segs.length > 1 ? segs[segs.length - 2] : undefined;
  const parse = (seg: string) => ({
    tag: /^[a-zA-Z][\w-]*/.exec(seg)?.[0] ?? '',
    id: /#([\w-]+)/.exec(seg)?.[1],
    cls: /\.([\w-]+)/.exec(seg)?.[1],
    attr: /\[([\w-]+)[~|^$*]?=["']?([^"'\]]+)["']?\]/.exec(seg),
    hasText: /:has-text\("([^"]*)"\)/.exec(seg)?.[1],
  });
  const L = parse(last);
  const P = prev ? parse(prev) : undefined;
  const context = P ? (P.id ?? P.cls ?? '') : '';
  if (L.hasText) return { words: L.hasText, suffix: L.tag === 'a' ? 'Link' : L.tag ? upperFirst(L.tag) : 'Text' };
  if (L.id) return { words: L.id, suffix: '' };
  if (L.cls) return { words: L.cls, suffix: '' };
  if (L.attr) {
    const attrName = L.attr[1]; const attrVal = L.attr[2];
    if (attrName === 'type' && L.tag === 'input') return { words: `${context} ${attrVal}`, suffix: 'Input' };
    if (attrName === 'type') return { words: `${context} ${attrVal}`, suffix: upperFirst(L.tag || 'Element') };
    return { words: `${context} ${attrVal}`, suffix: upperFirst(L.tag || attrName) };
  }
  if (L.tag) return { words: `${context} ${L.tag}`, suffix: context ? '' : 'Element' };
  return { words: sel.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ').slice(-3).join(' '), suffix: 'Element' };
}

export function lowerFirst(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
export function upperFirst(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
