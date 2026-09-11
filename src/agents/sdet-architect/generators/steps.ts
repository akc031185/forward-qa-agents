// Step -> Playwright code emitter. Pure. Used by spec, page-object and BDD generators.
import type { Locator, Step } from '../model.js';
import { escapeRegex, q } from '../locators.js';

export interface EmitCtx {
  /** Expression for the Page object: 'page' in specs, 'this.page' inside page classes. */
  page: string;
  /** Resolve a locator to a Playwright Locator expression. */
  loc: (l: Locator) => string;
  /** Resolve a page-object call to the variable holding that page object (fixture name or this.x). */
  callTarget?: (className: string) => string | undefined;
  baseUrl?: string;
  params?: Set<string>;
  /** Optional model-provided hints for unconvertible lines (comment only, never executed). */
  hints?: Map<Step, string>;
  sourceFile: string;
}

export interface Emitted { code: string[]; todo: boolean; flaky?: boolean }

const TODO = 'TODO(sdet-architect)';

export function emitStep(s: Step, ctx: EmitCtx): Emitted {
  const ref = `[${ctx.sourceFile}:${s.line}]`;
  const todo = (why?: string): Emitted => {
    const lines = [`// ${TODO}: ${s.raw.trim()}  ${ref}${why ? ` -- ${why}` : ''}`];
    const hint = ctx.hints?.get(s);
    if (hint) lines.push(...hint.split('\n').map((h) => `//   suggestion: ${h}`));
    return { code: lines, todo: true };
  };
  const ok = (...code: string[]): Emitted => ({ code, todo: false });
  const L = s.locator ? ctx.loc(s.locator) : undefined;
  const valueOrExpr = (): { expr: string } | undefined => {
    if (s.value !== undefined) return { expr: q(s.value) };
    if (s.valueExpr && ctx.params?.has(s.valueExpr)) return { expr: s.valueExpr };
    return undefined;
  };

  switch (s.kind) {
    case 'navigate': {
      if (s.value !== undefined && (s.valueExpr === undefined || s.value.startsWith('/'))) {
        let url = s.value;
        if (ctx.baseUrl && url.startsWith(ctx.baseUrl)) url = url.slice(ctx.baseUrl.length) || '/';
        const note = s.valueExpr ? `  // was: ${s.valueExpr}` : '';
        return ok(`await ${ctx.page}.goto(${q(url)});${note}`);
      }
      if (s.valueExpr && ctx.params?.has(s.valueExpr)) return ok(`await ${ctx.page}.goto(${s.valueExpr});`);
      return todo('navigation target is not a literal');
    }
    case 'click': return ok(`await ${L}.click();`);
    case 'clear': return ok(`await ${L}.clear();`);
    case 'hover': return ok(`await ${L}.hover();`);
    case 'press': return ok(`await ${L}.press(${q(s.value ?? 'Enter')});`);
    case 'fill': {
      const v = valueOrExpr();
      if (!v) return todo('value is not a literal or parameter');
      const isFile = s.locator && /type=["']?file/.test(s.locator.value);
      return ok(isFile ? `await ${L}.setInputFiles(${v.expr});` : `await ${L}.fill(${v.expr});`);
    }
    case 'select': {
      if (s.valueExpr === 'index') return ok(`await ${L}.selectOption({ index: ${Number(s.value) || 0} });`);
      const v = valueOrExpr();
      if (!v) return todo('option is not a literal or parameter');
      return ok(s.byValue ? `await ${L}.selectOption(${v.expr});` : `await ${L}.selectOption({ label: ${v.expr} });`);
    }
    case 'wait': {
      if (s.hard) {
        const ms = s.value ? `${s.value}ms ` : '';
        return { code: [`// NOTE(sdet-architect): removed hard wait ${ms}(${s.raw.trim()}); Playwright auto-waits on actions and expect().  ${ref}`], todo: false, flaky: true };
      }
      if (!L) return todo('explicit wait without a resolvable locator');
      return ok(`await ${L}.waitFor({ state: ${q(s.value === 'hidden' ? 'hidden' : 'visible')} });`);
    }
    case 'assert': {
      const a = s.assertion;
      if (!a) return todo();
      const not = a.negate ? '.not' : '';
      const exp = a.expected !== undefined ? q(a.expected) : a.expectedExpr && ctx.params?.has(a.expectedExpr) ? a.expectedExpr : undefined;
      const re = a.expected !== undefined ? `/${escapeRegex(a.expected)}/` : a.expectedExpr && ctx.params?.has(a.expectedExpr) ? `new RegExp(${a.expectedExpr}.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'))` : undefined;
      const needsLoc = !['title', 'titleContains', 'url', 'urlContains', 'pageContains'].includes(a.type);
      if (needsLoc && !L) return todo('assertion target could not be resolved');
      switch (a.type) {
        case 'text': return exp ? ok(`await expect(${L})${not}.toHaveText(${exp});`) : todo();
        case 'containsText': return exp ? ok(`await expect(${L})${not}.toContainText(${exp});`) : todo();
        case 'visible': return ok(`await expect(${L})${not}.toBeVisible();`);
        case 'hidden': return ok(`await expect(${L})${not}.toBeHidden();`);
        case 'enabled': return ok(`await expect(${L})${not}.toBeEnabled();`);
        case 'title': return exp ? ok(`await expect(${ctx.page})${not}.toHaveTitle(${exp});`) : todo();
        case 'titleContains': return re ? ok(`await expect(${ctx.page})${not}.toHaveTitle(${re});`) : todo();
        case 'url': return exp ? ok(`await expect(${ctx.page})${not}.toHaveURL(${exp});`) : todo();
        case 'urlContains': return re ? ok(`await expect(${ctx.page})${not}.toHaveURL(${re});`) : todo();
        case 'value': return exp ? ok(`await expect(${L})${not}.toHaveValue(${exp});`) : todo();
        case 'attribute': return exp !== undefined && a.attribute ? ok(`await expect(${L})${not}.toHaveAttribute(${q(a.attribute)}, ${exp});`) : todo();
        case 'count': return a.expected !== undefined ? ok(`await expect(${L})${not}.toHaveCount(${Number(a.expected)});`) : todo();
        case 'pageContains': return exp ? ok(`await expect(${ctx.page}.locator('body'))${not}.toContainText(${exp});`) : todo();
      }
      return todo();
    }
    case 'read': {
      switch (s.value) {
        case 'text': return ok(`return (await ${L}.textContent()) ?? '';`);
        case 'value': return ok(`return ${L}.inputValue();`);
        case 'attribute': return ok(`return (await ${L}.getAttribute(${q(s.valueExpr ?? '')})) ?? '';`);
        case 'visible': return ok(`return ${L}.isVisible();`);
        case 'enabled': return ok(`return ${L}.isEnabled();`);
        case 'count': return ok(`return ${L}.count();`);
        case 'title': return ok(`return ${ctx.page}.title();`);
        case 'url': return ok(`return ${ctx.page}.url();`);
      }
      return todo();
    }
    case 'call': {
      const c = s.call!;
      const target = ctx.callTarget?.(c.object);
      if (!target) return todo(`page object ${c.object} was not found in the estate`);
      let unresolved = false;
      const args = c.args.map((a) => {
        if (a.startsWith('"')) { try { return q(JSON.parse(a)); } catch { return a; } }
        if (ctx.params?.has(a)) return a;
        unresolved = true; return a;
      });
      if (unresolved) return todo('call argument is not a literal or parameter');
      return ok(`await ${target}.${c.method}(${args.join(', ')});`);
    }
    case 'unknown':
    default:
      return todo();
  }
}

/** Return type of a page method, derived from its trailing `read` step. */
export function methodReturnType(steps: Step[]): string {
  const r = [...steps].reverse().find((s) => s.kind === 'read');
  if (!r) return 'Promise<void>';
  if (r.value === 'visible' || r.value === 'enabled') return 'Promise<boolean>';
  if (r.value === 'count') return 'Promise<number>';
  return 'Promise<string>';
}

export function indent(lines: string[], n = 2): string[] { const pad = ' '.repeat(n); return lines.map((l) => (l ? pad + l : l)); }

export type ConversionStatus = 'converted' | 'partial' | 'manual';

/** Classify a body from its emitted steps: no TODOs -> converted; >=50% TODO (or all) -> manual; else partial. */
export function statusOf(total: number, todos: number): ConversionStatus {
  if (total === 0) return 'manual';
  if (todos === 0) return 'converted';
  if (todos * 2 >= total) return 'manual';
  return 'partial';
}
