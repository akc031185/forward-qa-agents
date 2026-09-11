import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFile, countByKind, globToRegExp, inventory, matchesAny } from '../../src/agents/sdet-architect/inventory.js';
import { FIXTURES, read } from './helpers.js';

test('glob matcher handles **, * and braces', () => {
  assert.ok(globToRegExp('**/*.java').test('src/test/java/A.java'));
  assert.ok(globToRegExp('**/*.java').test('A.java'));
  assert.ok(!globToRegExp('**/*.java').test('src/A.py'));
  assert.ok(globToRegExp('**/node_modules/**').test('a/node_modules/b/c.js'));
  assert.ok(globToRegExp('**/*.{js,ts}').test('x/y.ts'));
  assert.ok(matchesAny('target/classes/A.class', ['**/target/**']));
});

test('classifyFile recognises every fixture kind', () => {
  assert.equal(classifyFile('src/test/java/x/CheckoutTest.java', read('src/test/java/com/fabricated/shop/tests/CheckoutTest.java')), 'selenium-java');
  assert.equal(classifyFile('x/LoginPage.java', read('src/test/java/com/fabricated/shop/pages/LoginPage.java')), 'page-object');
  assert.equal(classifyFile('x/LoginSteps.java', read('src/test/java/com/fabricated/shop/steps/LoginSteps.java')), 'step-definitions');
  assert.equal(classifyFile('python/test_cart.py', read('python/test_cart.py')), 'selenium-python');
  assert.equal(classifyFile('dotnet/AccountTests.cs', read('dotnet/AccountTests.cs')), 'selenium-csharp');
  assert.equal(classifyFile('js/profile.test.js', read('js/profile.test.js')), 'selenium-js');
  assert.equal(classifyFile('features/login.feature', read('features/login.feature')), 'cucumber-feature');
  assert.equal(classifyFile('postman/shop.json', read('postman/shop-api.postman_collection.json')), 'postman-collection');
  assert.equal(classifyFile('docs/regression-test-plan.md', read('docs/regression-test-plan.md')), 'test-plan');
  assert.equal(classifyFile('pom.xml', read('pom.xml')), 'config');
  assert.equal(classifyFile('testng.xml', read('testng.xml')), 'config');
  assert.equal(classifyFile('x/other.json', '{"a":1}'), 'unknown');
  assert.equal(classifyFile('cy/login.cy.js', "describe('x', () => { it('y', () => { cy.visit('/'); cy.get('#a').click(); }); });"), 'cypress');
  assert.equal(classifyFile('README.md', '# hello\nworld'), 'unknown');
});

test('inventory walks the fixture estate with expected counts', () => {
  const { entries, contents } = inventory(FIXTURES);
  const counts = countByKind(entries);
  assert.equal(entries.length, 12);
  assert.deepEqual(counts, {
    'selenium-java': 2, 'selenium-python': 1, 'selenium-csharp': 1, 'selenium-js': 1, cypress: 0,
    'cucumber-feature': 1, 'step-definitions': 1, 'page-object': 1, 'postman-collection': 1, 'test-plan': 1, config: 2, unknown: 0,
  });
  assert.equal(contents.size, 12);
  const excluded = inventory(FIXTURES, { exclude: ['**/dotnet/**'] });
  assert.equal(countByKind(excluded.entries)['selenium-csharp'], 0);
  const only = inventory(FIXTURES, { include: ['**/*.java'] });
  assert.equal(only.entries.length, 4);
});
