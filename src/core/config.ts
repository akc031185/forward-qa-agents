import path from 'node:path';

/**
 * Model policy for this repo: OPEN-WEIGHT, LOCALLY-RUN MODELS ONLY (DeepSeek, Kimi, Qwen, …).
 * No paid API is supported. `auto` probes for a local Ollama, then a local llama.cpp / vLLM /
 * LM Studio OpenAI-compatible server, and falls back to `none` (pure deterministic mode).
 */
export type LlmProviderName = 'auto' | 'none' | 'ollama' | 'openai-compatible';

export const config = {
  llmProvider: (process.env.LLM_PROVIDER ?? 'auto') as LlmProviderName,
  llmModel: process.env.LLM_MODEL ?? 'deepseek-r1:8b',
  llmBaseUrl: process.env.LLM_BASE_URL ?? '',                 // '' = probe defaults below
  llmAllowRemote: process.env.LLM_ALLOW_REMOTE === '1',       // only for a self-hosted box on your own network
  ollamaDefaultUrl: 'http://127.0.0.1:11434',
  openaiCompatDefaultUrl: 'http://127.0.0.1:8080',            // llama.cpp `llama-server` default
  dbPath: path.resolve(process.env.DB_PATH ?? './data/forward-qa.db'),
  port: Number(process.env.PORT ?? 8787),
  workspaceDir: path.resolve(process.env.WORKSPACE_DIR ?? './workspace'),

  /**
   * Shared secret for the standalone worker endpoints (`/worker/*`, see `src/api/worker.ts`).
   * The calling app authenticates its submit/status requests with this bearer token, and the
   * worker re-attaches the same token to the callback it POSTs back, so the receiver can trust
   * the callback came from this worker. Unset by default: the worker endpoints then refuse every
   * request rather than running open. Never defaulted to a placeholder value on purpose.
   */
  workerToken: process.env.AUDIT_WORKER_TOKEN ?? '',

  /**
   * Chromium's own sandbox needs either a non-root process with a permissive seccomp profile, or
   * `--no-sandbox`. Most container hosts (Railway/Fly/Render and similar) run images without a
   * custom seccomp profile, so a non-root container — required by `docs/DEPLOYING-THE-WORKER.md`
   * — needs `--no-sandbox` to launch at all. Off by default so local dev, CI and every existing
   * test keep today's behaviour; the worker Dockerfile sets it to 1.
   */
  chromiumNoSandbox: process.env.CHROMIUM_NO_SANDBOX === '1',
};

/**
 * Who a client-facing report is from. Kept in the environment, never in the repo: the house rule
 * is that no real company, client or product name appears in source, fixtures or docs, and it also
 * means one checkout can produce reports for more than one brand. Every field is optional; the
 * report falls back to unbranded text and simply omits any link that is not configured.
 */
export const brand = {
  company: process.env.BRAND_COMPANY ?? '',
  tagline: process.env.BRAND_TAGLINE ?? '',
  siteUrl: process.env.BRAND_SITE_URL ?? '',
  accountUrl: process.env.BRAND_ACCOUNT_URL ?? '',
  billingUrl: process.env.BRAND_BILLING_URL ?? '',
  dashboardUrl: process.env.BRAND_DASHBOARD_URL ?? '',
  contactEmail: process.env.BRAND_CONTACT_EMAIL ?? '',
};
export type Brand = typeof brand;
