// Data shapes for The AI Site Auditor. Browser-free, so rules and reports are testable in isolation.
import type { Robots } from './robots.js';
import type { DesignRaw } from './design.js';
import type { EssentialsRaw } from './essentials.js';

/** What the in-page extraction script returns, for either view of a page. */
export interface PageView {
  title: string;
  metaDescription?: string;
  canonical?: string;
  robotsMeta?: string;
  lang?: string;
  viewport: boolean;
  h1: string[];
  headings: number;
  words: number;
  textSample: string;            // first ~3000 characters of body text, for placeholder checks
  links: string[];               // absolute hrefs
  hashRouteLinks: number;        // href="#/..." style routes
  images: number;
  imagesMissingAlt: number;
  jsonLd: { types: string[]; errors: number; blocks: number };
  og: { title?: string; description?: string; image?: string; url?: string; type?: string };
  twitterCard?: string;
  hreflang: number;
  favicon: boolean;
  generator?: string;
  html: string;                  // outerHTML, capped, for fingerprints
}

export interface PageAudit {
  url: string;
  path: string;
  status: number;                // raw response status
  contentType?: string;
  raw?: PageView;                // JavaScript off: what non-rendering crawlers get
  rendered?: PageView;           // JavaScript on: what a browser and Googlebot eventually see
  loadMs: number;
  loadTimedOut?: boolean;        // the load event had not fired after 8 s
  consoleErrors: string[];
  failedRequests: { url: string; status: number }[];
  mixedContent: string[];
  scripts: string[];             // same-origin script URLs seen while rendering
  jsBytes: number;
  design?: DesignRaw;            // computed-style and CSSOM measurements, rendered view only
  essentials?: EssentialsRaw;    // policy links, forms, third parties, consent; rendered view only
  error?: string;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  ms: number;
  error?: string;
}

export interface BotProbe { token: string; status: number; words: number; blockedLike: boolean; error?: string }

export interface SiteFacts {
  origin: string;
  startUrl: string;
  https: boolean;
  robots?: { status: number; text: string; parsed: Robots };
  sitemaps: { url: string; status: number; kind: string; urls: number; sampleBroken: string[] }[];
  llmsTxt?: { status: number; ok: boolean; h1?: string; links: number; problems: string[] };
  softNotFound: { url: string; status: number; title: string; words: number; links: number };
  httpRedirect?: { status: number; location?: string };
  envExposed?: { status: number; looksLikeEnv: boolean };
  securityHeaders: Record<string, string | undefined>;
  botProbes: BotProbe[];
  secrets: { script: string; kind: string; severity: 'critical' | 'high' | 'info'; preview: string; note: string }[];
  sourceMaps: string[];
  pages: PageAudit[];
  skipped: string[];
  durationMs: number;
}

export type Area = 'ai-visibility' | 'search' | 'build' | 'design' | 'readiness';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** One evaluated check. Per-page problems are aggregated into one result listing the pages. */
export interface CheckResult {
  id: string;
  area: Area;
  severity: Severity;
  title: string;
  why: string;
  fix: string;
  pages?: string[];
  evidence?: unknown;
  source?: string;
}
