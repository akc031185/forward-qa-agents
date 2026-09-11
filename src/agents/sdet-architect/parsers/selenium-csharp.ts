// Selenium C# parser (NUnit, MSTest, xUnit, SpecFlow bindings, page objects).
import type { TestSuite } from '../model.js';
import { buildSuite, hasStepAnnotations, hasTestAnnotations } from './cfamily.js';

export function isSeleniumCSharp(src: string): boolean {
  return /OpenQA\.Selenium|\bBy\.(Id|Name|CssSelector|XPath|ClassName|LinkText|PartialLinkText|TagName)\(/.test(src);
}

export function classifyCSharp(src: string): TestSuite['kind'] {
  if (hasStepAnnotations(src, 'csharp') || /TechTalk\.SpecFlow|\[Binding\]/.test(src)) return 'step-definitions';
  if (hasTestAnnotations(src, 'csharp')) return 'selenium-csharp';
  if (isSeleniumCSharp(src)) return 'page-object';
  return 'unknown';
}

export function parseSeleniumCSharp(src: string, file: string, kind: TestSuite['kind'] = classifyCSharp(src)): TestSuite {
  return buildSuite(src, 'csharp', file, kind);
}
