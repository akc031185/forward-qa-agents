// Small pure parsers: sitemap XML, llms.txt shape, secrets in JavaScript bundles, placeholder copy,
// and the default titles and badges that AI site builders leave behind.

/** `<loc>` entries of a urlset or sitemapindex. */
export function parseSitemap(xml: string): { kind: 'urlset' | 'index' | 'unknown'; locs: string[] } {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? 'index' : /<urlset[\s>]/i.test(xml) ? 'urlset' : 'unknown';
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]!.replace(/&amp;/g, '&'));
  return { kind, locs };
}

/** llms.txt per llmstxt.org: an H1 with the site name is the only required element. */
export function checkLlmsTxt(text: string): { ok: boolean; h1?: string; links: number; problems: string[] } {
  const problems: string[] = [];
  const trimmed = text.trim();
  if (/^<!doctype html|^<html/i.test(trimmed)) return { ok: false, links: 0, problems: ['served HTML, not markdown (probably an SPA fallback page)'] };
  const h1 = /^#\s+(.+)$/m.exec(trimmed)?.[1]?.trim();
  if (!h1) problems.push('no "# Site name" heading');
  const links = [...trimmed.matchAll(/\[[^\]]+\]\([^)]+\)/g)].length;
  if (!links) problems.push('no markdown links to key pages');
  return { ok: problems.length === 0, h1, links, problems };
}

export interface SecretHit { kind: string; severity: 'critical' | 'high' | 'info'; preview: string; note: string }

/** Show enough to find it, never enough to use it. */
export function redact(value: string): string {
  return `${value.slice(0, 6)}…(${value.length} chars)`;
}

function jwtPayload(token: string): Record<string, unknown> | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try { return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return undefined; }
}

const SECRET_PATTERNS: { kind: string; re: RegExp; severity: SecretHit['severity']; note: string }[] = [
  { kind: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, severity: 'critical', note: 'Anyone can bill requests to this key. Revoke it and call the API from a server.' },
  { kind: 'OpenAI API key', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g, severity: 'critical', note: 'Anyone can bill requests to this key. Revoke it and call the API from a server.' },
  { kind: 'Stripe secret key', re: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}/g, severity: 'critical', note: 'Full account access. Roll it in the Stripe dashboard.' },
  { kind: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'critical', note: 'Rotate in IAM; a secret key is usually nearby.' },
  { kind: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, severity: 'critical', note: 'Revoke in GitHub settings.' },
  { kind: 'Private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'critical', note: 'A private key shipped to every visitor.' },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: 'info', note: 'Browser keys are normal for Maps/Firebase; confirm it is restricted by referrer and API.' },
];

/** Scan bundle text for credentials. Supabase JWTs are decoded: anon is expected, service_role is not. */
export function findSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const seen = new Set<string>();
  for (const p of SECRET_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const v = m[0];
      if (seen.has(v)) continue;
      seen.add(v);
      hits.push({ kind: p.kind, severity: p.severity, preview: redact(v), note: p.note });
    }
  }
  for (const m of text.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    const v = m[0];
    if (seen.has(v)) continue;
    seen.add(v);
    const role = jwtPayload(v)?.role;
    if (role === 'service_role') hits.push({ kind: 'Supabase service_role key', severity: 'critical', preview: redact(v), note: 'Bypasses row-level security for the whole database. Rotate the JWT secret now.' });
  }
  return hits;
}

const PLACEHOLDERS: [RegExp, string][] = [
  [/\blorem ipsum\b/i, 'lorem ipsum'],
  [/\byour company name\b|\bcompany name here\b|\byour business name\b/i, '"Your company name"'],
  [/\b(?:john|jane) doe\b/i, 'John/Jane Doe'],
  [/\b123 main st(?:reet)?\b/i, '123 Main Street'],
  [/\(555\)\s?\d{3}-\d{4}|\b555-\d{4}\b/, '555 phone number'],
  [/\b(?:hello|info|contact|you)@(?:example|yourdomain|company|domain)\.com\b/i, 'example email address'],
  [/\bacme (?:inc|corp|co)\b/i, 'Acme Inc'],
  [/\[(?:insert|your) [^\]]{2,30}\]/i, '[Insert …] bracket'],
  [/\btestimonial text goes here\b|\badd your (?:text|content) here\b/i, '"add your text here"'],
];

export function findPlaceholders(text: string): string[] {
  return PLACEHOLDERS.filter(([re]) => re.test(text)).map(([, label]) => label);
}

/** Titles the scaffolds ship with. Lower-cased, exact. */
export const DEFAULT_TITLES = ['vite + react', 'vite + react + ts', 'vite app', 'react app', 'create next app', 'lovable app', 'lovable generated project', 'my v0 project', 'v0 app', 'bolt', 'my google ai studio app', 'replit', 'document', 'untitled'];

export interface BuilderSign { builder: string; evidence: string }

/** Fingerprints of AI site builders in rendered HTML: harmless alone, a tell when branding was forgotten. */
export function builderSigns(html: string): BuilderSign[] {
  const out: BuilderSign[] = [];
  const add = (builder: string, re: RegExp, evidence: string) => { if (re.test(html)) out.push({ builder, evidence }); };
  add('Lovable', /lovable-badge|Edit with Lovable|lovable\.dev\/projects/i, 'Lovable badge or project link');
  add('Lovable', /cdn\.gpteng\.co|gptengineer\.js/i, 'gpt-engineer script');
  add('Bolt', /Made (?:in|with) Bolt|bolt\.new\/?["'?]/i, 'Bolt badge or link');
  add('v0', /v0\.dev\/chat|Built with v0/i, 'v0 link');
  add('Vite scaffold', /href="\/vite\.svg"/i, 'default Vite favicon');
  add('Create React App scaffold', /You need to enable JavaScript to run this app\./i, 'default CRA noscript text');
  return out;
}
