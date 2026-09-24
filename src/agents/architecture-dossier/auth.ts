// Collector: authentication, roles and security posture. What signs people in (NextAuth / Auth.js,
// Clerk, JWT, API keys), what roles exist, and which protective practices show up in the source:
// rate limiting, security headers, validation, tenant scoping, encryption, constant-time checks.
import { RepoFiles, depsOf, isTestPath, readPackages, sortUniq } from './files.js';
import type { Middleware, Route } from './routes.js';

export interface SecuritySignal { id: string; label: string; present: boolean; files: string[]; note?: string }
export interface AuthResult {
  libraries: string[];
  nextauth?: { config_files: string[]; providers: string[]; session_strategy?: string; adapter?: string };
  password_hashing: string[];
  api_key_files: string[];
  roles: string[];
  middleware: Middleware[];
  api_routes: { total: number; with_auth_signal: number; with_middleware_auth: number; with_tenant_signal: number; with_rate_limit: number; with_validation: number };
  unguarded_api_routes: string[];
  signals: SecuritySignal[];
}

const AUTH_LIBS: [string, string][] = [
  ['next-auth', 'NextAuth / Auth.js'], ['@auth/core', 'Auth.js core'], ['@clerk/nextjs', 'Clerk'], ['lucia', 'Lucia'],
  ['jsonwebtoken', 'jsonwebtoken (JWT)'], ['jose', 'jose (JWT)'], ['passport', 'Passport'], ['@fastify/jwt', '@fastify/jwt'], ['iron-session', 'iron-session'],
];
const ROLE_WORDS = /^(owner|admin|administrator|superadmin|super_admin|member|viewer|editor|user|agent|manager|staff|guest|support|billing|readonly|read_only|operator|affiliate|client|customer)$/;

/** Code that SETS security headers: a helmet import or call, `setHeader('Content-Security-Policy', …)`,
 *  a Next.js `{ key: 'Strict-Transport-Security' }` entry, or a `headers: { … }` literal. Code that only
 *  reads or checks those headers, and the word "helmet" in prose ("react-helmet"), does not count. */
export const SECURITY_HEADER_CODE = /(?:from\s+|require\(\s*)['"](?:helmet|@fastify\/helmet|koa-helmet)['"]|\bhelmet\s*\(|\b(?:setHeader|header|set|append)\(\s*['"](?:content-security-policy|strict-transport-security)['"]|\bkey\s*:\s*['"](?:content-security-policy|strict-transport-security)['"]|\bheaders\s*:\s*\{[^}]{0,400}['"](?:content-security-policy|strict-transport-security)['"]\s*:/i;

export function collectAuth(repo: RepoFiles, routes: Route[], middleware: Middleware[]): AuthResult {
  const pkgs = readPackages(repo);
  const deps = new Set(pkgs.flatMap(p => Object.keys(depsOf(p))));
  const libraries = AUTH_LIBS.filter(([p]) => deps.has(p)).map(([, l]) => l);
  const hashing = [['bcrypt', 'bcrypt'], ['bcryptjs', 'bcryptjs'], ['argon2', 'argon2']].filter(([p]) => deps.has(p!)).map(([, l]) => l!);

  const code = repo.code().filter(f => !isTestPath(f));
  const texts = new Map(code.map(f => [f, repo.text(f) ?? '']));
  const filesMatching = (re: RegExp) => code.filter(f => re.test(texts.get(f)!));

  if (filesMatching(/\bscrypt(Sync)?\s*\(/).length) hashing.push('scrypt (node:crypto)');

  let nextauth: AuthResult['nextauth'];
  const naFiles = filesMatching(/\bNextAuth\s*\(|from\s+['"]next-auth['"]/).filter(f => /NextAuth\s*\(|providers\s*:/.test(texts.get(f)!));
  if (naFiles.length) {
    const all = naFiles.map(f => texts.get(f)!).join('\n');
    const providers = sortUniq([...all.matchAll(/\b([A-Z][A-Za-z]+?)(?:Provider)?\s*\(\s*\{/g)].map(m => m[1]!)
      .filter(p => /^(Credentials|Google|GitHub|Github|Email|Resend|Nodemailer|Apple|Azure\w*|Discord|Facebook|LinkedIn|Twitter|Auth0|Okta|Keycloak|Cognito|Sendgrid|Postmark|Passkey|WebAuthn)$/.test(p)));
    nextauth = {
      config_files: naFiles,
      providers,
      session_strategy: /strategy\s*:\s*['"](jwt|database)['"]/.exec(all)?.[1],
      adapter: /\b(\w+Adapter)\s*\(/.exec(all)?.[1],
    };
  }

  const roles = new Set<string>();
  for (const [, src] of texts) {
    for (const m of src.matchAll(/\broles?\b[^\n]{0,120}/gi)) {
      if (/content\s*:|messages|assistant|system/.test(m[0])) continue;   // chat-completion roles, not user roles
      for (const q of m[0].matchAll(/['"]([a-z_]{3,20})['"]/g)) if (ROLE_WORDS.test(q[1]!)) roles.add(q[1]!);
    }
  }

  const api = routes.filter(r => r.kind === 'api');
  const guarded = (r: Route) => r.signals.auth || r.signals.middleware_auth;
  const unguarded = api.filter(r => !guarded(r) && !/\/auth\b|\/health|\/webhooks?\b|\/cron\//.test(r.path)).map(r => `${r.methods.join(',')} ${r.path}`);

  const signal = (id: string, label: string, re: RegExp, note?: string): SecuritySignal => { const files = filesMatching(re); return { id, label, present: files.length > 0, files: files.slice(0, 10), note }; };
  const configFiles = repo.files.filter(f => /(^|\/)(next\.config\.[cm]?[jt]s|vercel\.json)$/.test(f));
  const headerFiles = configFiles.filter(f => /Content-Security-Policy|Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options|headers\s*\(/i.test(repo.text(f) ?? ''));
  const signals: SecuritySignal[] = [
    signal('rate-limit', 'Rate limiting', /rate-?limit|ratelimit|Ratelimit|slidingWindow|tokenBucket|@fastify\/rate-limit/i),
    { id: 'security-headers', label: 'Security headers (CSP, HSTS, frame options)', present: headerFiles.length > 0 || filesMatching(SECURITY_HEADER_CODE).length > 0, files: [...headerFiles, ...filesMatching(SECURITY_HEADER_CODE)].slice(0, 10) },
    signal('validation', 'Input validation (Zod / Joi / Yup / JSON schema)', /\.(safeParse|parse)\s*\(\s*(await\s+)?(req|request|body|json|input|data)|\bz\.object\s*\(|\bJoi\.object|\byup\.object|schema:\s*\{\s*(body|querystring|params)/),
    signal('tenant-scoping', 'Tenant scoping (workspace / tenant / org id in queries)', /\b(find|findOne|findById|updateOne|updateMany|deleteOne|deleteMany|countDocuments|aggregate|where|prepare)\b[^\n]{0,160}\b(workspace|tenant|org|organization|team|company)_?[Ii]d\b/),
    signal('encryption', 'Field encryption (createCipheriv / KMS)', /createCipheriv\s*\(|KMSClient|encryptField|decryptField/),
    signal('constant-time', 'Constant-time secret comparison', /timingSafeEqual\s*\(/),
    signal('csrf', 'CSRF protection', /csrf|csurf|sameSite\s*:\s*['"](strict|lax)['"]/i),
    signal('cors', 'Explicit CORS policy', /@fastify\/cors|\bcors\s*\(|Access-Control-Allow-Origin/),
    signal('audit-log', 'Audit log', /audit_?log|AuditLog|auditLog/),
    signal('secure-cookies', 'Secure cookie flags', /httpOnly\s*:\s*true|secure\s*:\s*true/),
  ];

  return {
    libraries, nextauth, password_hashing: sortUniq(hashing),
    api_key_files: filesMatching(/['"]x-api-key['"]|api[_-]?key['"]?\s*\]?\s*(===|!==)|verifyApiKey|checkApiKey/i).slice(0, 12),
    roles: [...roles].sort(),
    middleware,
    api_routes: {
      total: api.length,
      with_auth_signal: api.filter(r => r.signals.auth).length,
      with_middleware_auth: api.filter(r => r.signals.middleware_auth).length,
      with_tenant_signal: api.filter(r => r.signals.tenant).length,
      with_rate_limit: api.filter(r => r.signals.rate_limit).length,
      with_validation: api.filter(r => r.signals.validation).length,
    },
    unguarded_api_routes: unguarded,
    signals,
  };
}
