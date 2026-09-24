// Static signals read from source text. Each is a hint that a practice is present, not proof that
// it is correct; the dossier labels them "signals" everywhere they are shown.

/** A session, token, key or secret check in the handler itself. */
export const AUTH_RE = /getServerSession\s*\(|\bauth\s*\(\s*\)|getToken\s*\(|currentUser\s*\(|\brequire(Auth|User|Session|Role|Workspace|Owner|Admin|Member|ApiKey)\w*\s*\(|\bwith(Auth|Session|Workspace|ApiKey)\w*\s*\(|\bverify(ApiKey|Token|Jwt|Session|CronSecret|Secret)\w*\s*\(|checkApiKey|isAuthenticated\s*\(|\bauthenticate\w*\s*\(|\bgetSession\s*\(|['"]x-api-key['"]|[Bb]earer\s|jwtVerify\s*\(|jwt\.verify\s*\(|CRON_SECRET|onRequest[^\n]*auth|preHandler[^\n]*auth/;
export const RATE_LIMIT_RE = /rate-?limit|ratelimit|Ratelimit|\blimiter\b|slidingWindow|tokenBucket|@fastify\/rate-limit/i;
export const TENANT_RE = /\b(workspace|tenant|org|organization|team|company)_?[Ii]d\b/;
export const VALIDATION_RE = /\.(safeParse|parse|parseAsync|safeParseAsync)\s*\(|\bparse(Body|Query|Params|Json|Input)\s*\([^)]*[Ss]chema|\bz\.object\s*\(|\bJoi\.|\byup\.|schema:\s*\{\s*(body|querystring|params)|\bajv\b/;

export const SIGNATURE_CHECKS: { re: RegExp; label: string; vendor?: string; strong: boolean }[] = [
  { re: /webhooks\.constructEvent(Async)?\s*\(/, label: 'Stripe constructEvent', vendor: 'stripe', strong: true },
  { re: /['"]stripe-signature['"]/i, label: 'reads stripe-signature header', vendor: 'stripe', strong: false },
  { re: /validateRequest(WithBody)?\s*\(|validateExpressRequest\s*\(/, label: 'Twilio validateRequest', vendor: 'twilio', strong: true },
  { re: /['"]x-twilio-signature['"]/i, label: 'reads x-twilio-signature header', vendor: 'twilio', strong: false },
  { re: /new\s+Webhook\s*\([\s\S]{0,400}?\.verify\s*\(/, label: 'Svix Webhook.verify (Resend and others)', vendor: 'resend', strong: true },
  { re: /['"]svix-signature['"]/i, label: 'reads svix-signature header', vendor: 'resend', strong: false },
  { re: /['"]x-hub-signature(-256)?['"]/i, label: 'reads x-hub-signature header', vendor: 'github', strong: false },
  { re: /createHmac\s*\(/, label: 'HMAC digest', strong: false },
  { re: /timingSafeEqual\s*\(/, label: 'constant-time comparison', strong: false },
  { re: /\bverify\w*(Webhook|Signature|Svix|Stripe|Twilio)\w*\s*\(/, label: 'verify…Signature / vendor verify helper', strong: true },
];
export const RAW_BODY_RE = /req(uest)?\.text\s*\(\s*\)|bodyParser:\s*false|rawBody|arrayBuffer\s*\(\s*\)|express\.raw\s*\(/;
export const IDEMPOTENCY_RE = /idempoten|event\.id\b|processedEvents|alreadyProcessed|dedupe|upsert\s*\([^)]*event/i;
