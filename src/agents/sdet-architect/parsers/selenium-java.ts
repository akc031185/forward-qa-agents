// Selenium Java parser (JUnit 4/5, TestNG, Cucumber step definitions, PageFactory page objects).
import type { TestSuite } from '../model.js';
import { buildSuite, hasStepAnnotations, hasTestAnnotations } from './cfamily.js';

export function isSeleniumJava(src: string): boolean {
  return /org\.openqa\.selenium|\bBy\.(id|name|cssSelector|xpath|className|linkText|partialLinkText|tagName)\(/.test(src);
}

export function classifyJava(src: string): TestSuite['kind'] {
  if (hasStepAnnotations(src, 'java') || /io\.cucumber/.test(src)) return 'step-definitions';
  if (hasTestAnnotations(src, 'java')) return 'selenium-java';
  if (isSeleniumJava(src)) return 'page-object';
  return 'unknown';
}

export function parseSeleniumJava(src: string, file: string, kind: TestSuite['kind'] = classifyJava(src)): TestSuite {
  return buildSuite(src, 'java', file, kind);
}
