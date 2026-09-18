// Design tells: the things that make a site look like nobody touched the scaffold. The in-page
// script only measures (computed styles, CSSOM, element shapes); every threshold and judgement
// lives in the pure functions below, so the whole area is testable without a browser.
//
// Source for the tell list: three creator checklists a user collected (pre-launch, legal, and
// "20 reasons why your app looks vibecoded"). Each tell is countable — no model has an opinion.

/** Raw measurements from one rendered page. Shapes only; no judgement. */
export interface DesignRaw {
  gradientCss: string[];          // computed background-image values that contain a gradient
  gradientTextCount: number;      // elements painting text with a gradient (background-clip: text)
  headings: string[];             // h1–h3 text, for emoji and buzzword checks
  fonts: [string, number][];      // computed font-family → element count
  glassCount: number;             // backdrop-filter: blur(...)
  coloredBorderCards: number;     // card-like boxes whose border is a saturated colour
  iconRows: number;               // a row of exactly three icon+heading cells
  badgeAboveH1: boolean;          // small pill immediately before the first h1
  lucideIcons: number;            // <svg class="lucide-*"> or the Lucide stroke signature
  shadcnMarkers: number;          // untouched shadcn/ui class patterns
  scrollFadeCount: number;        // opacity:0 + transform + transition, or a known scroll-anim library
  cursorBeam: boolean;            // a CSS custom property driven by mousemove
  hoverOpacityRules: number;      // `:hover { opacity: … }` rules on buttons and links
  spacingPx: number[];            // padding and margin values actually used
  serifItalicCount: number;       // italic serif accent text
  contrastPairs: ContrastPair[];  // text colour over its effective background
  grainOverlay: boolean;          // SVG turbulence or a noise bitmap layered over a gradient
  darkBackground: boolean;        // the page paints a dark ground
}

export interface ContrastPair { fg: string; bg: string; size: number; bold: boolean; sample: string; sel?: string }

/**
 * Runs in the rendered page. Plain JavaScript source so no transpiler helpers leak in.
 * Signature: () => DesignRaw
 */
export const DESIGN_SCRIPT = String.raw`() => {
  const out = {
    gradientCss: [], gradientTextCount: 0, headings: [], fonts: [], glassCount: 0,
    coloredBorderCards: 0, iconRows: 0, badgeAboveH1: false, lucideIcons: 0, shadcnMarkers: 0,
    scrollFadeCount: 0, cursorBeam: false, hoverOpacityRules: 0, spacingPx: [], serifItalicCount: 0,
    contrastPairs: [], grainOverlay: false, darkBackground: false,
  };
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const all = Array.from(document.querySelectorAll('*')).slice(0, 4000);
  const fontCount = new Map();
  const gradients = new Set();
  const spacing = new Set();

  // effective background: walk up until an element paints something opaque
  const bgOf = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(c)) return c;
      n = n.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };

  for (const el of all) {
    let cs;
    try { cs = getComputedStyle(el); } catch (e) { continue; }
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' ? el.className : '';

    const bgImg = cs.backgroundImage || '';
    if (bgImg.indexOf('gradient(') > -1) {
      gradients.add(bgImg.slice(0, 400));
      const clip = cs.webkitBackgroundClip || cs.backgroundClip;
      if (clip === 'text') out.gradientTextCount++;
      // grain: a noise bitmap or SVG turbulence stacked on a gradient
      if (/url\((?:"|')?data:image\/(?:svg\+xml|png)/.test(bgImg) && /gradient\(/.test(bgImg)) out.grainOverlay = true;
    }
    if ((cs.backdropFilter || cs.webkitBackdropFilter || '').indexOf('blur') > -1) out.glassCount++;

    if (/^h[1-3]$/.test(tag)) { const t = norm(el.textContent); if (t) out.headings.push(t.slice(0, 200)); }

    if (el.childElementCount === 0 && norm(el.textContent)) {
      const fam = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
      if (fam) fontCount.set(fam, (fontCount.get(fam) || 0) + 1);
      if (cs.fontStyle === 'italic' && /serif/i.test(cs.fontFamily) && !/sans-serif/i.test((cs.fontFamily || '').split(',')[0])) out.serifItalicCount++;
      // contrast sample, capped
      if (out.contrastPairs.length < 60) {
        const size = parseFloat(cs.fontSize) || 16;
        const w = parseInt(cs.fontWeight, 10) || 400;
        {
          var txt = norm(el.textContent);
          // An emoji glyph paints in its own colours and ignores the CSS color property, so
          // measuring color against the background says nothing about whether it is legible.
          // Text that is nothing but emoji and punctuation is skipped rather than reported.
          var hasLetters = /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/.test(txt);
          if (hasLetters) {
            var sel = el.tagName.toLowerCase();
            if (el.id) sel += '#' + el.id;
            else if (typeof el.className === 'string' && el.className.trim()) sel += '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
            out.contrastPairs.push({ fg: cs.color, bg: bgOf(el), size: size, bold: w >= 700, sample: txt.slice(0, 60), sel: sel });
          }
        }
      }
    }

    for (const p of [cs.paddingTop, cs.paddingBottom, cs.marginTop, cs.marginBottom]) {
      const v = parseFloat(p); if (v > 0 && v < 400) spacing.add(Math.round(v));
    }

    if (tag === 'svg') {
      if (/lucide/i.test(cls) || (cs.strokeWidth === '2px' && el.getAttribute('stroke') === 'currentColor' && el.getAttribute('fill') === 'none')) out.lucideIcons++;
    }
    if (/\b(?:bg-background|text-foreground|bg-muted|text-muted-foreground|border-input|ring-offset-background|bg-primary|text-primary-foreground)\b/.test(cls)) out.shadcnMarkers++;

    // card with a saturated coloured border
    const bw = parseFloat(cs.borderTopWidth) || 0;
    if (bw > 0 && bw <= 4 && (parseFloat(cs.borderTopLeftRadius) || 0) >= 6 && el.childElementCount > 0) {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cs.borderTopColor || '');
      if (m) {
        const r = +m[1], g = +m[2], b = +m[3];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min > 40) out.coloredBorderCards++;
      }
    }

    // scroll-triggered fade-in
    if (el.hasAttribute('data-aos') || el.hasAttribute('data-framer-appear-id') || /\banimate-(?:fade|in)\b|\baos-init\b/.test(cls)) out.scrollFadeCount++;
    else if (parseFloat(cs.opacity) === 0 && (cs.transitionDuration || '0s') !== '0s' && (cs.transform || 'none') !== 'none') out.scrollFadeCount++;
  }

  out.gradientCss = Array.from(gradients).slice(0, 40);
  out.spacingPx = Array.from(spacing).sort((a, b) => a - b).slice(0, 80);
  out.fonts = Array.from(fontCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // three-across icon rows
  const rows = Array.from(document.querySelectorAll('div,section,ul')).slice(0, 1500);
  for (const row of rows) {
    const kids = Array.from(row.children);
    if (kids.length !== 3) continue;
    const iconish = kids.filter((k) => k.querySelector('svg,img') && k.querySelector('h1,h2,h3,h4,strong,p'));
    if (iconish.length === 3) out.iconRows++;
  }

  // badge pill directly above the first headline
  const h1 = document.querySelector('h1');
  if (h1) {
    let prev = h1.previousElementSibling;
    if (!prev && h1.parentElement) prev = h1.parentElement.previousElementSibling;
    if (prev) {
      let pcs; try { pcs = getComputedStyle(prev); } catch (e) { pcs = null; }
      const txt = norm(prev.textContent);
      if (pcs && txt && txt.length <= 40 && parseFloat(pcs.borderTopLeftRadius) >= 9 && parseFloat(pcs.fontSize) <= 15) out.badgeAboveH1 = true;
    }
  }

  // dark ground
  const bodyBg = getComputedStyle(document.body || document.documentElement).backgroundColor;
  const bm = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bodyBg || '');
  if (bm) out.darkBackground = (+bm[1] * 0.299 + +bm[2] * 0.587 + +bm[3] * 0.114) < 96;

  // stylesheet-level tells: hover opacity, cursor-tracking custom properties
  let cssText = '';
  for (const sheet of Array.from(document.styleSheets)) {
    let rules; try { rules = sheet.cssRules; } catch (e) { continue; }  // cross-origin
    if (!rules) continue;
    for (const rule of Array.from(rules).slice(0, 4000)) {
      const t = rule.cssText || '';
      cssText += t.length > 400 ? t.slice(0, 400) : t;
      if (/:hover[^{]*\{[^}]*opacity\s*:/.test(t) && /button|\.btn|a[:.\s]/i.test(t)) out.hoverOpacityRules++;
    }
  }
  if (/--(?:mouse|cursor|pointer)-?(?:x|y)\b/i.test(cssText)) out.cursorBeam = true;
  if (!out.grainOverlay && /feTurbulence|baseFrequency/i.test(document.documentElement.innerHTML.slice(0, 200000))) {
    if (out.gradientCss.length) out.grainOverlay = true;
  }
  return out;
}`;

// ── pure analysis ───────────────────────────────────────────────────────────

/** Parse `rgb()`, `rgba()` or `#rrggbb` into 0–255 channels. */
export function parseColor(css: string): [number, number, number] | undefined {
  const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css);
  if (rgb) return [+rgb[1]!, +rgb[2]!, +rgb[3]!];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(css.trim());
  if (!hex) return undefined;
  const h = hex[1]!.length === 3 ? hex[1]!.split('').map(c => c + c).join('') : hex[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Hue in degrees, plus saturation, from RGB. */
export function hueOf(rgb: [number, number, number]): { hue: number; sat: number } {
  const [r, g, b] = rgb.map(v => v / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
  }
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return { hue, sat: max === 0 ? 0 : d / max };
}

/** Relative luminance, WCAG 2.x. */
export function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(fg: string, bg: string): number | undefined {
  const a = parseColor(fg), b = parseColor(bg);
  if (!a || !b) return undefined;
  const l1 = luminance(a), l2 = luminance(b);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}

/** WCAG AA threshold: 3.0 for large text (>=24px, or >=18.66px bold), otherwise 4.5. */
export function aaThreshold(size: number, bold: boolean): number {
  return size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
}

/** Text that fails AA against its own background. */
export function failingContrast(pairs: ContrastPair[]): { sample: string; sel?: string; ratio: number; need: number }[] {
  const out: { sample: string; sel?: string; ratio: number; need: number }[] = [];
  for (const p of pairs) {
    const ratio = contrastRatio(p.fg, p.bg);
    if (ratio === undefined) continue;
    const need = aaThreshold(p.size, p.bold);
    if (ratio < need) out.push({ sample: p.sample, sel: p.sel, ratio, need });
  }
  return out.sort((a, b) => a.ratio - b.ratio).slice(0, 10);
}

/** Hue 250–290 is the indigo/violet the scaffolds ship; paired with blue it is the signature. */
export const VIOLET = [250, 290] as const;
export const BLUE = [200, 250] as const;
const inRange = (h: number, [lo, hi]: readonly [number, number]) => h >= lo && h <= hi;

/** A gradient that runs violet→blue, the single most recognisable AI-builder tell. */
export function violetBlueGradients(gradientCss: string[]): { css: string; hues: number[] }[] {
  const out: { css: string; hues: number[] }[] = [];
  for (const css of gradientCss) {
    const hues: number[] = [];
    for (const m of css.matchAll(/rgba?\([^)]+\)|#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
      const c = parseColor(m[0]);
      if (!c) continue;
      const { hue, sat } = hueOf(c);
      if (sat >= 0.15) hues.push(hue);
    }
    const hasViolet = hues.some(h => inRange(h, VIOLET));
    const hasBlue = hues.some(h => inRange(h, BLUE));
    if (hasViolet && hasBlue) out.push({ css: css.slice(0, 160), hues });
  }
  return out;
}

/** The fonts every generated site reaches for. */
export const TELL_FONTS = ['inter', 'space grotesk', 'instrument serif', 'geist', 'plus jakarta sans'];

export function fontTells(fonts: [string, number][]): { family: string; count: number }[] {
  return fonts.filter(([f]) => TELL_FONTS.includes(f.toLowerCase())).map(([family, count]) => ({ family, count }));
}

/** Share of text elements using the single most common family. */
export function dominantFont(fonts: [string, number][]): { family: string; share: number } | undefined {
  const total = fonts.reduce((n, [, c]) => n + c, 0);
  if (!total || !fonts.length) return undefined;
  const [family, count] = fonts[0]!;
  return { family, share: Math.round((count / total) * 100) / 100 };
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

export function emojiHeadings(headings: string[]): string[] {
  return headings.filter(h => EMOJI.test(h)).slice(0, 10);
}

/** Copy that says nothing. Counted, not judged: a hit is a phrase from this list. */
export const BUZZWORDS = [
  'seamless', 'seamlessly', 'unlock the power', 'unleash', 'supercharge', 'game-changing',
  'cutting-edge', 'next-generation', 'revolutionise', 'revolutionize', 'elevate your',
  'transform your', 'effortlessly', 'powerful and intuitive', 'built for the future',
  'take it to the next level', 'best-in-class', 'world-class', 'robust and scalable',
  'empower your', 'streamline your workflow', 'harness the power',
];

export function buzzwordHits(text: string): string[] {
  const lower = text.toLowerCase();
  return BUZZWORDS.filter(b => lower.includes(b));
}

/** Em dashes per thousand words: the tell is density, not presence. */
export function emDashDensity(text: string): { count: number; per1000: number; words: number } {
  const count = (text.match(/—/g) ?? []).length;
  const words = text.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
  const per1000 = words ? Math.round((count / words) * 1000 * 10) / 10 : 0;
  return { count, per1000, words };
}

/**
 * Spacing consistency. A designed page reuses a scale (4/8/12/16/24…); a generated one
 * scatters arbitrary values. Returns the share of used values that sit off any common scale.
 */
export function spacingOffScale(values: number[]): { offScale: number[]; share: number } {
  if (!values.length) return { offScale: [], share: 0 };
  const scales = [4, 5, 6, 8];
  const best = scales
    .map(step => ({ step, off: values.filter(v => v % step !== 0) }))
    .sort((a, b) => a.off.length - b.off.length)[0]!;
  return { offScale: best.off.slice(0, 12), share: Math.round((best.off.length / values.length) * 100) / 100 };
}
