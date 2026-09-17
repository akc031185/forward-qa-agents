// Launch readiness is pure: measurements in, judgements out. No browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyThirdParty, findPolicies, formProblems, looksCommercial, trackingThirdParty, unhelpful404,
} from '../../src/agents/ai-site-auditor/essentials.js';
import type { FormRaw } from '../../src/agents/ai-site-auditor/essentials.js';
import { auditDate, effortOf, evidenceHtml, fixPlan, isEmptyEvidence, labelKey } from '../../src/agents/ai-site-auditor/report.js';
import type { CheckResult } from '../../src/agents/ai-site-auditor/types.js';

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
  novalidate: false, consentCheckbox: false, captcha: true, honeypot: false, inlineSubmitHandler: false, ...over,
});

test('forms: a missing action is unverifiable, not proof of a defect', () => {
  const bare = formProblems([form({ action: '' })]);
  assert.ok(bare.some(p => p.kind === 'unverifiable-submit'));
  assert.match(bare.find(p => p.kind === 'unverifiable-submit')!.detail, /nothing in the page shows where a submission goes/);

  // a React form wired with onSubmit works perfectly well with no action attribute, and an audit
  // that calls that broken is wrong
  assert.ok(!formProblems([form({ action: '', inlineSubmitHandler: true })]).some(p => p.kind === 'unverifiable-submit'),
    'an inline handler proves something receives the submit');
  assert.ok(!formProblems([form({ action: '/subscribe' })]).some(p => p.kind === 'unverifiable-submit'),
    'an action attribute is proof enough');

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

// ── the fix plan ────────────────────────────────────────────────────────────
const check = (id: string, severity: CheckResult['severity'], area: CheckResult['area'] = 'build'): CheckResult =>
  ({ id, area, severity, title: id, why: 'w', fix: 'f' });

test('fix plan: severity leads, then the quickest fix, and the order is total', () => {
  const plan = fixPlan([
    check('design.emoji-headings', 'low', 'design'),            // low, quick
    check('build.secret-in-javascript', 'critical'),            // critical, project
    check('seo.missing-title', 'high', 'search'),               // high, quick
    check('ai.content-needs-javascript', 'critical', 'ai-visibility'), // critical, project
    check('readiness.no-privacy-policy', 'high', 'readiness'),  // high, medium
  ]);
  assert.deepEqual(plan.map(i => i.result.id), [
    'ai.content-needs-javascript',   // critical before everything; ai-visibility sorts before build
    'build.secret-in-javascript',
    'seo.missing-title',             // high + quick beats high + medium
    'readiness.no-privacy-policy',
    'design.emoji-headings',
  ]);
  assert.deepEqual(plan.map(i => i.rank), [1, 2, 3, 4, 5], 'ranks are 1-based and contiguous');
  assert.equal(plan[0]!.effort, 'project');
  assert.equal(plan[2]!.effort, 'quick');
});

test('fix plan: same input always gives the same order, and unknown checks default to medium', () => {
  const input = [check('b.two', 'medium'), check('a.one', 'medium'), check('c.three', 'medium')];
  const once = fixPlan(input).map(i => i.result.id);
  const twice = fixPlan([...input].reverse()).map(i => i.result.id);
  assert.deepEqual(once, twice, 'input order never changes the plan');
  assert.deepEqual(once, ['a.one', 'b.two', 'c.three'], 'ties break on id');
  assert.equal(effortOf('something.unlisted'), 'medium');
  assert.equal(effortOf('build.no-favicon'), 'quick');
  assert.deepEqual(fixPlan([]), []);
});

// ── evidence rendering ──────────────────────────────────────────────────────
test('evidence: empty shapes render nothing at all', () => {
  for (const v of [undefined, null, '', '   ', [], {}, [[], {}], { a: undefined, b: [] }]) {
    assert.equal(isEmptyEvidence(v), true, `${JSON.stringify(v)} should count as empty`);
    assert.equal(evidenceHtml(v), '', `${JSON.stringify(v)} should render nothing`);
  }
  // this is the regression: a check whose evidence list came back empty printed "Evidence []"
  assert.equal(evidenceHtml([]), '');
});

test('evidence: each shape renders as what it is', () => {
  const list = evidenceHtml(['seamless', 'supercharge']);
  assert.match(list, /<ul class="ev__list">/);
  assert.match(list, /seamless/);

  const table = evidenceHtml([{ origin: 'https://a.test', kind: 'analytics' }, { origin: 'https://b.test', kind: 'fonts' }]);
  assert.match(table, /<table class="ev__table">/);
  assert.match(table, /<th>Origin<\/th>/, 'keys become readable column headings');
  assert.match(table, /<th>Kind<\/th>/);

  const pairs = evidenceHtml({ offScale: [7, 13], usedValues: 18 });
  assert.match(pairs, /<dl class="ev__pairs">/);
  assert.match(pairs, /<dt>Off scale<\/dt>/, 'camelCase keys are humanised');
  assert.match(pairs, /<dt>Used values<\/dt>/);

  assert.equal(labelKey('raw_words'), 'Raw words');
  assert.equal(labelKey('offScale'), 'Off scale');
});

test('evidence: long lists are capped and the remainder is counted, and HTML is escaped', () => {
  const many = evidenceHtml(Array.from({ length: 30 }, (_, i) => `item-${i}`));
  assert.match(many, /and 10 more/);
  assert.match(evidenceHtml(['<script>alert(1)</script>']), /&lt;script&gt;/, 'evidence is never injected raw');
  assert.ok(!evidenceHtml(['<script>alert(1)</script>']).includes('<script>alert'));
});

// ── client-facing chrome ────────────────────────────────────────────────────
test('audit date: a client reads a date, not an ISO timestamp', () => {
  assert.equal(auditDate('2026-09-17T08:39:03.133Z'), '17 September 2026');
  assert.equal(auditDate('not-a-date'), 'not-a-date', 'an unparseable value passes through unchanged');
});
