// The optional facts file: what the owner states and the code cannot show (domains, hosting
// accounts, owning entity, costs, accounts to transfer, known gaps, handover steps, contracts with
// other apps). Validated strictly, so a typo fails loudly instead of silently vanishing, and
// rejected outright if it appears to contain a credential: the dossier is meant to be shared.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { isSecretLikePath } from './files.js';

const text = z.string().min(1).max(2000);
const short = z.string().min(1).max(200);

export const FactsSchema = z.object({
  app: z.object({ name: short.optional(), one_liner: text.optional(), status: short.optional(), urls: z.array(short).max(20).optional() }).strict().optional(),
  owner: z.object({ entity: short.optional(), jurisdiction: short.optional(), contact_role: short.optional(), ip_assignment: text.optional() }).strict().optional(),
  domains: z.array(z.object({ domain: short, registrar: short.optional(), dns: short.optional(), purpose: short.optional(), renews: short.optional() }).strict()).max(50).optional(),
  hosting: z.array(z.object({ provider: short, project: short.optional(), account: short.optional(), plan: short.optional(), region: short.optional(), notes: text.optional() }).strict()).max(50).optional(),
  costs: z.array(z.object({ item: short, vendor: short.optional(), monthly_usd: z.number().min(0).max(1_000_000), notes: text.optional() }).strict()).max(100).optional(),
  accounts: z.array(z.object({ vendor: short, purpose: short, held_by: short.optional(), transferable: z.union([z.boolean(), z.literal('unknown')]).optional(), transfer_notes: text.optional() }).strict()).max(100).optional(),
  known_gaps: z.array(z.object({ title: short, severity: z.enum(['high', 'medium', 'low']).default('medium'), detail: text.optional() }).strict()).max(100).optional(),
  handover: z.array(z.object({ step: text, owner: short.optional(), done: z.boolean().default(false), notes: text.optional() }).strict()).max(100).optional(),
  contracts: z.array(z.object({ with_app: short, direction: z.enum(['calls', 'called-by', 'both', 'shares-data']), mechanism: short, detail: text.optional(), auth: short.optional() }).strict()).max(50).optional(),
  notes: z.array(text).max(50).optional(),
}).strict();
export type Facts = z.infer<typeof FactsSchema>;

/** Known credential shapes. A facts file matching any of these is refused. */
const SECRET_SHAPES: RegExp[] = [
  /\bsk_(live|test)_[A-Za-z0-9]{10,}/, /\brk_(live|test)_[A-Za-z0-9]{10,}/, /\bwhsec_[A-Za-z0-9]{10,}/,
  /\bsk-(proj-|ant-)?[A-Za-z0-9_-]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bxox[abpr]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/, /\bAIza[0-9A-Za-z_-]{30,}/, /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/, /\bSK[0-9a-f]{32}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /mongodb(\+srv)?:\/\/[^/\s:]+:[^@\s]+@/, /postgres(ql)?:\/\/[^/\s:]+:[^@\s]+@/,
  /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,
];
export function looksLikeSecret(s: string): boolean { return SECRET_SHAPES.some(re => re.test(s)); }

export function parseFacts(raw: unknown): Facts {
  const json = JSON.stringify(raw ?? {});
  if (looksLikeSecret(json)) throw new Error('facts file appears to contain a credential (key, token, connection string or private key); remove it — the dossier records names, never values');
  return FactsSchema.parse(raw ?? {});
}

export function loadFacts(file: string): Facts {
  if (isSecretLikePath(path.basename(file))) throw new Error(`refusing to read ${path.basename(file)}: it looks like a secrets file`);
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`facts file ${file} is not valid JSON: ${e instanceof Error ? e.message : e}`); }
  return parseFacts(raw);
}

export const monthlyTotal = (f: Facts | undefined) => Math.round((f?.costs ?? []).reduce((n, c) => n + c.monthly_usd, 0) * 100) / 100;
