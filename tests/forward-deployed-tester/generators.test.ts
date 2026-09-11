import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pageClassName, generatePageObject, generateSmokeSpec, generateInfra, generatePlaywrightConfig, generateMcpJson, generatePackageJson,
} from '../../src/agents/forward-deployed-tester/generators.js';
import { makePage } from './fixtures.js';

const opts = { targetUrl: 'https://app.example.test', orgSlug: 'acme', mcp: true };

describe('pageClassName', () => {
  test('derives PascalCase names from paths', () => {
    assert.equal(pageClassName('/'), 'HomePage');
    assert.equal(pageClassName('/about-us'), 'AboutUsPage');
    assert.equal(pageClassName('/blog/post-1?x=1'), 'BlogPost1Page');
    assert.equal(pageClassName('/2024/report.html'), 'Page2024ReportPage');
  });
});

describe('generatePageObject', () => {
  test('emits a class with a getter per locator and a goto()', () => {
    const src = generatePageObject(makePage({ path: '/login', title: 'Log in' }));
    assert.match(src, /export class LoginPage \{/);
    assert.match(src, /readonly path = "\/login";/);
    assert.match(src, /async goto\(\): Promise<Response \| null>/);
    assert.match(src, /get aboutUsLink\(\): Locator \{ return this\.page\.getByRole\("link", \{ name: "About us", exact: true \}\); \}/);
    assert.match(src, /get signInButton\(\): Locator/);
    assert.match(src, /get emailInput\(\): Locator \{ return this\.page\.getByRole\("textbox", \{ name: "Email", exact: true \}\); \}/);
  });

  test('handles a page with no interactive elements', () => {
    const src = generatePageObject(makePage({ path: '/empty', elements: [] }));
    assert.match(src, /export class EmptyPage/);
    assert.doesNotMatch(src, /get \w+\(\): Locator/);
  });
});

describe('generateSmokeSpec', () => {
  test('one test per page with title, h1 and console assertions', () => {
    const pages = [
      makePage({ path: '/', title: 'Home', h1Text: 'Welcome' }),
      makePage({ path: '/pricing', title: 'Pricing', hasH1: false, h1Text: undefined }),
    ];
    const src = generateSmokeSpec(pages);
    assert.match(src, /import \{ test, expect \} from '\.\/fixtures';/);
    assert.match(src, /import \{ HomePage \} from '\.\.\/pages\/HomePage\.page';/);
    assert.match(src, /import \{ PricingPage \} from '\.\.\/pages\/PricingPage\.page';/);
    assert.equal((src.match(/\n  test\(/g) ?? []).length, 2);
    assert.match(src, /toHaveTitle\("Home"\)/);
    assert.match(src, /getByRole\('heading', \{ level: 1 \}\)\.first\(\)\)\.toContainText\("Welcome"\)/);
    assert.match(src, /recon found no <h1>/);
    assert.equal((src.match(/expect\(consoleErrors, 'no console errors during load'\)\.toEqual\(\[\]\)/g) ?? []).length, 2);
  });

  test('duplicate class names are made unique', () => {
    const src = generateSmokeSpec([makePage({ path: '/a-b' }), makePage({ path: '/a_b' })]);
    assert.match(src, /ABPage\.page/);
    assert.match(src, /ABPage2\.page/);
  });
});

describe('project files', () => {
  test('playwright config has baseURL, trace on retry, html reporter and browser + mobile projects', () => {
    const cfg = generatePlaywrightConfig(opts);
    assert.match(cfg, /baseURL: process\.env\.BASE_URL \?\? "https:\/\/app\.example\.test"/);
    assert.match(cfg, /trace: 'on-first-retry'/);
    assert.match(cfg, /\['html'/);
    for (const p of ['chromium', 'firefox', 'webkit', 'mobile-chrome', 'mobile-safari']) assert.match(cfg, new RegExp(`name: '${p}'`));
  });

  test('mcp.json and package.json are valid JSON with the expected bits', () => {
    const mcp = JSON.parse(generateMcpJson(opts));
    assert.deepEqual(mcp.mcpServers.playwright.args.slice(0, 2), ['@playwright/mcp@latest', '--headless']);
    const pkg = JSON.parse(generatePackageJson(opts));
    assert.equal(pkg.name, 'acme-e2e');
    assert.ok(pkg.devDependencies['@playwright/test']);
    assert.ok(pkg.devDependencies['@playwright/mcp']);
    assert.deepEqual(Object.keys(pkg.scripts).sort(), ['mcp', 'report', 'test', 'test:headed', 'test:ui']);
    const noMcp = JSON.parse(generatePackageJson({ ...opts, mcp: false }));
    assert.equal(noMcp.scripts.mcp, undefined);
  });

  test('generateInfra returns the complete file set', () => {
    const files = generateInfra([makePage({ path: '/' }), makePage({ path: '/contact' })], opts);
    const paths = files.map(f => f.relPath).sort();
    assert.deepEqual(paths, [
      '.github/workflows/playwright.yml', '.gitignore', '.mcp.json', 'README.md', 'package.json', 'pages/ContactPage.page.ts',
      'pages/HomePage.page.ts', 'playwright.config.ts', 'tests/fixtures.ts', 'tests/smoke.spec.ts',
    ]);
    assert.ok(files.every(f => f.content.length > 0 && f.kind.startsWith('infra/')));
    const readme = files.find(f => f.relPath === 'README.md')!.content;
    assert.match(readme, /pages\/ContactPage\.page\.ts/);
    assert.match(readme, /Driving the browser from an MCP client/);
    assert.equal(generateInfra([], { ...opts, mcp: false }).some(f => f.relPath === '.mcp.json'), false);
  });
});
