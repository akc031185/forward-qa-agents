// Launch readiness is pure: measurements in, judgements out. No browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyThirdParty, findPolicies, formProblems, looksCommercial, trackingThirdParty, unhelpful404,
} from '../../src/agents/ai-site-auditor/essentials.js';
import type { FormRaw } from '../../src/agents/ai-site-auditor/essentials.js';

const L = (href: string, text = '') => ({ href, text });

test('policies: found by path or by link text, and absence is reported per policy', () => {
  const found = findPolicies([
    L('https://a.test/privacy-policy', 'Privacy'),
    L('https://a.test/legal/tos', 'Terms & conditions'),
    L('https://a.test/x', 'Delete your account'),
  ]);
  assert.ok(found.privacy, 'matched on path');
  assert.ok(found.terms, 'matched /tos on path');
  assert.ok(found.deletion, 'matched on link text alone');
  assert.equal(found.cookies, undefined);
  assert.equal(found.refund, undefined);

  // a word inside another word must not count
  const none = findPolicies([L('https://a.test/privacy-first-design', 'Our approach')]);
  assert.ok(none.privacy, 'path contains privacy, which is the honest reading of a link');
  assert.equal(findPolicies([L('https://a.test/', 'Home')]).privacy, undefined);
  assert.equal(findPolicies([]).terms, undefined, 'no links, no policies');
});

test('commercial intent decides whether a refund policy is expected', () => {
  assert.equal(looksCommercial('Plans start at $19 per month, billed annually.', []), true);
  assert.equal(looksCommercial('', [L('https://a.test/checkout')]), true);
  assert.equal(looksCommercial('', [L('https://a.test/pricing')]), true);
  assert.equal(looksCommercial('We write about testing.', [L('https://a.test/blog')]), false,
    'a content site is not asked for a refund policy');
});

test('third parties are classified, and only the tracking ones need consent', () => {
  const origins = [
    'https://www.googletagmanager.com', 'https://fonts.gstatic.com', 'https://js.stripe.com',
    'https://static.hotjar.com', 'https://cdn.example.test',
  ];
  const kinds = Object.fromEntries(classifyThirdParty(origins).map(t => [t.origin, t.kind]));
  assert.equal(kinds['https://www.googletagmanager.com'], 'analytics');
  assert.equal(kinds['https://fonts.gstatic.com'], 'fonts');
  assert.equal(kinds['https://js.stripe.com'], 'payments');
  assert.equal(kinds['https://static.hotjar.com'], 'session recording');
  assert.equal(kinds['https://cdn.example.test'], 'other');

  const gated = trackingThirdParty(origins).map(t => t.origin);
  assert.deepEqual(gated, ['https://www.googletagmanager.com', 'https://static.hotjar.com'],
    'fonts, payments and a plain CDN do not need a consent gate');
  assert.deepEqual(trackingThirdParty([]), []);
});

const form = (over: Partial<FormRaw> = {}): FormRaw => ({
  action: '/subscribe', method: 'post', fields: 3, required: 3, emailTyped: 1, labelled: 3,
  novalidate: false, consentCheckbox: false, captcha: true, honeypot: false, ...over,
});

test('forms: the expensive defect is a form that goes nowhere', () => {
  const nowhere = formProblems([form({ action: '' })]);
  assert.ok(nowhere.some(p => p.kind === 'goes-nowhere'));
  assert.match(nowhere.find(p => p.kind === 'goes-nowhere')!.detail, /no action attribute/);

  assert.deepEqual(formProblems([form()]), [], 'a complete form reports nothing');
  assert.deepEqual(formProblems([form({ fields: 0, required: 0, labelled: 0 })]), [],
    'a form with no visible fields is not judged');

  assert.ok(formProblems([form({ required: 0 })]).some(p => p.kind === 'no-required'));
  assert.ok(formProblems([form({ required: 0, novalidate: true })]).some(p => p.kind === 'no-validation'));
  assert.ok(formProblems([form({ labelled: 1 })]).some(p => p.kind === 'unlabelled'));

  const spam = formProblems([form({ captcha: false, honeypot: false })]);
  assert.ok(spam.some(p => p.kind === 'no-spam-protection'));
  assert.ok(!formProblems([form({ captcha: false, honeypot: true })]).some(p => p.kind === 'no-spam-protection'),
    'a honeypot counts as protection');
  assert.ok(!formProblems([form({ captcha: false, honeypot: false, fields: 1 })]).some(p => p.kind === 'no-spam-protection'),
    'a single-field form, such as a search box, is not a spam target worth flagging');
});

test('404: right status but nothing usable on the page', () => {
  assert.equal(unhelpful404(404, 'Not found', 4, 0), true, 'bare 404');
  assert.equal(unhelpful404(404, '404', 60, 9), true, 'a bare title is the tell even with content');
  assert.equal(unhelpful404(404, 'Page not found — Acme', 60, 9), false, 'branded, with links out');
  assert.equal(unhelpful404(200, 'Not found', 4, 0), false, 'a soft 404 is a different finding');
});
