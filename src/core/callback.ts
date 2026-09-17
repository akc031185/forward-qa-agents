// Delivers the worker's audit result back to the caller's callback URL: a handful of retries
// with backoff, then give up cleanly and log. Pure, dependency-injected (fetch/sleep/log) so the
// retry policy and payload shaping are unit-testable without a real network call.
import type { Area, Severity } from '../agents/ai-site-auditor/types.js';
import type { Output as AuditOutput } from '../agents/ai-site-auditor/index.js';

export type RunTerminalStatus = 'succeeded' | 'failed';

/** What the calling app's `submitAudit(...)` contract expects on its `callbackUrl`. */
export interface CallbackPayload {
  run_id: string;
  status: RunTerminalStatus;
  scores?: Record<Area, number>;
  grades?: Record<Area, string>;
  findings_by_severity?: Record<Severity, number>;
  report_html?: string;
  error?: string;
}

/** Shapes the callback body for a finished run. Never throws: an unreadable report becomes a
 *  present-but-empty `report_html` plus a note in `error`, rather than losing the whole callback. */
export function buildCallbackPayload(runId: string, status: 'succeeded', output: AuditOutput, reportHtml: string): CallbackPayload;
export function buildCallbackPayload(runId: string, status: 'failed', output: undefined, reportHtml: undefined, error: unknown): CallbackPayload;
export function buildCallbackPayload(
  runId: string,
  status: RunTerminalStatus,
  output?: AuditOutput,
  reportHtml?: string,
  error?: unknown,
): CallbackPayload {
  if (status === 'succeeded' && output) {
    return {
      run_id: runId,
      status,
      scores: output.scores,
      grades: output.grades,
      findings_by_severity: output.findings_by_severity,
      report_html: reportHtml ?? '',
    };
  }
  return {
    run_id: runId,
    status: 'failed',
    error: error instanceof Error ? error.message : String(error ?? 'audit failed'),
  };
}

export interface RetryPolicy {
  attempts: number;      // total tries, including the first
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 4, baseDelayMs: 500, maxDelayMs: 8000 };

/** Full jitter-free exponential backoff, capped. Exported so the policy is directly testable. */
export function backoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
}

export interface DeliverCallbackDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  policy?: RetryPolicy;
  log?: (msg: string) => void;
}

export interface DeliverCallbackResult {
  delivered: boolean;
  attempts: number;
}

/**
 * POSTs the payload to `callbackUrl` with `Authorization: Bearer <token>`, retrying on network
 * error or a non-2xx response with capped exponential backoff. Gives up after the policy's
 * attempt count and logs — it never throws, so a caller can fire this without awaiting it and
 * still be sure a stuck callback cannot crash the process.
 */
export async function deliverCallback(
  callbackUrl: string,
  token: string,
  payload: CallbackPayload,
  deps: DeliverCallbackDeps = {},
): Promise<DeliverCallbackResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const policy = deps.policy ?? DEFAULT_RETRY_POLICY;
  const log = deps.log ?? (() => {});

  let lastError = '';
  for (let attempt = 0; attempt < policy.attempts; attempt++) {
    try {
      const res = await fetchFn(callbackUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { delivered: true, attempts: attempt + 1 };
      lastError = `callback responded ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < policy.attempts - 1) await sleep(backoffDelayMs(attempt, policy));
  }
  log(`run ${payload.run_id}: callback delivery to ${callbackUrl} failed after ${policy.attempts} attempt(s): ${lastError}`);
  return { delivered: false, attempts: policy.attempts };
}
