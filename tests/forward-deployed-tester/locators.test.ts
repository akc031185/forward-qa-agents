import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deriveLocator, implicitRole, toPropertyName, uniqueNames, toCamelCase } from '../../src/agents/forward-deployed-tester/locators.js';
import { buildInteractiveElements, normaliseUrl, isCrawlable } from '../../src/agents/forward-deployed-tester/crawler.js';

describe('implicitRole', () => {
  test('maps common HTML elements', () => {
    assert.equal(implicitRole('a', undefined, '/x'), 'link');
    assert.equal(implicitRole('a'), undefined);
    assert.equal(implicitRole('button'), 'button');
    assert.equal(implicitRole('input', 'submit'), 'button');
    assert.equal(implicitRole('input', 'checkbox'), 'checkbox');
    assert.equal(implicitRole('input', 'email'), 'textbox');
    assert.equal(implicitRole('input', 'search'), 'searchbox');
    assert.equal(implicitRole('input', 'file'), undefined);
    assert.equal(implicitRole('select'), 'combobox');
    assert.equal(implicitRole('textarea'), 'textbox');
  });
});

describe('deriveLocator priority', () => {
  test('prefers getByRole with accessible name', () => {
    const l = deriveLocator({ tag: 'button', name: 'Sign in', text: 'Sign in', id: 'btn', testId: 'signin' });
    assert.equal(l.strategy, 'role');
    assert.equal(l.code, `page.getByRole("button", { name: "Sign in", exact: true })`);
    assert.equal(l.confidence, 'high');
  });

  test('explicit role attribute wins over implicit', () => {
    const l = deriveLocator({ tag: 'div', role: 'button', name: 'Menu' });
    assert.equal(l.code, `page.getByRole("button", { name: "Menu", exact: true })`);
  });

  test('labelled input without role name uses getByLabel', () => {
    // type=date has no implicit role, so role+name is unavailable
    const l = deriveLocator({ tag: 'input', type: 'date', label: 'Start date' });
    assert.equal(l.strategy, 'label');
    assert.equal(l.code, `page.getByLabel("Start date", { exact: true })`);
  });

  test('placeholder when no label', () => {
    const l = deriveLocator({ tag: 'input', type: 'file', placeholder: 'Upload CV' });
    assert.equal(l.strategy, 'placeholder');
    assert.equal(l.code, `page.getByPlaceholder("Upload CV", { exact: true })`);
  });

  test('text for clickable elements without role', () => {
    const l = deriveLocator({ tag: 'span', text: 'Read more' });
    assert.equal(l.strategy, 'text');
    assert.equal(l.code, `page.getByText("Read more", { exact: true })`);
  });

  test('test id before CSS', () => {
    const l = deriveLocator({ tag: 'input', type: 'color', testId: 'brand-color', id: 'c1' });
    assert.equal(l.strategy, 'testid');
    assert.equal(l.code, `page.getByTestId("brand-color")`);
  });

  test('CSS id fallback, rejecting generated-looking ids', () => {
    assert.equal(deriveLocator({ tag: 'input', type: 'file', id: 'avatar' }).code, `page.locator("#avatar")`);
    const gen = deriveLocator({ tag: 'input', type: 'file', id: 'ember1234', nameAttr: 'avatar' });
    assert.equal(gen.code, `page.locator("input[name=\\"avatar\\"]")`);
  });

  test('CSS class and bare tag fallbacks are low confidence', () => {
    const cls = deriveLocator({ tag: 'input', type: 'file', classes: ['css-1abc23', 'upload'] });
    assert.equal(cls.code, `page.locator("input.upload")`);
    assert.equal(cls.confidence, 'low');
    const bare = deriveLocator({ tag: 'input', type: 'file' });
    assert.equal(bare.code, `page.locator("input[type=\\"file\\"]")`);
    assert.equal(bare.confidence, 'low');
  });

  test('normalises whitespace and truncates long names', () => {
    const l = deriveLocator({ tag: 'a', href: '/x', name: '  Read\n  more   ' });
    assert.equal(l.name, 'Read more');
    const long = deriveLocator({ tag: 'a', href: '/x', name: 'x'.repeat(200) });
    assert.ok(long.name!.length <= 80);
  });

  test('escapes quotes safely in generated code', () => {
    const l = deriveLocator({ tag: 'button', name: `Say "hi"` });
    assert.equal(l.code, `page.getByRole("button", { name: "Say \\"hi\\"", exact: true })`);
  });
});

describe('property naming', () => {
  test('camelCase with role suffix', () => {
    assert.equal(toCamelCase('Sign In Now!'), 'signInNow');
    const el = { tag: 'button', name: 'Sign in' };
    assert.equal(toPropertyName(el, deriveLocator(el)), 'signInButton');
    const link = { tag: 'a', href: '/about', name: 'About us' };
    assert.equal(toPropertyName(link, deriveLocator(link)), 'aboutUsLink');
    const input = { tag: 'input', type: 'email', label: 'Email' };
    assert.equal(toPropertyName(input, deriveLocator(input)), 'emailInput');
  });

  test('does not double the suffix and avoids reserved words and leading digits', () => {
    const el = { tag: 'button', name: 'Submit button' };
    assert.equal(toPropertyName(el, deriveLocator(el)), 'submitButton');
    const num = { tag: 'a', href: '/x', name: '2024 results' };
    assert.equal(toPropertyName(num, deriveLocator(num)), 'el2024ResultsLink');
    const bare = { tag: 'input', type: 'file' };
    assert.equal(toPropertyName(bare, deriveLocator(bare)), 'input');
  });

  test('uniqueNames appends counters', () => {
    assert.deepEqual(uniqueNames(['a', 'b', 'a', 'a']), ['a', 'b', 'a2', 'a3']);
  });

  test('buildInteractiveElements produces unique properties', () => {
    const els = buildInteractiveElements([
      { tag: 'a', href: '/1', name: 'More' },
      { tag: 'a', href: '/2', name: 'More' },
      { tag: 'button', name: 'Go' },
    ]);
    assert.deepEqual(els.map(e => e.property), ['moreLink', 'moreLink2', 'goButton']);
    assert.equal(els[0]!.locator.strategy, 'role');
  });
});

describe('url handling', () => {
  test('normaliseUrl strips hashes and trailing slashes, resolves relative', () => {
    assert.equal(normaliseUrl('/about/#team', 'https://a.test/'), 'https://a.test/about');
    assert.equal(normaliseUrl('mailto:x@y.z', 'https://a.test/'), undefined);
    assert.equal(normaliseUrl('https://a.test/', 'https://a.test/'), 'https://a.test/');
  });
  test('isCrawlable rejects other origins and assets', () => {
    assert.equal(isCrawlable('https://a.test/about', 'https://a.test'), true);
    assert.equal(isCrawlable('https://b.test/about', 'https://a.test'), false);
    assert.equal(isCrawlable('https://a.test/logo.png', 'https://a.test'), false);
    assert.equal(isCrawlable('https://a.test/brochure.pdf', 'https://a.test'), false);
  });
});
