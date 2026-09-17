// The design area is pure: raw measurements in, judgements out. No browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aaThreshold, buzzwordHits, contrastRatio, dominantFont, emDashDensity, emojiHeadings,
  failingContrast, fontTells, hueOf, luminance, parseColor, spacingOffScale, violetBlueGradients,
} from '../../src/agents/ai-site-auditor/design.js';

test('colour parsing and hue: rgb, rgba and hex, short and long', () => {
  assert.deepEqual(parseColor('rgb(124, 58, 237)'), [124, 58, 237]);
  assert.deepEqual(parseColor('rgba(59, 130, 246, 0.8)'), [59, 130, 246]);
  assert.deepEqual(parseColor('#7c3aed'), [124, 58, 237]);
  assert.deepEqual(parseColor('#abc'), [170, 187, 204]);
  assert.equal(parseColor('not a colour'), undefined);

  assert.equal(hueOf([124, 58, 237]).hue, 262, 'violet-500 sits in the tell band');
  assert.equal(hueOf([59, 130, 246]).hue, 217, 'blue-500');
  assert.equal(hueOf([255, 0, 0]).hue, 0, 'pure red');
  assert.equal(hueOf([128, 128, 128]).sat, 0, 'grey has no saturation');
});

test('violet-to-blue gradient: the signature needs both hues, and greys do not count', () => {
  const tell = violetBlueGradients(['linear-gradient(135deg, rgb(124, 58, 237) 0%, rgb(59, 130, 246) 100%)']);
  assert.equal(tell.length, 1);
  assert.ok(tell[0]!.hues.includes(262) && tell[0]!.hues.includes(217));

  assert.equal(violetBlueGradients(['linear-gradient(rgb(124, 58, 237), rgb(168, 85, 247))']).length, 0,
    'violet to violet is not the violet-to-blue tell');
  assert.equal(violetBlueGradients(['linear-gradient(rgb(255, 0, 0), rgb(255, 200, 0))']).length, 0, 'warm gradient');
  assert.equal(violetBlueGradients(['linear-gradient(rgb(20, 20, 20), rgb(40, 40, 45))']).length, 0,
    'desaturated near-greys are ignored');
  assert.equal(violetBlueGradients(['none']).length, 0);
});

test('contrast: WCAG ratios, AA thresholds and which samples fail', () => {
  assert.equal(luminance([255, 255, 255]), 1);
  assert.equal(luminance([0, 0, 0]), 0);
  assert.equal(contrastRatio('rgb(0,0,0)', 'rgb(255,255,255)'), 21, 'black on white is the maximum');
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.equal(contrastRatio('bogus', '#fff'), undefined);

  assert.equal(aaThreshold(16, false), 4.5, 'body text');
  assert.equal(aaThreshold(24, false), 3, 'large text');
  assert.equal(aaThreshold(19, true), 3, 'bold 18.66px counts as large');
  assert.equal(aaThreshold(19, false), 4.5, 'not bold, so still body text');

  // mid grey on near-black: the default generated dark theme
  const fails = failingContrast([
    { fg: 'rgb(115, 115, 115)', bg: 'rgb(10, 10, 10)', size: 16, bold: false, sample: 'muted body copy' },
    { fg: 'rgb(255, 255, 255)', bg: 'rgb(10, 10, 10)', size: 16, bold: false, sample: 'headline' },
  ]);
  assert.equal(fails.length, 1, 'only the grey sample fails');
  assert.equal(fails[0]!.sample, 'muted body copy');
  assert.ok(fails[0]!.ratio < 4.5 && fails[0]!.need === 4.5);
});

test('fonts: scaffold families flagged, dominant share computed', () => {
  const fonts: [string, number][] = [['Inter', 120], ['Instrument Serif', 6], ['Georgia', 2]];
  assert.deepEqual(fontTells(fonts).map(f => f.family), ['Inter', 'Instrument Serif']);
  assert.deepEqual(fontTells([['Georgia', 5]]), [], 'a normal face is not a tell');

  assert.deepEqual(dominantFont([['Inter', 99], ['Georgia', 1]]), { family: 'Inter', share: 0.99 });
  assert.equal(dominantFont([]), undefined);
});

test('emoji headings, buzzwords and em-dash density', () => {
  assert.deepEqual(emojiHeadings(['🚀 Ship faster', 'Plain heading', 'Pricing ✨']), ['🚀 Ship faster', 'Pricing ✨']);
  assert.deepEqual(emojiHeadings(['Nothing here']), []);

  const hits = buzzwordHits('Seamlessly supercharge your workflow with our cutting-edge platform.');
  assert.ok(hits.includes('seamlessly') && hits.includes('supercharge') && hits.includes('cutting-edge'));
  assert.deepEqual(buzzwordHits('We fix broken Playwright suites for teams of five to fifty.'), [],
    'specific copy trips nothing');

  const d = emDashDensity('One — two — three — four five six seven eight nine ten.');
  assert.equal(d.count, 3);
  assert.equal(d.words, 10);
  assert.equal(d.per1000, 300);
  assert.equal(emDashDensity('').count, 0, 'empty text never divides by zero');
  assert.equal(emDashDensity('').per1000, 0);
});

test('spacing: a page on an 8px scale is clean, scattered values are not', () => {
  assert.equal(spacingOffScale([8, 16, 24, 32, 48, 64]).share, 0, 'a real scale has nothing off it');
  const messy = spacingOffScale([7, 13, 18, 21, 26, 33, 41, 55]);
  assert.ok(messy.share >= 0.4, `expected mostly off-scale, got ${messy.share}`);
  assert.ok(messy.offScale.length > 0);
  assert.deepEqual(spacingOffScale([]), { offScale: [], share: 0 }, 'no values, no verdict');
});
