// Responsiveness: does the layout survive a phone, a tablet and a laptop, or was it only ever
// looked at on the desktop the site was built on? Same split as design.ts and essentials.ts — the
// in-page script only measures (at a viewport size the caller has already set), and every
// threshold and judgement is a pure function below, so the whole area is testable without a
// browser.
//
// Widths: 360 and 390 (small and common phones), 768 (tablet), 1280 and 1440 (laptop/desktop) are
// the ones asked for. Two more — 480 and 1024 — sit deliberately *between* those, so a layout that
// was only ever checked at the named breakpoints (a `@media` rule with a gap in it) shows up as
// breakage nobody would otherwise catch. See `breaksBetweenBreakpoints`.

export interface Viewport { width: number; height: number; label: string }

/** Reflow-only: the caller resizes an already-loaded page, so this costs a layout pass, not a navigation. */
export const VIEWPORTS: Viewport[] = [
  { width: 360, height: 780, label: 'small phone' },
  { width: 390, height: 844, label: 'phone' },
  { width: 480, height: 900, label: 'between phone and tablet' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1024, height: 800, label: 'between tablet and laptop' },
  { width: 1280, height: 800, label: 'laptop' },
  { width: 1440, height: 900, label: 'desktop' },
];
/** The widths a design is normally checked at. */
export const NAMED_WIDTHS = new Set([360, 390, 768, 1280, 1440]);
/** The widths nobody usually checks. */
export const BETWEEN_WIDTHS = new Set([480, 1024]);
/** The narrowest and widest probes, used as the reference pair for "does this vanish on mobile". */
export const NARROWEST_WIDTH = 360;
export const WIDEST_WIDTH = 1440;
/** A representative touch viewport for tap-target sizing (desktop pointers do not need 44px). */
export const TOUCH_WIDTH = 390;

/** Auditing every page of a large site at seven viewports each is not worth the render time; a
 * shared template repeats its layout bugs anyway, so only the first few pages pay for this pass. */
export const RESPONSIVE_MAX_PAGES = 5;

export interface TapTargetRaw { sel: string; x: number; y: number; w: number; h: number }
export interface ClippedRaw { sel: string; ellipsis: boolean; sample: string; overflowPx: number }
export interface LinkRaw { href: string; text: string; region: 'nav' | 'main' | 'footer' }
export interface ImageRaw { src: string; naturalWidth: number; naturalHeight: number; renderWidth: number; renderHeight: number }

/** Raw measurements at one viewport. Shapes only; no judgement. */
export interface ResponsiveRaw {
  width: number;
  scrollWidth: number;            // document.scrollingElement.scrollWidth: > width means horizontal overflow
  tapTargets: TapTargetRaw[];
  clipped: ClippedRaw[];
  links: LinkRaw[];
  images: ImageRaw[];
}

/**
 * Runs in the rendered page, after the caller has already called `page.setViewportSize(...)`.
 * Plain JavaScript source so no transpiler helpers leak in. Signature: () => ResponsiveRaw
 */
export const RESPONSIVE_SCRIPT = String.raw`() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const vw = window.innerWidth;
  const scroller = document.scrollingElement || document.documentElement;
  const scrollWidth = scroller ? scroller.scrollWidth : vw;

  const isVisible = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      let cs; try { cs = getComputedStyle(n); } catch (e) { return false; }
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
      n = n.parentElement;
    }
    return true;
  };
  const onscreen = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0;
  const selOf = (el) => {
    if (el.id) return '#' + el.id;
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };

  // tap targets: anything a visitor is meant to tap as its own discrete target. A plain inline
  // text link ("see our <a href>terms</a> for details") is excluded on purpose: it flows with the
  // sentence around it rather than standing alone the way a button, nav item or icon link does,
  // and the 44px guidance was never meant to apply to it — otherwise nearly every inline link on
  // the ordinary web would fail this check.
  const tapTargets = [];
  const interactive = Array.from(document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[onclick]')).slice(0, 500);
  for (const el of interactive) {
    if (!isVisible(el)) continue;
    let cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (el.tagName.toLowerCase() === 'a' && cs.display === 'inline') continue;
    let r; try { r = el.getBoundingClientRect(); } catch (e) { continue; }
    if (!onscreen(r)) continue;
    tapTargets.push({ sel: selOf(el), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  }

  // clipped or unreadable text: leaf text nodes whose own box hides an overflow
  const clipped = [];
  const textEls = Array.from(document.querySelectorAll('p,span,div,li,h1,h2,h3,h4,h5,a,button,td,dd,figcaption')).slice(0, 2500);
  for (const el of textEls) {
    if (el.childElementCount > 0) continue;
    const t = norm(el.textContent);
    if (!t) continue;
    let cs; try { cs = getComputedStyle(el); } catch (e) { continue; }
    if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden' && cs.overflowY !== 'hidden') continue;
    const sw = el.scrollWidth, cw = el.clientWidth, sh = el.scrollHeight, ch = el.clientHeight;
    const overflowPx = Math.max(sw - cw, sh - ch);
    if (overflowPx <= 2) continue;
    clipped.push({ sel: selOf(el), ellipsis: cs.textOverflow === 'ellipsis', sample: t.slice(0, 60), overflowPx: Math.round(overflowPx) });
    if (clipped.length >= 30) break;
  }

  // reachable links, tagged by region: a link that collapses behind a nav's own hamburger toggle
  // is normal responsive design, not vanished content, so region is recorded rather than judged here.
  const links = [];
  for (const a of Array.from(document.querySelectorAll('a[href]')).slice(0, 400)) {
    if (!isVisible(a)) continue;
    let r; try { r = a.getBoundingClientRect(); } catch (e) { continue; }
    if (!onscreen(r)) continue;
    const region = a.closest('nav,header') ? 'nav' : a.closest('footer') ? 'footer' : 'main';
    links.push({ href: a.getAttribute('href') || '', text: norm(a.textContent).slice(0, 60), region: region });
    if (links.length >= 200) break;
  }

  // images: intrinsic pixels versus the box they are actually drawn into
  const images = [];
  for (const img of Array.from(document.querySelectorAll('img')).slice(0, 100)) {
    if (!isVisible(img)) continue;
    let r; try { r = img.getBoundingClientRect(); } catch (e) { continue; }
    if (r.width < 4 || r.height < 4) continue;
    const nw = img.naturalWidth || 0, nh = img.naturalHeight || 0;
    if (!nw || !nh) continue;
    images.push({ src: (img.currentSrc || img.src || '').slice(0, 200), naturalWidth: nw, naturalHeight: nh, renderWidth: Math.round(r.width), renderHeight: Math.round(r.height) });
    if (images.length >= 60) break;
  }

  return { width: vw, scrollWidth: scrollWidth, tapTargets: tapTargets, clipped: clipped, links: links, images: images };
}`;

// ── pure analysis ───────────────────────────────────────────────────────────

/** A couple of CSS px of slack: sub-pixel layout rounding must never itself be a finding. */
export const OVERFLOW_TOLERANCE_PX = 2;
/** Apple HIG and Google's Material guidance both land on 44 CSS px as the comfortable minimum. */
export const MIN_TAP_PX = 44;
/** An image at 2x its rendered width is exactly one retina pull — legitimate. Above that is waste. */
export const OVERSIZED_RATIO_LOW = 2;
/** Beyond 4x rendered size no plausible pixel density justifies it. */
export const OVERSIZED_RATIO_HIGH = 4;

export interface OverflowHit { width: number; overflowPx: number }

/** Widths where the document is wider than the viewport: a visitor must scroll sideways to read it. */
export function overflowingWidths(raws: ResponsiveRaw[]): OverflowHit[] {
  return raws
    .filter(r => r.scrollWidth - r.width > OVERFLOW_TOLERANCE_PX)
    .map(r => ({ width: r.width, overflowPx: r.scrollWidth - r.width }));
}

/**
 * Overflow that appears only at a width nobody normally tests (480, 1024) while both of its
 * named neighbours are clean. That pattern means the layout was built and checked at fixed
 * breakpoints and never verified in between — a `@media` rule with a gap in it, not a fluid design.
 */
export function breaksBetweenBreakpoints(raws: ResponsiveRaw[]): number[] {
  const overflowing = new Set(overflowingWidths(raws).map(h => h.width));
  const namedSorted = raws.map(r => r.width).filter(w => NAMED_WIDTHS.has(w)).sort((a, b) => a - b);
  const out: number[] = [];
  for (const r of raws) {
    if (!BETWEEN_WIDTHS.has(r.width) || !overflowing.has(r.width)) continue;
    const lower = [...namedSorted].reverse().find(w => w < r.width);
    const upper = namedSorted.find(w => w > r.width);
    const lowerClean = lower === undefined || !overflowing.has(lower);
    const upperClean = upper === undefined || !overflowing.has(upper);
    if (lowerClean && upperClean) out.push(r.width);
  }
  return out;
}

export interface TapTargetHit { sel: string; w: number; h: number; width: number }

/** Interactive elements smaller than the comfortable touch minimum in either dimension. */
export function smallTapTargets(raw: ResponsiveRaw, min = MIN_TAP_PX): TapTargetHit[] {
  return raw.tapTargets
    .filter(t => t.w < min || t.h < min)
    .map(t => ({ sel: t.sel, w: t.w, h: t.h, width: raw.width }));
}

function rectsOverlap(a: TapTargetRaw, b: TapTargetRaw): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export interface OverlapHit { a: string; b: string; width: number }

/** Two tap targets whose boxes genuinely intersect: a thumb aiming at one can land on both. */
export function overlappingTapTargets(raw: ResponsiveRaw): OverlapHit[] {
  const out: OverlapHit[] = [];
  const t = raw.tapTargets;
  for (let i = 0; i < t.length && out.length < 20; i++) {
    for (let j = i + 1; j < t.length && out.length < 20; j++) {
      if (rectsOverlap(t[i]!, t[j]!)) out.push({ a: t[i]!.sel, b: t[j]!.sel, width: raw.width });
    }
  }
  return out;
}

export interface ClipHit { sel: string; width: number; sample: string }

/** Text cut off mid-word with no ellipsis: `text-overflow: ellipsis` is a deliberate, readable
 * truncation, so only the silent kind — content simply gone with no indication — is a finding. */
export function clippedText(raw: ResponsiveRaw): ClipHit[] {
  return raw.clipped
    .filter(c => !c.ellipsis)
    .map(c => ({ sel: c.sel, width: raw.width, sample: c.sample }));
}

export interface DisappearHit { href: string; text: string; atWidth: number }

/**
 * A link reachable at the wide reference viewport that is gone at the narrow one, with nothing
 * at the same href to replace it. `nav`/`header` links are excluded on purpose: collapsing the
 * primary navigation behind a hamburger toggle is ordinary, correct responsive design, and a
 * static check cannot tell "gone" from "one tap away inside the toggle".
 */
export function disappearedContent(wide: ResponsiveRaw, narrow: ResponsiveRaw): DisappearHit[] {
  const stillThere = new Set(narrow.links.map(l => l.href));
  const out: DisappearHit[] = [];
  for (const l of wide.links) {
    if (l.region === 'nav' || !l.href || stillThere.has(l.href)) continue;
    out.push({ href: l.href, text: l.text, atWidth: narrow.width });
    if (out.length >= 20) break;
  }
  return out;
}

export interface OversizedImageHit { src: string; ratio: number; naturalWidth: number; renderWidth: number; width: number }

/** Images whose intrinsic pixels far exceed the box they are actually drawn into: full weight, wasted. */
export function oversizedImages(raw: ResponsiveRaw, threshold = OVERSIZED_RATIO_LOW): OversizedImageHit[] {
  const out: OversizedImageHit[] = [];
  for (const im of raw.images) {
    if (im.renderWidth <= 0) continue;
    const ratio = im.naturalWidth / im.renderWidth;
    if (ratio >= threshold) out.push({ src: im.src, ratio: Math.round(ratio * 10) / 10, naturalWidth: im.naturalWidth, renderWidth: im.renderWidth, width: raw.width });
  }
  return out.slice(0, 20);
}

export function findViewport(raws: ResponsiveRaw[], width: number): ResponsiveRaw | undefined {
  return raws.find(r => r.width === width);
}
