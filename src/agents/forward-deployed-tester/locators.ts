// Pure locator derivation. No browser, no I/O: takes a descriptor harvested from the
// accessibility tree / DOM and returns the best Playwright locator expression.

export interface ElementDescriptor {
  tag: string;                 // lowercase tag name
  type?: string;               // input type, lowercase
  role?: string;               // explicit role attribute
  name?: string;               // computed accessible name
  label?: string;              // text of an associated <label>
  placeholder?: string;
  text?: string;               // visible text content (trimmed)
  testId?: string;             // data-testid / data-test-id / data-test / data-cy
  id?: string;
  nameAttr?: string;           // name="" attribute
  classes?: string[];
  href?: string;
}

export type LocatorStrategy = 'role' | 'label' | 'placeholder' | 'text' | 'testid' | 'css';

export interface DerivedLocator {
  strategy: LocatorStrategy;
  code: string;                       // e.g. page.getByRole('button', { name: "Sign in" })
  confidence: 'high' | 'medium' | 'low';
  role?: string;
  name?: string;
}

const MAX_NAME = 80;

export function normaliseText(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > MAX_NAME ? t.slice(0, MAX_NAME).trim() : t;
}

/** Implicit ARIA role for common HTML elements (subset of the HTML-AAM mapping). */
export function implicitRole(tag: string, type?: string, href?: string): string | undefined {
  const t = tag.toLowerCase();
  switch (t) {
    case 'a': case 'area': return href ? 'link' : undefined;
    case 'button': return 'button';
    case 'summary': return 'button';
    case 'select': return 'combobox';
    case 'textarea': return 'textbox';
    case 'img': return 'img';
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading';
    case 'nav': return 'navigation';
    case 'main': return 'main';
    case 'form': return 'form';
    case 'input': {
      const ty = (type ?? 'text').toLowerCase();
      switch (ty) {
        case 'button': case 'submit': case 'reset': case 'image': return 'button';
        case 'checkbox': return 'checkbox';
        case 'radio': return 'radio';
        case 'range': return 'slider';
        case 'number': return 'spinbutton';
        case 'search': return 'searchbox';
        case 'email': case 'tel': case 'text': case 'url': case 'password': return 'textbox';
        default: return undefined; // date/color/file etc. have no stable role
      }
    }
    default: return undefined;
  }
}

function q(s: string): string { return JSON.stringify(s); }

function cssEscapeIdent(s: string): string {
  return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

function looksGenerated(s: string): boolean {
  // ids/classes like "ember123", "css-1x2y3z", ":r1:", "sc-abc123", pure hashes
  return /^:|^(ember|react|mui|css|sc|jss|svelte|chakra|radix)[-_]?[a-z0-9]{3,}$|^[a-f0-9]{8,}$|\d{4,}/i.test(s);
}

/** Pick the best Playwright locator for an element, in Playwright's recommended priority order. */
export function deriveLocator(el: ElementDescriptor): DerivedLocator {
  const tag = el.tag.toLowerCase();
  const role = el.role?.toLowerCase() || implicitRole(tag, el.type, el.href);
  const name = normaliseText(el.name) ?? normaliseText(el.label) ?? normaliseText(el.text);
  const label = normaliseText(el.label);
  const placeholder = normaliseText(el.placeholder);
  const text = normaliseText(el.text);
  const testId = normaliseText(el.testId);

  if (role && name) {
    return { strategy: 'role', code: `page.getByRole(${q(role)}, { name: ${q(name)}, exact: true })`, confidence: 'high', role, name };
  }
  if (label) {
    return { strategy: 'label', code: `page.getByLabel(${q(label)}, { exact: true })`, confidence: 'high', role, name: label };
  }
  if (placeholder) {
    return { strategy: 'placeholder', code: `page.getByPlaceholder(${q(placeholder)}, { exact: true })`, confidence: 'high', role, name: placeholder };
  }
  if (text && ['a', 'button', 'summary', 'label', 'span', 'div', 'li', 'p'].includes(tag)) {
    return { strategy: 'text', code: `page.getByText(${q(text)}, { exact: true })`, confidence: 'medium', role, name: text };
  }
  if (testId) {
    return { strategy: 'testid', code: `page.getByTestId(${q(testId)})`, confidence: 'medium', role, name: testId };
  }
  // Role without a name is still better than raw CSS when it is the only such element type.
  if (role && !['link', 'button'].includes(role) && !el.id && !el.nameAttr) {
    return { strategy: 'role', code: `page.getByRole(${q(role)})`, confidence: 'low', role };
  }
  // CSS fallbacks, most stable first.
  if (el.id && !looksGenerated(el.id)) {
    return { strategy: 'css', code: `page.locator(${q('#' + cssEscapeIdent(el.id))})`, confidence: 'medium', role };
  }
  if (el.nameAttr) {
    return { strategy: 'css', code: `page.locator(${q(`${tag}[name="${el.nameAttr}"]`)})`, confidence: 'medium', role };
  }
  const stableClasses = (el.classes ?? []).filter(c => c && !looksGenerated(c)).slice(0, 2);
  if (stableClasses.length) {
    return { strategy: 'css', code: `page.locator(${q(`${tag}.${stableClasses.map(cssEscapeIdent).join('.')}`)})`, confidence: 'low', role };
  }
  const typeSel = el.type ? `${tag}[type="${el.type}"]` : tag;
  return { strategy: 'css', code: `page.locator(${q(typeSel)})`, confidence: 'low', role };
}

const RESERVED = new Set(['page', 'goto', 'path', 'constructor', 'class', 'default', 'delete', 'export', 'import',
  'new', 'return', 'super', 'this', 'throw', 'typeof', 'void', 'with', 'yield', 'let', 'var', 'const', 'function',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'in', 'of', 'try', 'catch', 'finally',
  'null', 'true', 'false', 'enum', 'static', 'await', 'async']);

export function toCamelCase(s: string): string {
  const words = s.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return '';
  return words.map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))).join('');
}

export function toPascalCase(s: string): string {
  const c = toCamelCase(s);
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : '';
}

const ROLE_SUFFIX: Record<string, string> = {
  button: 'Button', link: 'Link', textbox: 'Input', searchbox: 'Search', combobox: 'Select', checkbox: 'Checkbox',
  radio: 'Radio', slider: 'Slider', spinbutton: 'Input', tab: 'Tab', menuitem: 'MenuItem', img: 'Image', heading: 'Heading',
};

/** A valid, readable TypeScript identifier for a page-object property. */
export function toPropertyName(el: ElementDescriptor, loc: DerivedLocator): string {
  const base = loc.name ?? normaliseText(el.testId) ?? normaliseText(el.id) ?? normaliseText(el.nameAttr) ?? el.tag;
  let ident = toCamelCase(base.slice(0, 40));
  const suffix = ROLE_SUFFIX[loc.role ?? ''] ?? (el.tag === 'input' ? 'Input' : toPascalCase(el.tag));
  if (!ident.toLowerCase().endsWith(suffix.toLowerCase())) ident += suffix;
  if (!ident || /^[0-9]/.test(ident)) ident = 'el' + toPascalCase(ident || 'element');
  if (RESERVED.has(ident)) ident += 'El';
  return ident;
}

/** Dedupe identifiers within one page object by appending 2, 3, ... */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map(n => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count === 0 ? n : `${n}${count + 1}`;
  });
}
