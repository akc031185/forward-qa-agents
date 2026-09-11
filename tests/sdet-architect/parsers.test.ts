import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeleniumJava } from '../../src/agents/sdet-architect/parsers/selenium-java.js';
import { parseSeleniumPython } from '../../src/agents/sdet-architect/parsers/selenium-python.js';
import { parseSeleniumCSharp } from '../../src/agents/sdet-architect/parsers/selenium-csharp.js';
import { parseSeleniumJs } from '../../src/agents/sdet-architect/parsers/selenium-js.js';
import { linkStep, parseFeature } from '../../src/agents/sdet-architect/parsers/cucumber.js';
import { parsePostman } from '../../src/agents/sdet-architect/parsers/postman.js';
import { cucumberToRegex } from '../../src/agents/sdet-architect/parsers/cfamily.js';
import { parseStatement, newScope, splitCStatements, stripCComments } from '../../src/agents/sdet-architect/parsers/common.js';
import type { Step } from '../../src/agents/sdet-architect/model.js';
import { read } from './helpers.js';

const kinds = (steps: Step[]) => steps.map((s) => s.kind);

test('java: TestNG class with page object, Thread.sleep, xpath and hooks', () => {
  const s = parseSeleniumJava(read('src/test/java/com/fabricated/shop/tests/CheckoutTest.java'), 'CheckoutTest.java');
  assert.equal(s.kind, 'selenium-java');
  assert.equal(s.className, 'CheckoutTest');
  assert.deepEqual(s.tests.map((t) => t.name), ['addItemToCartAndCheckout', 'emptyCartShowsMessage', 'legacyHelperOnly']);
  assert.deepEqual(s.hooks.map((h) => h.kind), ['beforeEach', 'afterEach']);
  assert.equal(s.constants.BASE_URL, 'https://shop.example.test');
  // hook resolves page-object calls with constants substituted
  const call = s.hooks[0].steps[1];
  assert.equal(call.kind, 'call');
  assert.deepEqual(call.call, { object: 'LoginPage', method: 'login', args: ['"qa.buyer@example.test"', '"Secret123!"'] });
  const t1 = s.tests[0];
  assert.deepEqual(kinds(t1.steps), ['navigate', 'fill', 'click', 'wait', 'click', 'assert', 'click', 'wait', 'click', 'select', 'click', 'assert', 'assert']);
  assert.equal(t1.steps[0].value, 'https://shop.example.test/catalog');
  assert.equal(t1.steps[3].hard, true);
  assert.equal(t1.steps[3].value, '2000');
  assert.equal(t1.steps[4].locator?.strategy, 'xpath');
  assert.deepEqual(t1.steps[5].assertion, { type: 'text', expected: '1', expectedExpr: undefined, negate: undefined, locator: t1.steps[5].locator });
  assert.equal(t1.steps[9].value, 'Express (1-2 days)');
  assert.equal(t1.steps[12].assertion?.type, 'title');
  const t2 = s.tests[1];
  assert.equal(t2.steps[2].assertion?.type, 'count');
  assert.equal(t2.steps[2].assertion?.expected, '0');
  const t3 = s.tests[2];
  assert.equal(t3.steps[1].kind, 'unknown');
  assert.match(t3.steps[1].raw, /takeScreenshotAndUpload/);
  assert.ok(s.urls.includes('https://shop.example.test/cart'));
});

test('java: JUnit 5 class, Keys.ENTER, expected-first assertEquals, url contains', () => {
  const s = parseSeleniumJava(read('src/test/java/com/fabricated/shop/tests/SearchTest.java'), 'SearchTest.java');
  assert.equal(s.tests.length, 3);
  const t = s.tests[0];
  assert.deepEqual(kinds(t.steps), ['fill', 'press', 'assert', 'assert']);
  assert.equal(t.steps[1].value, 'Enter');
  assert.equal(t.steps[2].assertion?.expected, 'Results for "keyboard"');
  assert.equal(t.steps[3].assertion?.type, 'visible');
  assert.equal(s.tests[1].steps[2].assertion?.type, 'urlContains');
  assert.equal(s.tests[2].steps[2].locator?.strategy, 'partialLinkText');
});

test('java: PageFactory page object exposes fields and methods', () => {
  const s = parseSeleniumJava(read('src/test/java/com/fabricated/shop/pages/LoginPage.java'), 'LoginPage.java');
  assert.equal(s.kind, 'page-object');
  const po = s.pageObjects[0];
  assert.equal(po.name, 'LoginPage');
  assert.deepEqual(po.locators.map((l) => `${l.alias}=${l.strategy}:${l.value}`), [
    'usernameInput=id:username', 'passwordInput=name:password', "signInButton=css:button[type='submit']",
    "errorBanner=xpath://div[@class='alert alert-danger']", 'forgotPasswordLink=linkText:Forgot your password?',
  ]);
  assert.deepEqual(po.methods.map((m) => m.name), ['open', 'login', 'errorText', 'goToForgotPassword']);
  const login = po.methods[1];
  assert.deepEqual(login.params, ['user', 'pass']);
  assert.deepEqual(kinds(login.steps), ['clear', 'fill', 'fill', 'click']);
  assert.equal(login.steps[1].valueExpr, 'user');
  assert.equal(po.methods[2].steps[0].kind, 'read');
});

test('java: cucumber step definitions become regexes with params', () => {
  const s = parseSeleniumJava(read('src/test/java/com/fabricated/shop/steps/LoginSteps.java'), 'LoginSteps.java');
  assert.equal(s.kind, 'step-definitions');
  const defs = s.stepDefinitions!;
  assert.equal(defs.length, 5);
  assert.equal(defs[1].regex, '^I enter username "([^"]*)" and password "([^"]*)"$');
  assert.deepEqual(defs[1].params, ['user', 'pass']);
  assert.equal(defs[4].regex, '^I should see the error "([^"]*)"$');
  assert.equal(defs[4].steps[0].assertion?.expectedExpr, 'expected');
  assert.equal(cucumberToRegex('I have {int} items'), '^I have (-?\\d+) items$');
});

test('python: pytest module with legacy finders, tuple locators, time.sleep and bare asserts', () => {
  const s = parseSeleniumPython(read('python/test_cart.py'), 'test_cart.py');
  assert.equal(s.kind, 'selenium-python');
  assert.deepEqual(s.tests.map((t) => t.name), ['test_add_to_cart_updates_badge', 'test_quantity_can_be_changed', 'test_remove_last_item_shows_empty_state']);
  assert.equal(s.hooks.length, 0, 'fixture with only driver lifecycle produces no hook');
  const t1 = s.tests[0];
  assert.deepEqual(kinds(t1.steps), ['navigate', 'fill', 'click', 'wait', 'click', 'assert']);
  assert.equal(t1.steps[3].value, '3000');
  assert.equal(t1.steps[5].assertion?.expected, '1');
  const t2 = s.tests[1];
  assert.deepEqual(kinds(t2.steps), ['navigate', 'clear', 'fill', 'select', 'wait', 'assert', 'assert']);
  assert.equal(t2.steps[1].locator?.strategy, 'name');
  assert.equal(t2.steps[4].hard, false);
  assert.equal(t2.steps[6].assertion?.type, 'urlContains');
  const t3 = s.tests[2];
  assert.equal(kinds(t3.steps).filter((k) => k === 'unknown').length, 0, 'save_screenshot is lifecycle noise');
});

test('csharp: NUnit fixture with SetUp, SelectElement, Assert.That and Thread.Sleep', () => {
  const s = parseSeleniumCSharp(read('dotnet/AccountTests.cs'), 'AccountTests.cs');
  assert.equal(s.kind, 'selenium-csharp');
  assert.equal(s.className, 'AccountTests');
  assert.deepEqual(kinds(s.hooks[0].steps), ['navigate', 'fill', 'fill', 'click']);
  assert.equal(s.hooks[1].steps.length, 0);
  const t1 = s.tests[0];
  assert.deepEqual(kinds(t1.steps), ['navigate', 'clear', 'fill', 'click', 'wait', 'assert']);
  assert.equal(t1.steps[3].locator?.value, "//button[@id='save-profile']");
  assert.equal(t1.steps[5].assertion?.expected, 'Profile saved');
  const t2 = s.tests[1];
  assert.equal(t2.steps[1].kind, 'select');
  assert.equal(t2.steps[1].value, 'Weekly');
  assert.equal(t2.steps[3].kind, 'wait');
  assert.equal(t2.steps[5].assertion?.type, 'title');
  assert.equal(s.tests[2].steps[1].assertion?.type, 'urlContains');
});

test('javascript: selenium-webdriver mocha file with awaits, Key.RETURN, getAttribute and assert.*', () => {
  const s = parseSeleniumJs(read('js/profile.test.js'), 'profile.test.js');
  assert.equal(s.kind, 'selenium-js');
  assert.equal(s.className, 'Profile page');
  assert.deepEqual(kinds(s.hooks[0].steps), ['navigate', 'fill', 'fill', 'press']);
  assert.deepEqual(s.tests.map((t) => t.name), ['shows the saved display name', 'can upload an avatar', 'sign out returns to login']);
  assert.deepEqual(s.tests[0].steps[2].assertion, { type: 'value', expected: 'QA Buyer', expectedExpr: undefined, negate: undefined, locator: s.tests[0].steps[2].locator });
  const t2 = s.tests[1];
  assert.deepEqual(kinds(t2.steps), ['navigate', 'fill', 'click', 'wait', 'assert']);
  assert.equal(t2.steps[4].assertion?.expected, 'Avatar updated');
});

test('cypress statements flow through the shared engine', () => {
  const scope = newScope();
  const stmts = splitCStatements("cy.visit('/login');\ncy.get('#user').type('bob');\ncy.contains('Sign in').click();\ncy.get('.toast').should('have.text', 'Welcome');", 1);
  const steps = stmts.flatMap((st) => parseStatement(st, 'javascript', scope, 'x.cy.js').steps);
  assert.deepEqual(kinds(steps), ['navigate', 'fill', 'click', 'assert']);
  assert.equal(steps[2].locator?.strategy, 'text');
  assert.equal(steps[3].assertion?.type, 'text');
});

test('common: comment stripping keeps strings and line numbers', () => {
  const out = stripCComments('a("http://x"); // c\n/* b\n */ d;');
  assert.equal(out, 'a("http://x"); \n\n d;');
});

test('gherkin: feature with background, outline and tags', () => {
  const s = parseFeature(read('features/login.feature'), 'login.feature');
  const f = s.feature!;
  assert.equal(f.name, 'Customer login');
  assert.deepEqual(f.tags, ['@smoke', '@login']);
  assert.equal(f.background.length, 1);
  assert.equal(f.scenarios.length, 3);
  assert.equal(f.scenarios[2].outline, true);
  assert.equal(f.scenarios[2].examples?.rows.length, 2);
  assert.equal(s.tests.length, 4, 'outline rows expand to one test each');
  assert.match(s.tests[3].steps[1].raw, /locked\.two@example\.test/);
  const defs = parseSeleniumJava(read('src/test/java/com/fabricated/shop/steps/LoginSteps.java'), 'LoginSteps.java').stepDefinitions!;
  const link = linkStep(f.scenarios[1].steps[0], defs);
  assert.equal(link.def?.pattern, 'I enter username {string} and password {string}');
  assert.deepEqual(link.args, ['qa.buyer@example.test', 'wrong']);
  assert.equal(linkStep({ keyword: 'Then', text: 'nothing matches this', line: 1 }, defs).def, undefined);
});

test('postman: nested folders, variables, body and status expectations', () => {
  const s = parsePostman(read('postman/shop-api.postman_collection.json'), 'shop.json');
  assert.equal(s.className, 'Fabricated Shop API');
  assert.deepEqual(s.variables, { baseUrl: 'https://api.shop.example.test', apiKey: 'fabricated-key-123' });
  const r = s.requests!;
  assert.equal(r.length, 4);
  assert.deepEqual(r[0].folder, ['Catalog']);
  assert.equal(r[0].method, 'GET');
  assert.equal(r[0].expectedStatus, 200);
  assert.equal(r[1].expectedStatus, 200);
  assert.equal(r[2].method, 'POST');
  assert.equal(r[2].expectedStatus, 201);
  assert.match(r[2].body!, /"sku": "sku-1001"/);
  assert.equal(r[3].expectedStatus, undefined);
});
