// Collector: third-party integrations. A vendor counts when its SDK is imported or when code calls
// one of its API hosts (fetch, axios, a base URL constant). Unknown outbound hosts are listed too.
// Only host names are kept from URLs: paths and query strings can carry tokens.
import { RepoFiles, isTestPath, sortUniq } from './files.js';

export interface Vendor { id: string; label: string; category: string; packages: string[]; hosts: RegExp[]; env: RegExp }
export interface Integration { id: string; label: string; category: string; packages: string[]; hosts: string[]; files: string[]; env: string[] }
export interface IntegrationsResult { integrations: Integration[]; other_hosts: { host: string; files: string[] }[] }

export const VENDORS: Vendor[] = [
  { id: 'stripe', label: 'Stripe', category: 'payments', packages: ['stripe', '@stripe/stripe-js', '@stripe/react-stripe-js'], hosts: [/(^|\.)stripe\.com$/], env: /^(NEXT_PUBLIC_)?STRIPE_/ },
  { id: 'resend', label: 'Resend', category: 'email', packages: ['resend'], hosts: [/(^|\.)resend\.(com|dev)$/], env: /^RESEND_/ },
  { id: 'sendgrid', label: 'SendGrid', category: 'email', packages: ['@sendgrid/mail'], hosts: [/sendgrid\.(com|net)$/], env: /^SENDGRID_/ },
  { id: 'postmark', label: 'Postmark', category: 'email', packages: ['postmark'], hosts: [/postmarkapp\.com$/], env: /^POSTMARK_/ },
  { id: 'mailgun', label: 'Mailgun', category: 'email', packages: ['mailgun.js', 'mailgun-js'], hosts: [/mailgun\.net$/], env: /^MAILGUN_/ },
  { id: 'nodemailer', label: 'SMTP (nodemailer)', category: 'email', packages: ['nodemailer'], hosts: [], env: /^SMTP_/ },
  { id: 'twilio', label: 'Twilio', category: 'sms / voice', packages: ['twilio'], hosts: [/(^|\.)twilio\.com$/], env: /^TWILIO_/ },
  { id: 'openai', label: 'OpenAI', category: 'ai', packages: ['openai', '@ai-sdk/openai'], hosts: [/(^|\.)openai\.com$/], env: /^OPENAI_/ },
  { id: 'anthropic', label: 'Anthropic', category: 'ai', packages: ['@anthropic-ai/sdk', '@ai-sdk/anthropic'], hosts: [/(^|\.)anthropic\.com$/], env: /^ANTHROPIC_/ },
  { id: 'google-ai', label: 'Google AI', category: 'ai', packages: ['@google/generative-ai', '@google/genai', '@ai-sdk/google'], hosts: [/generativelanguage\.googleapis\.com$/], env: /^(GEMINI|GOOGLE_AI|GOOGLE_GENERATIVE)_/ },
  { id: 'ghl', label: 'GoHighLevel (LeadConnector)', category: 'crm', packages: [], hosts: [/leadconnectorhq\.com$/, /gohighlevel\.com$/, /msgsndr\.com$/], env: /^(GHL|HIGHLEVEL|LEADCONNECTOR)_/ },
  { id: 'hubspot', label: 'HubSpot', category: 'crm', packages: ['@hubspot/api-client'], hosts: [/hubapi\.com$/], env: /^HUBSPOT_/ },
  { id: 'vercel-blob', label: 'Vercel Blob', category: 'storage', packages: ['@vercel/blob'], hosts: [/blob\.vercel-storage\.com$/], env: /^BLOB_/ },
  { id: 's3', label: 'AWS S3', category: 'storage', packages: ['@aws-sdk/client-s3', 'aws-sdk'], hosts: [/amazonaws\.com$/], env: /^(AWS|S3)_/ },
  { id: 'cloudinary', label: 'Cloudinary', category: 'storage', packages: ['cloudinary'], hosts: [/cloudinary\.com$/], env: /^CLOUDINARY_/ },
  { id: 'upstash', label: 'Upstash', category: 'infrastructure', packages: ['@upstash/redis', '@upstash/ratelimit', '@upstash/qstash'], hosts: [/upstash\.io$/], env: /^(UPSTASH|QSTASH|KV)_/ },
  { id: 'google', label: 'Google APIs', category: 'productivity', packages: ['googleapis', 'google-auth-library'], hosts: [/(^|\.)googleapis\.com$/], env: /^GOOGLE_(?!AI|GENERATIVE)/ },
  { id: 'github', label: 'GitHub API', category: 'developer', packages: ['@octokit/rest', 'octokit', '@octokit/core'], hosts: [/api\.github\.com$/], env: /^GITHUB_/ },
  { id: 'slack', label: 'Slack', category: 'messaging', packages: ['@slack/web-api', '@slack/bolt'], hosts: [/slack\.com$/], env: /^SLACK_/ },
  { id: 'sentry', label: 'Sentry', category: 'monitoring', packages: ['@sentry/nextjs', '@sentry/node', '@sentry/react'], hosts: [/sentry\.io$/], env: /^(NEXT_PUBLIC_)?SENTRY_/ },
  { id: 'posthog', label: 'PostHog', category: 'analytics', packages: ['posthog-js', 'posthog-node'], hosts: [/posthog\.com$/], env: /^(NEXT_PUBLIC_)?POSTHOG_/ },
  { id: 'vercel-analytics', label: 'Vercel Analytics', category: 'analytics', packages: ['@vercel/analytics', '@vercel/speed-insights'], hosts: [], env: /^$/ },
  { id: 'plaid', label: 'Plaid', category: 'banking', packages: ['plaid'], hosts: [/plaid\.com$/], env: /^PLAID_/ },
  { id: 'supabase', label: 'Supabase', category: 'backend', packages: ['@supabase/supabase-js'], hosts: [/supabase\.co$/], env: /^(NEXT_PUBLIC_)?SUPABASE_/ },
  { id: 'firebase', label: 'Firebase', category: 'backend', packages: ['firebase', 'firebase-admin'], hosts: [/firebaseio\.com$/], env: /^(NEXT_PUBLIC_)?FIREBASE_/ },
  { id: 'clerk', label: 'Clerk', category: 'auth', packages: ['@clerk/nextjs', '@clerk/clerk-sdk-node'], hosts: [/clerk\.(com|dev)$/], env: /^(NEXT_PUBLIC_)?CLERK_/ },
  { id: 'google-oauth', label: 'Google sign-in', category: 'auth', packages: [], hosts: [/accounts\.google\.com$/, /oauth2\.googleapis\.com$/], env: /^(AUTH_GOOGLE|GOOGLE_CLIENT)_/ },
  { id: 'calendly', label: 'Calendly', category: 'scheduling', packages: [], hosts: [/calendly\.com$/], env: /^CALENDLY_/ },
  { id: 'railway', label: 'Railway (service call)', category: 'infrastructure', packages: [], hosts: [/\.up\.railway\.app$/], env: /^RAILWAY_/ },
];

const IGNORED_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$|(^|\.)(example|invalid|test|localhost)$|(^|\.)example\.(com|org|net)$|^(www\.)?w3\.org$|^schema\.org$|^json-schema\.org$|^fonts\.(googleapis|gstatic)\.com$/;
const CALL_CONTEXT = /fetch\s*\)?\s*\(|axios|\bgot\s*\(|\bky\b|baseURL|base_?url|endpoint|api_?url|_URL\s*=|\bURL\s*\(|request\s*\(|webhook/i;
/** An upper-case API/base/host constant set to a URL: `const API = 'https://api.vendor.com/v1'`. */
const URL_CONSTANT = /\b[A-Z][A-Z0-9_]*\s*=\s*['"`]https?:\/\//;

/** Host names of absolute URLs on lines that make or configure an outbound call. */
export function outboundHosts(src: string): string[] {
  const hosts: string[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // The call may open a line or two above the URL (`fetch(\n  `https://…`,`).
    const comment = /^\s*(\*|\/\/|\/\*)/.test(line);
    const context = comment ? line : `${lines[i - 2] ?? ''}\n${lines[i - 1] ?? ''}\n${line}`;
    if (!URL_CONSTANT.test(line) && !(/https?:\/\//.test(line) && CALL_CONTEXT.test(context))) continue;
    for (const m of line.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[:/'"`?\s$]|$)/gi)) {
      const h = m[1]!.toLowerCase();
      if (!IGNORED_HOSTS.test(h)) hosts.push(h);
    }
  }
  return hosts;
}

export function importedPackages(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"./][^'"]*)['"]/g)) {
    const spec = m[1]!;
    out.push(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]!);
  }
  return out;
}

export function vendorOfPackage(pkg: string): Vendor | undefined { return VENDORS.find(v => v.packages.includes(pkg)); }
export function vendorOfHost(host: string): Vendor | undefined { return VENDORS.find(v => v.hosts.some(h => h.test(host))); }

export function collectIntegrations(repo: RepoFiles, envNames: string[] = []): IntegrationsResult {
  const hits = new Map<string, { pkgs: Set<string>; hosts: Set<string>; files: Set<string> }>();
  const other = new Map<string, Set<string>>();
  const hit = (id: string) => { let h = hits.get(id); if (!h) { h = { pkgs: new Set(), hosts: new Set(), files: new Set() }; hits.set(id, h); } return h; };
  for (const f of repo.code()) {
    if (isTestPath(f)) continue;
    const src = repo.text(f); if (!src) continue;
    for (const p of importedPackages(src)) { const v = vendorOfPackage(p); if (v) { const h = hit(v.id); h.pkgs.add(p); h.files.add(f); } }
    for (const host of outboundHosts(src)) {
      const v = vendorOfHost(host);
      if (v) { const h = hit(v.id); h.hosts.add(host); h.files.add(f); } else { const s = other.get(host) ?? new Set(); s.add(f); other.set(host, s); }
    }
  }
  const integrations = VENDORS.filter(v => hits.has(v.id)).map(v => {
    const h = hits.get(v.id)!;
    return { id: v.id, label: v.label, category: v.category, packages: [...h.pkgs].sort(), hosts: [...h.hosts].sort(), files: [...h.files].sort(), env: sortUniq(envNames.filter(n => v.env.source !== '^$' && v.env.test(n))) };
  });
  return { integrations, other_hosts: [...other.entries()].map(([host, fs]) => ({ host, files: [...fs].sort().slice(0, 8) })).sort((a, b) => a.host.localeCompare(b.host)) };
}
