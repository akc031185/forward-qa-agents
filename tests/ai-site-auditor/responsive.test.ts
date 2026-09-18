// Responsiveness is pure: raw measurements at each viewport in, judgements out. No browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  breaksBetweenBreakpoints, clippedText, disappearedContent, findViewport, MIN_TAP_PX,
  OVERSIZED_RATIO_LOW, overflowingWidths, overlappingTapTargets, oversizedImages, smallTapTargets,
  VIEWPORTS,
} from '../../src/agents/ai-site-auditor/responsive.js';
import type { ResponsiveRaw, TapTargetRaw } from '../../src/agents/ai-site-auditor/responsive.js';

const clean = (width: number): ResponsiveRaw => ({ width, scrollWidth: width, tapTargets: [], clipped: [], links: [], images: [] });
const cleanAll = (): ResponsiveRaw[] => VIEWPORTS.map(vp => clean(vp.width));
const target = (over: Partial<TapTargetRaw> = {}): TapTargetRaw => ({ sel: 'button.cta', x: 10, y: 10, w: 48, h: 48, ...over });

test('horizontal overflow: a couple of px of rounding is not a finding, real overflow is', () => {
  assert.deepEqual(overflowingWidths([clean(360)]), []);
  assert.deepEqual(overflowingWidths([{ ...clean(360), scrollWidth: 361 }]), [], 'within tolerance');
  assert.deepEqual(overflowingWidths([{ ...clean(360), scrollWidth: 500 }]), [{ width: 360, overflowPx: 140 }]);
  const many = overflowingWidths([{ ...clean(360), scrollWidth: 500 }, clean(768), { ...clean(1280), scrollWidth: 1300 }]);
  assert.deepEqual(many.map(h => h.width), [360, 1280]);
});

test('breaks between breakpoints: only counts when both named neighbours are clean', () => {
  // clean everywhere except the deliberately awkward 480px probe: exactly the "gap in the media query" case
  const raws = cleanAll().map(r => (r.width === 480 ? { ...r, scrollWidth: 520 } : r));
  assert.deepEqual(breaksBetweenBreakpoints(raws), [480]);

  // overflowing at 480 AND at its nearest named neighbour (390) too: this is not a "gap between
  // breakpoints" story, it is just broken, and the ordinary overflow check already reports it
  const alsoNarrow = cleanAll().map(r => (r.width === 480 || r.width === 390) ? { ...r, scrollWidth: r.width + 50 } : r);
  assert.deepEqual(breaksBetweenBreakpoints(alsoNarrow), [], 'overflow at a named neighbour disqualifies the between-breakpoint story');

  assert.deepEqual(breaksBetweenBreakpoints(cleanAll()), [], 'a fully clean site reports nothing');
});

test('tap targets: below 44px in either dimension is a hit; 44x44 exactly is fine', () => {
  const raw = { ...clean(390), tapTargets: [target({ w: 30, h: 48, sel: 'a.narrow' }), target({ w: 48, h: 20, sel: 'button.short' }), target({ w: 44, h: 44, sel: 'button.ok' }), target({ w: 60, h: 60, sel: 'a.big' })] };
  const hits = smallTapTargets(raw);
  assert.deepEqual(hits.map(h => h.sel).sort(), ['a.narrow', 'button.short']);
  assert.equal(MIN_TAP_PX, 44);
  assert.deepEqual(smallTapTargets(clean(390)), [], 'no targets, no findings');
  assert.equal(smallTapTargets({ ...clean(390), tapTargets: [target({ w: 30, h: 30 })] }, 20).length, 0, 'a caller-supplied threshold is honoured');
});

test('overlapping tap targets: genuine intersection only, not adjacency', () => {
  const touching = { ...clean(390), tapTargets: [target({ x: 0, y: 0, w: 50, h: 50, sel: 'a' }), target({ x: 50, y: 0, w: 50, h: 50, sel: 'b' })] };
  assert.deepEqual(overlappingTapTargets(touching), [], 'edges touching is not overlap');

  const overlapping = { ...clean(390), tapTargets: [target({ x: 0, y: 0, w: 50, h: 50, sel: 'a' }), target({ x: 20, y: 20, w: 50, h: 50, sel: 'b' })] };
  const hits = overlappingTapTargets(overlapping);
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0]!.a, hits[0]!.b], ['a', 'b']);

  const three = { ...clean(390), tapTargets: [target({ x: 0, y: 0, sel: 'a' }), target({ x: 5, y: 5, sel: 'b' }), target({ x: 200, y: 200, sel: 'c' })] };
  assert.equal(overlappingTapTargets(three).length, 1, 'a and b overlap, c stands alone');
});

test('clipped text: only the silent kind (no ellipsis) is a finding', () => {
  const raw = { ...clean(390), clipped: [{ sel: 'p.a', ellipsis: false, sample: 'cut off mid', overflowPx: 40 }, { sel: 'p.b', ellipsis: true, sample: 'truncated…', overflowPx: 20 }] };
  const hits = clippedText(raw);
  assert.deepEqual(hits.map(h => h.sel), ['p.a']);
  assert.equal(hits[0]!.width, 390);
});

test('disappearing content: gone outside nav with no replacement is a finding; nav collapse is not', () => {
  const wide = { ...clean(1440), links: [{ href: '/pricing', text: 'Pricing', region: 'main' as const }, { href: '/docs', text: 'Docs', region: 'nav' as const }] };
  const narrow = { ...clean(360), links: [{ href: '/docs', text: 'Docs', region: 'nav' as const }] };
  // /docs vanished from the flat list at 360 too, but it is a nav link (expected to fold into a
  // hamburger menu), and /pricing is genuinely gone
  const narrowNoNav = { ...clean(360), links: [] };
  assert.deepEqual(disappearedContent(wide, narrowNoNav).map(h => h.href), ['/pricing']);
  assert.deepEqual(disappearedContent(wide, narrow).map(h => h.href), ['/pricing'], 'nav links are never reported as vanished');
  assert.deepEqual(disappearedContent(wide, wide), [], 'nothing disappeared against itself');
});

test('oversized images: ratio of intrinsic to displayed pixels, banded by severity threshold', () => {
  const raw = { ...clean(360), images: [
    { src: '/hero.jpg', naturalWidth: 2000, naturalHeight: 1000, renderWidth: 200, renderHeight: 100 },   // 10x
    { src: '/icon.png', naturalWidth: 64, naturalHeight: 64, renderWidth: 48, renderHeight: 48 },          // 1.33x, fine
    { src: '/retina.png', naturalWidth: 400, naturalHeight: 400, renderWidth: 200, renderHeight: 200 },    // exactly 2x, a legitimate retina pull
  ] };
  const hits = oversizedImages(raw);
  assert.deepEqual(hits.map(h => h.src), ['/hero.jpg', '/retina.png']);
  assert.equal(hits.find(h => h.src === '/hero.jpg')!.ratio, 10);
  assert.equal(OVERSIZED_RATIO_LOW, 2);
  assert.deepEqual(oversizedImages(raw, 5), [{ src: '/hero.jpg', ratio: 10, naturalWidth: 2000, renderWidth: 200, width: 360 }], 'a stricter threshold drops the borderline retina image');
});

test('findViewport looks up by exact width', () => {
  const raws = cleanAll();
  assert.equal(findViewport(raws, 768)!.width, 768);
  assert.equal(findViewport(raws, 999), undefined);
});

test('overlapping tap targets: composition is not collision', () => {
  const at = (sel: string, x: number, y: number, w: number, h: number) => ({ sel, x, y, w, h });
  // a reveal button sitting wholly inside its input, which is how every password field works
  const contained = overlappingTapTargets({
    ...clean(390),
    tapTargets: [at('#password', 0, 0, 300, 48), at('button.reveal', 250, 8, 40, 32)],
  });
  assert.deepEqual(contained, [], 'a control inside another control is one target');

  // two buttons genuinely clipping each other: a thumb aiming at one can land on the other
  const collided = overlappingTapTargets({
    ...clean(390),
    tapTargets: [at('button.a', 0, 0, 120, 44), at('button.b', 100, 20, 120, 44)],
  });
  assert.equal(collided.length, 1, 'a partial overlap is still reported');
  assert.equal(collided[0]!.width, 390);
});
