// Common intermediate model shared by every parser and generator of the SDET Architect.
// Parsers turn source text into TestSuite; generators turn TestSuite into Playwright code.

export type FileKind =
  | 'selenium-java' | 'selenium-python' | 'selenium-csharp' | 'selenium-js' | 'cypress'
  | 'cucumber-feature' | 'step-definitions' | 'page-object' | 'postman-collection'
  | 'test-plan' | 'config' | 'unknown';

export const FILE_KINDS: FileKind[] = [
  'selenium-java', 'selenium-python', 'selenium-csharp', 'selenium-js', 'cypress',
  'cucumber-feature', 'step-definitions', 'page-object', 'postman-collection',
  'test-plan', 'config', 'unknown',
];

export type Language = 'java' | 'python' | 'csharp' | 'javascript' | 'typescript' | 'gherkin' | 'postman' | 'markdown' | 'unknown';

export type LocatorStrategy =
  | 'id' | 'name' | 'css' | 'xpath' | 'className' | 'linkText' | 'partialLinkText' | 'tagName' | 'text' | 'testId';

export interface SourceRef { file: string; line: number }

export interface Locator {
  strategy: LocatorStrategy;
  value: string;
  source: SourceRef;
  /** Field/variable name the locator was bound to in the source (page-object field, By variable). */
  alias?: string;
}

export type StepKind =
  | 'navigate' | 'click' | 'fill' | 'clear' | 'select' | 'assert' | 'wait' | 'hover' | 'press' | 'call' | 'read' | 'unknown';

export type AssertionType =
  | 'text' | 'containsText' | 'visible' | 'hidden' | 'enabled' | 'title' | 'titleContains'
  | 'url' | 'urlContains' | 'attribute' | 'value' | 'count' | 'pageContains';

export interface Assertion {
  type: AssertionType;
  expected?: string;
  /** Expression (method parameter) to compare against when `expected` is not a literal. */
  expectedExpr?: string;
  /** Attribute name for `attribute` assertions. */
  attribute?: string;
  negate?: boolean;
}

export interface Step {
  kind: StepKind;
  locator?: Locator;
  /** Literal value (fill text, select option, url, key name, wait ms). */
  value?: string;
  /** Non-literal expression for the value (identifier/param name) when `value` is not a literal. */
  valueExpr?: string;
  /** Select by value (`selectByValue`) instead of visible text. */
  byValue?: boolean;
  /** For `wait`: true when it is a hard sleep. */
  hard?: boolean;
  assertion?: Assertion;
  /** For `call`: page-object class and method. */
  call?: { object: string; method: string; args: string[] };
  raw: string;
  line: number;
}

export interface PageMethod { name: string; params: string[]; steps: Step[]; line: number }

export interface PageObject {
  name: string;
  source: string;
  locators: Locator[];
  methods: PageMethod[];
}

export interface Hook { kind: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll'; name: string; steps: Step[]; line: number }

export interface TestCase { name: string; line: number; steps: Step[]; tags?: string[] }

export interface Scenario { name: string; line: number; steps: GherkinStep[]; outline: boolean; examples?: { headers: string[]; rows: string[][] }; tags: string[] }
export interface GherkinStep { keyword: string; text: string; line: number }
export interface Feature { name: string; tags: string[]; background: GherkinStep[]; scenarios: Scenario[] }

export interface StepDefinition {
  keyword: string;           // Given / When / Then
  pattern: string;           // cucumber expression or regex, as written
  regex: string;             // normalised regex source
  params: string[];
  steps: Step[];
  line: number;
  source: string;
}

export interface ApiRequest {
  name: string;
  folder: string[];
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body?: string;
  expectedStatus?: number;
  /** Raw postman test script lines (for TODOs). */
  testScript: string[];
}

export interface TestSuite {
  source: string;            // path relative to source_dir
  language: Language;
  kind: FileKind;
  className?: string;
  tests: TestCase[];
  pageObjects: PageObject[];
  hooks: Hook[];
  /** Every locator occurrence found in the file (page-object fields included). */
  locators: Locator[];
  /** Absolute URLs the file navigates to (for base URL detection). */
  urls: string[];
  /** String constants declared at class/module level. */
  constants: Record<string, string>;
  feature?: Feature;
  stepDefinitions?: StepDefinition[];
  requests?: ApiRequest[];
  /** Collection variables (Postman). */
  variables?: Record<string, string>;
}

export function emptySuite(source: string, language: Language, kind: FileKind): TestSuite {
  return { source, language, kind, tests: [], pageObjects: [], hooks: [], locators: [], urls: [], constants: {} };
}
