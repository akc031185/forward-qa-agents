// Shared data shapes for the Forward Deployed Tester. Kept free of browser imports so the
// generators, report renderer and tests can use them without Playwright.
import type { ElementDescriptor, DerivedLocator } from './locators.js';

export interface InteractiveElement {
  descriptor: ElementDescriptor;
  locator: DerivedLocator;
  property: string;            // page-object property name (unique within the page)
}

export interface FailedRequest { url: string; status: number; method: string; resourceType: string }

export interface PageRecord {
  url: string;
  path: string;                // pathname + search, used for naming and baseURL-relative navigation
  title: string;
  status: number;              // 0 when navigation failed
  loadTimeMs: number;
  consoleErrors: string[];
  failedRequests: FailedRequest[];
  counts: { forms: number; buttons: number; links: number; inputs: number; images: number };
  hasLandmark: boolean;
  hasH1: boolean;
  h1Text?: string;
  imagesMissingAlt: number;
  unlabeledInputs: number;     // form controls with no label / aria-label / placeholder
  formsWithoutLabels: number;  // forms containing at least one unlabeled control
  elements: InteractiveElement[];
  discoveredLinks: string[];
  error?: string;              // navigation error message, if any
}

export interface BrokenLink { url: string; status: number; referrer: string; error?: string }

export interface CrawlResult {
  origin: string;
  startUrl: string;
  pages: PageRecord[];         // successfully rendered pages (status < 400, no navigation error)
  brokenLinks: BrokenLink[];   // same-origin links that answered 4xx/5xx or failed to load
  skipped: string[];           // discovered but not visited because of max_pages
  durationMs: number;
}

export interface AuthBasic { type: 'basic'; username: string; password: string }
export interface AuthCookie { type: 'cookie'; cookies: { name: string; value: string; domain: string }[] }
export type AuthConfig = AuthBasic | AuthCookie;

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  timeoutMs: number;
  headless: boolean;
  auth?: AuthConfig;
  log?: (msg: string) => void;
}

/** Raw, pre-locator data returned by the in-browser harvest script. */
export interface HarvestResult {
  title: string;
  hasH1: boolean;
  h1Text?: string;
  hasLandmark: boolean;
  imagesMissingAlt: number;
  unlabeledInputs: number;
  formsWithoutLabels: number;
  counts: PageRecord['counts'];
  links: string[];
  elements: ElementDescriptor[];
}
