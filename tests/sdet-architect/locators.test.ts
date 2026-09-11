import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTestIdAttribute, fieldNameFor, looksLikeTestId, standardize } from '../../src/agents/sdet-architect/locators.js';
import type { Locator, LocatorStrategy } from '../../src/agents/sdet-architect/model.js';

const L = (strategy: LocatorStrategy, value: string): Locator => ({ strategy, value, source: { file: 'f', line: 1 } });

const table: [LocatorStrategy, string, string, number][] = [
  ['id', 'username', "page.locator('#username')", 0.95],
  ['id', 'react-select-1234', "page.locator('#react-select-1234')", 0.5],
  ['name', 'password', 'page.locator(\'[name="password"]\')', 0.85],
  ['linkText', 'Cart', "page.getByRole('link', { name: 'Cart', exact: true })", 0.9],
  ['partialLinkText', '27-inch', "page.getByRole('link', { name: /27-inch/ })", 0.8],
  ['className', 'results-grid', "page.locator('.results-grid')", 0.65],
  ['className', 'col-md-6', "page.locator('.col-md-6')", 0.5],
  ['tagName', 'h1', "page.locator('h1')", 0.5],
  ['css', 'button.search-submit', "page.locator('button.search-submit')", 0.8],
  ['css', "button[type='submit']", 'page.locator(\'button[type="submit"]\')', 0.8],
  ['css', '[data-testid=save]', "page.getByTestId('save')", 0.95],
  ['css', 'div > ul > li:nth-child(3) > a', "page.locator('div > ul > li:nth-child(3) > a')", 0.5],
  ['text', 'Add to cart', "page.getByText('Add to cart')", 0.85],
  // xpath conversions
  ['xpath', "//input[@id='email']", "page.locator('input#email')", 0.85],
  ['xpath', "//*[@id='email']", "page.locator('#email')", 0.85],
  ['xpath', "//input[@name='q']", 'page.locator(\'input[name="q"]\')', 0.85],
  ['xpath', "//p[text()='Your cart is empty']", "page.getByText('Your cart is empty', { exact: true })", 0.8],
  ['xpath', "//a[text()='Sign out']", "page.getByRole('link', { name: 'Sign out', exact: true })", 0.85],
  ['xpath', "//button[contains(text(),'Add to cart')]", "page.getByRole('button', { name: /Add to cart/ })", 0.8],
  ['xpath', "//span[contains(text(),'Total')]", "page.getByText('Total')", 0.75],
  ['xpath', "//div[contains(@class,'alert')]", "page.locator('div.alert')", 0.7],
  ['xpath', "//form[@id='login']//button", "page.locator('form#login button')", 0.85],
  ['xpath', "//div[@class='product-card'][1]//button[contains(text(),'Add to cart')]", 'page.locator(\'div[class="product-card"]:nth-of-type(1) button:has-text("Add to cart")\')', 0.5],
  ['xpath', '/html/body/div[2]/div/div[3]/ul/li[4]/a', "page.locator('xpath=/html/body/div[2]/div/div[3]/ul/li[4]/a')", 0.2],
  ['xpath', "//div[@id='a']/following-sibling::div[1]", "page.locator('xpath=//div[@id=\\'a\\']/following-sibling::div[1]')", 0.35],
  ['xpath', "//tr[td[text()='x']]/td[2]", "page.locator('xpath=//tr[td[text()=\\'x\\']]/td[2]')", 0.35],
];

for (const [strategy, value, expr, confidence] of table) {
  test(`standardize ${strategy}: ${value}`, () => {
    const std = standardize(L(strategy, value));
    assert.equal(std.expr, expr);
    assert.equal(std.confidence, confidence);
    if (confidence < 0.6) assert.ok(std.note, 'low confidence locators carry a note');
  });
}

test('test-id looking ids use getByTestId only when the estate is configured for it', () => {
  assert.ok(looksLikeTestId('qa-submit'));
  assert.ok(!looksLikeTestId('submit'));
  assert.equal(standardize(L('id', 'qa-submit')).expr, "page.locator('#qa-submit')");
  assert.equal(standardize(L('id', 'qa-submit'), { testIdAttribute: 'id' }).expr, "page.getByTestId('qa-submit')");
  assert.equal(chooseTestIdAttribute([L('id', 'qa-a'), L('id', 'qa-b'), L('css', '[data-testid=x]')]), 'id');
  assert.equal(chooseTestIdAttribute([L('id', 'plain')]), 'data-testid');
});

test('field names are readable and unique-able', () => {
  const name = (s: LocatorStrategy, v: string, alias?: string) => { const l = { ...L(s, v), alias }; return fieldNameFor(l, standardize(l)); };
  assert.equal(name('id', 'search-box'), 'searchBox');
  assert.equal(name('css', 'button.search-submit'), 'searchSubmit');
  assert.equal(name('css', "button[type='submit']"), 'submitButton');
  assert.equal(name('css', 'input[type="file"]'), 'fileInput');
  assert.equal(name('css', '#avatar-form button'), 'avatarFormButton');
  assert.equal(name('linkText', 'Cart'), 'cartLink');
  assert.equal(name('xpath', "//p[text()='Your cart is empty']"), 'yourCartIsEmptyText');
  assert.equal(name('id', 'x', 'usernameInput'), 'usernameInput');
  assert.equal(name('name', '123abc'), 'el123abc');
});
