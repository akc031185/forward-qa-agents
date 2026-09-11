import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSeleniumJava } from '../../src/agents/sdet-architect/parsers/selenium-java.js';
import { parseFeature } from '../../src/agents/sdet-architect/parsers/cucumber.js';
import { parsePostman } from '../../src/agents/sdet-architect/parsers/postman.js';
import { buildPlan } from '../../src/agents/sdet-architect/generators/plan.js';
import { genFixtures, genPageClass } from '../../src/agents/sdet-architect/generators/pages.js';
import { genSpec, parseTestPlan } from '../../src/agents/sdet-architect/generators/spec.js';
import { genStepDefinitions } from '../../src/agents/sdet-architect/generators/bdd.js';
import { genApiSpec } from '../../src/agents/sdet-architect/generators/api.js';
import { genMcpJson, genPackageJson, genPlaywrightConfig, genWorkflow } from '../../src/agents/sdet-architect/generators/project.js';
import { emitStep, statusOf } from '../../src/agents/sdet-architect/generators/steps.js';
import { generateEstate, detectBaseUrl } from '../../src/agents/sdet-architect/convert.js';
import { buildMigrationReport } from '../../src/agents/sdet-architect/report.js';
import { read } from './helpers.js';

const BASE = 'https://shop.example.test';

test('page-object class: readonly locators, typed methods, relative goto', () => {
  const po = parseSeleniumJava(read('src/test/java/com/fabricated/shop/pages/LoginPage.java'), 'pages/LoginPage.java');
  const plan = buildPlan([po]);
  const page = plan.pages[0];
  assert.equal(page.className, 'LoginPage');
  assert.equal(page.file, 'src/pages/Login.page.ts');
  const r = genPageClass(page, plan, BASE);
  for (const line of [
    "import { type Page, type Locator } from '@playwright/test';",
    'export class LoginPage {',
    '  readonly usernameInput: Locator;',
    "    this.usernameInput = page.locator('#username');",
    "    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot your password?', exact: true });",
    '  constructor(readonly page: Page) {',
    "    await this.page.goto('/login');",
    '  async login(user: string, pass: string): Promise<void> {',
    '    await this.usernameInput.fill(user);',
    '    await this.signInButton.click();',
    '  async errorText(): Promise<string> {',
    "    return (await this.errorBanner.textContent()) ?? '';",
  ]) assert.ok(r.code.includes(line), `missing: ${line}`);
  assert.equal(r.todos.length, 0);
  assert.ok(r.statuses.every((s) => s.status === 'converted'));
});

test('spec: hooks, fixtures, hard-wait note, TODO with source ref, fixme for manual tests', () => {
  const po = parseSeleniumJava(read('src/test/java/com/fabricated/shop/pages/LoginPage.java'), 'pages/LoginPage.java');
  const t = parseSeleniumJava(read('src/test/java/com/fabricated/shop/tests/CheckoutTest.java'), 'tests/CheckoutTest.java');
  const plan = buildPlan([po, t]);
  const r = genSpec(t, plan, BASE);
  for (const line of [
    "import { test, expect } from '../src/fixtures';",
    "test.describe('CheckoutTest', () => {",
    '  test.beforeEach(async ({ page, checkoutPage, loginPage }) => {',
    '    await loginPage.open();',
    "    await loginPage.login('qa.buyer@example.test', 'Secret123!');",
    "  test('addItemToCartAndCheckout', async ({ page, checkoutPage, loginPage }) => {",
    "    await page.goto('/catalog');",
    "    await checkoutPage.searchBox.fill('wireless mouse');",
    '    // NOTE(sdet-architect): removed hard wait 2000ms (Thread.sleep(2000));',
    "    await expect(checkoutPage.cartCount).toHaveText('1');",
    "    await checkoutPage.checkoutButton.waitFor({ state: 'visible' });",
    "    await checkoutPage.shippingMethod.selectOption({ label: 'Express (1-2 days)' });",
    "    await expect(page).toHaveTitle('Order confirmed - Fabricated Shop');",
    '    await expect(checkoutPage.cartLine).toHaveCount(0);',
    '    // TODO(sdet-architect): takeScreenshotAndUpload(driver, "account")  [tests/CheckoutTest.java:71]',
  ]) assert.ok(r.code.includes(line), `missing: ${line}`);
  assert.deepEqual(r.tests.map((x) => x.status), ['converted', 'converted', 'partial']);
  assert.equal(r.flaky.length, 1);
  assert.equal(r.todos.length, 1);
  assert.deepEqual(r.noAssertion, ['legacyHelperOnly']);
  const fx = genFixtures(plan.pages);
  assert.ok(fx.includes("import { LoginPage } from '../pages/Login.page';"));
  assert.ok(fx.includes('  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },'));
  assert.ok(fx.includes('export const test = base.extend<PageFixtures>({'));
});

test('spec: markdown test plan becomes fixme scaffolds', () => {
  const s = parseTestPlan(read('docs/regression-test-plan.md'), 'docs/regression-test-plan.md');
  assert.equal(s.tests.length, 2);
  const r = genSpec(s, buildPlan([s]), BASE);
  assert.ok(r.code.includes("import { test } from '@playwright/test';"));
  assert.ok(r.code.includes("    test.fixme(true, 'sdet-architect: 4/4 steps need manual conversion');"));
  assert.ok(r.code.includes('    // TODO(sdet-architect): Apply promo code WELCOME10 at checkout  [docs/regression-test-plan.md:6]'));
  assert.deepEqual(r.tests.map((t) => t.status), ['manual', 'manual']);
});

test('bdd: feature kept, playwright-bdd steps generated with params and regex patterns', () => {
  const f = parseFeature(read('features/login.feature'), 'features/login.feature');
  const d = parseSeleniumJava(read('src/test/java/com/fabricated/shop/steps/LoginSteps.java'), 'steps/LoginSteps.java');
  const plan = buildPlan([f, d]);
  const r = genStepDefinitions(f, [d], plan, BASE);
  for (const line of [
    "import { createBdd } from 'playwright-bdd';",
    'const { Given, When, Then } = createBdd(test);',
    "Given('I am on the login page', async ({ page, loginPage }) => {",
    "  await page.goto('/login');",
    "When('I enter username {string} and password {string}', async ({ page, loginPage }, user: string, pass: string) => {",
    '  await loginPage.username.fill(user);',
    'Then(/^I should see the error "([^"]*)"$/, async ({ page, loginPage }, expected: string) => {',
    '  await expect(loginPage.alertDanger).toHaveText(expected);',
  ]) assert.ok(r.code.includes(line), `missing: ${line}`);
  assert.equal(r.unmatched.length, 0);
  assert.ok(r.scenarios.every((s) => s.status === 'converted'));
  // unmatched steps become stubs
  const orphan = genStepDefinitions(f, [], plan, BASE);
  assert.ok(orphan.code.includes('// TODO(sdet-architect): no step definition found for this step'));
  assert.equal(orphan.unmatched.length, 8, "distinct step texts incl. outline placeholders");
});

test('api: postman requests become request-fixture tests with status assertions', () => {
  const p = parsePostman(read('postman/shop-api.postman_collection.json'), 'postman/shop-api.postman_collection.json');
  const r = genApiSpec(p);
  for (const line of [
    "import { test, expect } from '@playwright/test';",
    "  \"baseUrl\": process.env['BASEURL'] ?? 'https://api.shop.example.test',",
    "test.describe('Fabricated Shop API', () => {",
    "  test('Catalog / List products', async ({ request }) => {",
    "    const res = await request.get(v('{{baseUrl}}/v1/products?limit=20'), {",
    "      headers: { \"Accept\": v('application/json') },",
    '    expect(res.status()).toBe(200);',
    "    const res = await request.post(v('{{baseUrl}}/v1/orders'), {",
    '        "sku": "sku-1001",',
    '    expect(res.status()).toBe(201);',
    "    const res = await request.delete(v('{{baseUrl}}/v1/orders/ord-9001'), {",
    '    // TODO(sdet-architect): port the remaining Postman test script:',
  ]) assert.ok(r.code.includes(line), `missing: ${line}`);
  assert.deepEqual(r.tests.map((t) => t.status), ['converted', 'partial', 'converted', 'converted']);
  assert.deepEqual(r.noAssertion, ['Delete order (no tests)']);
});

test('project files', () => {
  const o = { orgSlug: 'acme', baseUrl: BASE, hasBdd: true, hasApi: true, hasUi: true, testIdAttribute: 'id' };
  const pkg = JSON.parse(genPackageJson(o));
  assert.equal(pkg.name, 'acme-playwright');
  assert.ok(pkg.devDependencies['@playwright/test']);
  assert.ok(pkg.devDependencies['@playwright/mcp']);
  assert.ok(pkg.devDependencies['playwright-bdd']);
  assert.deepEqual(Object.keys(pkg.scripts).slice(0, 3), ['test', 'test:ui', 'test:headed']);
  assert.ok(pkg.scripts.report && pkg.scripts.mcp);
  const cfg = genPlaywrightConfig(o);
  assert.ok(cfg.includes("baseURL: process.env.BASE_URL ?? 'https://shop.example.test'"));
  assert.ok(cfg.includes("testIdAttribute: 'id'"));
  assert.ok(cfg.includes("trace: 'on-first-retry'"));
  assert.ok(cfg.includes("['json', { outputFile: 'test-results/results.json' }]"));
  assert.ok(cfg.includes("{ name: 'bdd', testDir: bddTestDir"));
  const mcp = JSON.parse(genMcpJson());
  assert.equal(mcp.mcpServers.playwright.command, 'npx');
  assert.ok(genWorkflow(o).includes('npx playwright install --with-deps'));
});

test('emitStep edge cases and status thresholds', () => {
  const ctx = { page: 'page', loc: () => 'page.locator(\'#x\')', sourceFile: 'f.java', params: new Set(['name']) };
  const loc = { strategy: 'id' as const, value: 'x', source: { file: 'f.java', line: 3 } };
  assert.deepEqual(emitStep({ kind: 'fill', locator: loc, valueExpr: 'name', raw: 'x', line: 3 }, ctx).code, ["await page.locator('#x').fill(name);"]);
  assert.equal(emitStep({ kind: 'fill', locator: loc, valueExpr: 'other', raw: 'el.sendKeys(other)', line: 3 }, ctx).todo, true);
  assert.deepEqual(emitStep({ kind: 'fill', locator: { ...loc, strategy: 'css', value: 'input[type="file"]' }, value: '/tmp/a.png', raw: 'x', line: 3 }, ctx).code, ["await page.locator('#x').setInputFiles('/tmp/a.png');"]);
  assert.deepEqual(emitStep({ kind: 'assert', locator: loc, assertion: { type: 'text', expected: "it's", negate: true }, raw: 'x', line: 3 }, ctx).code, ["await expect(page.locator('#x')).not.toHaveText('it\\'s');"]);
  assert.deepEqual(emitStep({ kind: 'assert', assertion: { type: 'urlContains', expected: 'a/b?c=1' }, raw: 'x', line: 3 }, ctx).code, ['await expect(page).toHaveURL(/a\\/b\\?c=1/);']);
  assert.deepEqual(emitStep({ kind: 'navigate', value: 'https://shop.example.test/x', raw: 'x', line: 3 }, { ...ctx, baseUrl: BASE }).code, ["await page.goto('/x');"]);
  assert.equal(emitStep({ kind: 'call', call: { object: 'Nope', method: 'm', args: [] }, raw: 'nope.m()', line: 3 }, ctx).todo, true);
  assert.equal(statusOf(0, 0), 'manual');
  assert.equal(statusOf(4, 0), 'converted');
  assert.equal(statusOf(4, 1), 'partial');
  assert.equal(statusOf(4, 2), 'manual');
});

test('generateEstate + report: whole fixture estate in memory', () => {
  const suites = [
    parseSeleniumJava(read('src/test/java/com/fabricated/shop/pages/LoginPage.java'), 'pages/LoginPage.java'),
    parseSeleniumJava(read('src/test/java/com/fabricated/shop/tests/CheckoutTest.java'), 'tests/CheckoutTest.java'),
    parseFeature(read('features/login.feature'), 'features/login.feature'),
    parseSeleniumJava(read('src/test/java/com/fabricated/shop/steps/LoginSteps.java'), 'steps/LoginSteps.java'),
    parsePostman(read('postman/shop-api.postman_collection.json'), 'postman/shop.json'),
  ];
  assert.equal(detectBaseUrl(suites), BASE, 'api.* origins lose to the UI origin');
  const g = generateEstate(suites, { orgSlug: 'fabricated' });
  assert.equal(g.baseUrl, BASE);
  for (const f of ['package.json', 'playwright.config.ts', '.mcp.json', 'tsconfig.json', 'src/fixtures/index.ts', 'src/pages/Login.page.ts', 'src/pages/Checkout.page.ts', 'tests/CheckoutTest.spec.ts', 'tests/features/login.feature', 'tests/steps/login.steps.ts', 'tests/api/shop.spec.ts', '.github/workflows/playwright.yml']) assert.ok(g.files.has(f), `missing ${f}`);
  assert.ok(g.files.get('tests/features/login.feature')!.includes('Scenario Outline: Locked accounts'));
  assert.ok(g.duplicates.some((d) => d.key === 'id:username'), 'username id is used in LoginPage and LoginSteps');
  assert.ok(g.totals.coveragePct > 80 && g.totals.coveragePct <= 100);
  const md = buildMigrationReport({
    orgSlug: 'fabricated', sourceDir: '/src', outputDir: '/out', baseUrl: g.baseUrl, dryRun: true, inventory: [], counts: { 'selenium-java': 2 } as never,
    files: g.fileStatuses, totals: g.totals, todos: g.todos, locators: { total: g.uniqueLocators, low: g.lowLocators.length, histogram: g.histogram, byStrategy: g.byStrategy, lowList: g.lowLocators },
    findings: { flaky: g.flaky.length, duplication: g.duplicates.length, quality: g.noAssertion.length, conversion: g.todos.length, locator: g.lowLocators.length }, generatedFiles: [...g.files.keys()], llmUsed: false,
  });
  assert.ok(md.startsWith('# Migration report: fabricated -> Playwright + Playwright MCP'));
  assert.ok(md.includes('DRY RUN'));
  assert.ok(md.includes('## 3. TODO list'));
  assert.ok(md.includes('`tests/CheckoutTest.java:71`'));
  assert.ok(md.includes('## 8. How to run from an MCP client'));
});
