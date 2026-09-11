# The SDET Architect

**Plate 45** · `sdet-architect`

> Walks into any org, inventories whatever test artefacts they have — Selenium in any language, Cucumber features, Postman collections, plain test plans — and rebuilds them as ONE standardised Playwright + Playwright MCP architecture. Fully deterministic; no paid model required.

## The chore

Every engagement starts the same way. There is a `selenium-java` module nobody has run since the last Chrome upgrade, a Python folder a contractor left behind, a .NET project that only builds on one laptop, a `.feature` file whose step definitions drifted, a Postman collection with the real API expectations buried in `pm.test` scripts, and a markdown test plan that is the only honest description of what the business cares about. Someone senior spends three weeks reading all of it, keeps a spreadsheet of locators, and hand-writes Playwright — then the spreadsheet goes stale the day it is finished.

## Instead

Point the agent at the folder. It produces a single Playwright project with page objects, fixtures, specs, API tests, BDD steps, CI, an MCP server entry, and a `MIGRATION.md` that lists every line it could not convert with its source `file:line`. The human work is the TODO list, not the archaeology.

## How it works

1. **Inventory.** Walks `source_dir` (respecting include/exclude globs) and classifies every file: `selenium-java`, `selenium-python`, `selenium-csharp`, `selenium-js`, `cypress`, `cucumber-feature`, `step-definitions`, `page-object`, `postman-collection`, `test-plan`, `config`, `unknown`. Produces counts and a per-file table.
2. **Extraction.** Regex/line-based parsers (no AST libraries) turn each file into a common intermediate model — `TestSuite { tests, pageObjects, hooks, locators }` with `Step { kind, locator, value, assertion }`. It tracks variables (`WebElement el = driver.findElement(...)`), class constants (`BASE_URL + "/cart"`), `@FindBy`/`By` page-object fields, JUnit-vs-TestNG argument order, Keys/`Key.RETURN`, `Select`/`SelectElement`, explicit and hard waits, and page-object method calls from test classes.
3. **Locator standardisation.** Each locator is mapped to the most robust Playwright form with a confidence score: `id` → `#x`, `name` → `[name="x"]`, `linkText` → `getByRole('link', …)`, simple xpaths (`//tag[@id=…]`, `[text()=…]`, `contains(text(),…)`, attribute chains) → css/`getByText`/`getByRole`, anything else stays `xpath=` at low confidence. Everything under 0.60 becomes a `locator` finding.
4. **Generation.** Writes the standard architecture into `<workspace>/playwright/`: `package.json`, `playwright.config.ts`, `.mcp.json`, `tsconfig.json`, `src/pages/*.page.ts` (one per detected page object, plus one per test class for its inline locators), `src/fixtures/index.ts`, `tests/*.spec.ts`, `tests/features/*.feature` + `tests/steps/*.steps.ts` (playwright-bdd style), `tests/api/*.spec.ts` (Postman → `request` fixture), `.github/workflows/playwright.yml`, and `MIGRATION.md`. Unconvertible lines become `// TODO(sdet-architect): <original>  [file:line]`; a test that is mostly TODOs gets `test.fixme`.
5. **Findings.** `conversion` (each TODO), `flakiness` (every `Thread.sleep`/`time.sleep`/`driver.sleep` removed), `duplication` (the same locator in several files), `quality` (tests with no assertion), `locator` (low confidence).
6. **Optional model assist.** With `LLM_PROVIDER` set, leftovers are sent once for a one-line suggestion which is emitted as a *comment* next to the TODO. With the default `none`, output is byte-for-byte deterministic.

## Under the hood

**Input**

| Field | Type | Notes |
|---|---|---|
| `source_dir` | string | absolute path to the legacy estate |
| `org_slug` | string | used for the generated package name |
| `include` / `exclude` | string[] | globs; exclude defaults to node_modules, target, bin, obj, .git, dist, build |
| `base_url` | url | optional; otherwise the most common navigated origin is detected |
| `language_hint` | enum | `java` `python` `csharp` `javascript` `typescript` `auto` (default) |
| `dry_run` | boolean | compute everything, write nothing |

**Output**

`{ inventory, files_scanned, tests_found, tests_converted, tests_partial, tests_manual, locators_total, locators_low_confidence, coverage_pct, output_dir, migration_report }` — `coverage_pct` is converted steps ÷ total steps.

**Extra routes**

- `GET /agents/sdet-architect/runs/:id/migration` → `MIGRATION.md` as `text/markdown`
- `POST /agents/sdet-architect/preview` `{ language?, code, filename?, base_url? }` → converted spec text for one file, no disk, no DB

**Layout:** `src/agents/sdet-architect/{index,cli,convert,inventory,locators,report,model}.ts`, `parsers/{common,cfamily,selenium-java,selenium-python,selenium-csharp,selenium-js,cucumber,postman}.ts`, `generators/{steps,plan,pages,spec,bdd,api,project}.ts`. Parsers and generators are pure functions on strings.

## Runbook

```bash
# one-shot CLI (creates an engagement, runs, prints output JSON and the MIGRATION.md path)
npm run agent:sdet -- --src /abs/path/to/legacy-tests --org acme
npm run agent:sdet -- --src /abs/path/to/legacy-tests --org acme --base-url https://app.acme.example.test --dry-run
npm run agent:sdet -- --src /abs/path/to/legacy-tests --org acme --include "**/*.java" --exclude "**/archive/**"

# try it on the bundled fabricated estate
npm run agent:sdet -- --src "$PWD/fixtures/sdet-architect" --org fabricated-shop

# REST
npm start
curl -s -X POST localhost:8787/engagements -H 'content-type: application/json' -d '{"org":"acme","name":"selenium migration"}'
curl -s -X POST localhost:8787/agents/sdet-architect/runs -H 'content-type: application/json' \
  -d '{"engagement_id":"<id>","input":{"source_dir":"/abs/path/to/legacy-tests","org_slug":"acme"}}'
curl -s localhost:8787/agents/sdet-architect/runs/<run_id>/migration
curl -s -X POST localhost:8787/agents/sdet-architect/preview -H 'content-type: application/json' \
  -d "{\"language\":\"java\",\"code\":$(jq -Rs . < LoginTest.java)}" | jq -r .spec

# then, inside the generated project
cd workspace/<run_id>/playwright && npm install && npx playwright install --with-deps
BASE_URL=https://staging.acme.example.test npm test
npm run mcp          # Playwright MCP server for any MCP client; .mcp.json is already in place
```

Tests: `npm test` (parsers, locator table, generators, one end-to-end run that also compiles the generated project with `tsc`).

## Example output

Trimmed `MIGRATION.md` from the bundled fabricated estate (`fixtures/sdet-architect`):

```markdown
# Migration report: fabricated-shop -> Playwright + Playwright MCP

- Files scanned: 12
- Tests found: 28 — converted 24, partial 2, manual 2
- **Conversion coverage: 91.7%** (99/108 steps emitted as Playwright code, the rest are TODOs)
- Locators: 38 unique, 3 below the 0.60 confidence threshold
- Model assistance: none (LLM_PROVIDER=none) — output is fully deterministic

## 1. Inventory
| Kind | Files |
|---|---:|
| selenium-java | 2 |
| selenium-python | 1 |
| selenium-csharp | 1 |
| selenium-js | 1 |
| cucumber-feature | 1 |
| step-definitions | 1 |
| page-object | 1 |
| postman-collection | 1 |
| test-plan | 1 |
| config | 2 |

## 2. Per-file conversion status
| Source | Kind | Generated | Status | Tests | Converted | Partial | Manual |
|---|---|---|---|---:|---:|---:|---:|
| `src/test/java/.../pages/LoginPage.java` | page-object | `src/pages/Login.page.ts` | converted | 4 | 4 | 0 | 0 |
| `src/test/java/.../tests/CheckoutTest.java` | selenium-java | `tests/CheckoutTest.spec.ts` | partial | 3 | 2 | 1 | 0 |
| `python/test_cart.py` | selenium-python | `tests/test_cart.spec.ts` | converted | 3 | 3 | 0 | 0 |
| `features/login.feature` | cucumber-feature | `tests/features/login.feature + tests/steps/login.steps.ts` | converted | 3 | 3 | 0 | 0 |
| `postman/shop-api.postman_collection.json` | postman-collection | `tests/api/shop-api.spec.ts` | partial | 4 | 3 | 1 | 0 |
| `docs/regression-test-plan.md` | test-plan | `tests/regression-test-plan.spec.ts` | manual | 2 | 0 | 0 | 2 |

## 3. TODO list (10)
| # | Source | Where | Original line |
|---:|---|---|---|
| 1 | `src/test/java/.../CheckoutTest.java:71` | legacyHelperOnly | `takeScreenshotAndUpload(driver, "account")` |
| 2 | `postman/shop-api.postman_collection.json:-` | Catalog / Get product by id | `const body = pm.response.json(); \| pm.expect(body.sku).to.eql('sku-1001');` |
| 3 | `docs/regression-test-plan.md:6` | TC-01 Guest checkout with a promo code | `Apply promo code WELCOME10 at checkout` |

## 4. Locator confidence
| Source | Strategy | Value | Generated | Confidence | Why |
|---|---|---|---|---:|---|
| `CheckoutTest.java:72` | xpath | `/html/body/div[2]/div/div[3]/ul/li[4]/a` | `page.locator('xpath=/html/body/...')` | 0.20 | absolute xpath is brittle |
| `CheckoutTest.java:46` | xpath | `//div[@class='product-card'][1]//button[contains(text(),'Add to cart')]` | `page.locator('div[class="product-card"]:nth-of-type(1) button:has-text("Add to cart")')` | 0.50 | positional index in xpath |
```

And a generated spec, for flavour:

```ts
test('addItemToCartAndCheckout', async ({ page, checkoutPage, loginPage }) => {
  await page.goto('/catalog');
  await checkoutPage.searchBox.fill('wireless mouse');
  await checkoutPage.searchSubmit.click();
  // NOTE(sdet-architect): removed hard wait 2000ms (Thread.sleep(2000)); Playwright auto-waits on actions and expect().  [src/test/java/.../CheckoutTest.java:45]
  await checkoutPage.cartElement.click();
  await expect(checkoutPage.cartCount).toHaveText('1');
  await checkoutPage.shippingMethod.selectOption({ label: 'Express (1-2 days)' });
  await expect(page).toHaveTitle('Order confirmed - Fabricated Shop');
});
```
