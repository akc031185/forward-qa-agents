// Collector: inbound webhooks. Any API route whose path or file names a webhook, or whose handler
// reads a vendor signature header, and whether that handler verifies the signature.
import type { RepoFiles } from './files.js';
import type { Route } from './routes.js';
import type { ImportGraph } from './imports.js';
import { IDEMPOTENCY_RE, RAW_BODY_RE, SIGNATURE_CHECKS } from './signals.js';

export interface Webhook {
  path: string; methods: string[]; file: string; service: string;
  vendor?: string; verified: boolean; verification: string[]; raw_body: boolean; idempotency: boolean;
}

const VENDOR_WORDS = ['stripe', 'resend', 'twilio', 'github', 'ghl', 'highlevel', 'leadconnector', 'clerk', 'svix', 'calendly', 'slack', 'plaid', 'shopify', 'paypal', 'sendgrid', 'postmark', 'mailgun', 'vercel'];

export function inspectWebhook(src: string): Pick<Webhook, 'verified' | 'verification' | 'raw_body' | 'idempotency'> & { vendor?: string } {
  const found = SIGNATURE_CHECKS.filter(c => c.re.test(src));
  // A bare HMAC or timingSafeEqual without the other half is not a verification.
  const strong = found.filter(c => c.strong);
  const hmacPair = found.some(c => c.label === 'HMAC digest') && (found.some(c => c.label === 'constant-time comparison') || /===\s*\w*[Ss]ignature|[Ss]ignature\w*\s*===|!==\s*\w*[Ss]ignature/.test(src));
  return {
    verified: strong.length > 0 || hmacPair,
    verification: found.map(c => c.label),
    raw_body: RAW_BODY_RE.test(src),
    idempotency: IDEMPOTENCY_RE.test(src),
    vendor: found.find(c => c.vendor)?.vendor,
  };
}

/** Verification is looked for in the handler and in the helpers it imports (one hop). */
export function collectWebhooks(repo: RepoFiles, routes: Route[], graph?: ImportGraph): Webhook[] {
  const out: Webhook[] = [];
  for (const r of routes.filter(x => x.kind === 'api')) {
    const src = repo.text(r.file) ?? '';
    const named = /webhook|\/hooks?\b|callback\/(stripe|twilio|resend)/i.test(r.path) || /webhook/i.test(r.file);
    const i = inspectWebhook(graph ? graph.reachText(r.file, 1) : src);
    if (!named && !SIGNATURE_CHECKS.some(c => c.vendor && c.re.test(src))) continue;
    const segs = r.path.toLowerCase().split('/');
    const pathVendor = VENDOR_WORDS.find(w => r.path.toLowerCase().includes(w) || r.file.toLowerCase().includes(`/${w}`))
      ?? (segs.some(s => s === 'cal' || s === 'calcom' || s === 'cal-com') ? 'cal.com' : undefined);
    const vendor = (pathVendor === 'highlevel' || pathVendor === 'leadconnector') ? 'ghl' : pathVendor ?? i.vendor;
    out.push({ path: r.path, methods: r.methods, file: r.file, service: r.service, vendor, verified: i.verified, verification: i.verification, raw_body: i.raw_body, idempotency: i.idempotency });
  }
  return out;
}
