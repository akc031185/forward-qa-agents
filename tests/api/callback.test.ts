import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelayMs, buildCallbackPayload, deliverCallback, DEFAULT_RETRY_POLICY } from '../../src/core/callback.js';
import type { Output as AuditOutput } from '../../src/agents/ai-site-auditor/index.js';

const OUTPUT: AuditOutput = {
  pages_audited: 3,
  scores: { 'ai-visibility': 80, search: 70, build: 90, design: 60, readiness: 75 },
  grades: { 'ai-visibility': 'B', search: 'C', build: 'A', design: 'D', readiness: 'C' },
  findings_by_severity: { critical: 0, high: 1, medium: 2, low: 3, info: 4 },
  report_html: '/workspace/r1/report.html',
  report_md: '/workspace/r1/report.md',
  summary: 'fine',
};

test('buildCallbackPayload: succeeded carries scores, grades, findings and the inlined report html', () => {
  const payload = buildCallbackPayload('r1', 'succeeded', OUTPUT, '<html>report</html>');
  assert.deepEqual(payload, {
    run_id: 'r1',
    status: 'succeeded',
    scores: OUTPUT.scores,
    grades: OUTPUT.grades,
    findings_by_severity: OUTPUT.findings_by_severity,
    report_html: '<html>report</html>',
  });
});

test('buildCallbackPayload: failed carries only run_id, status and a string error, from an Error', () => {
  const payload = buildCallbackPayload('r2', 'failed', undefined, undefined, new Error('boom'));
  assert.deepEqual(payload, { run_id: 'r2', status: 'failed', error: 'boom' });
});

test('buildCallbackPayload: failed tolerates a non-Error throw', () => {
  const payload = buildCallbackPayload('r3', 'failed', undefined, undefined, 'string thrown');
  assert.deepEqual(payload, { run_id: 'r3', status: 'failed', error: 'string thrown' });
});

test('backoffDelayMs doubles each attempt and caps at the policy max', () => {
  const policy = { attempts: 6, baseDelayMs: 100, maxDelayMs: 1000 };
  assert.equal(backoffDelayMs(0, policy), 100);
  assert.equal(backoffDelayMs(1, policy), 200);
  assert.equal(backoffDelayMs(2, policy), 400);
  assert.equal(backoffDelayMs(3, policy), 800);
  assert.equal(backoffDelayMs(4, policy), 1000); // would be 1600, capped
  assert.equal(backoffDelayMs(10, policy), 1000);
});

test('deliverCallback: succeeds on the first try and sends the bearer token and JSON body', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response('ok', { status: 200 });
  }) as unknown as typeof fetch;

  const result = await deliverCallback('https://caller.example.test/hook', 'tok123', { run_id: 'r1', status: 'succeeded' }, { fetchFn });
  assert.deepEqual(result, { delivered: true, attempts: 1 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'https://caller.example.test/hook');
  assert.equal((calls[0]!.init.headers as Record<string, string>).authorization, 'Bearer tok123');
  assert.equal(JSON.parse(String(calls[0]!.init.body)).run_id, 'r1');
});

test('deliverCallback: retries on non-2xx and network error, then succeeds, without sleeping in the test', async () => {
  let attempt = 0;
  const fetchFn = (async () => {
    attempt += 1;
    if (attempt === 1) return new Response('nope', { status: 500 });
    if (attempt === 2) throw new Error('ECONNRESET');
    return new Response('ok', { status: 200 });
  }) as unknown as typeof fetch;
  const sleeps: number[] = [];

  const result = await deliverCallback(
    'https://caller.example.test/hook', 'tok', { run_id: 'r2', status: 'succeeded' },
    { fetchFn, sleep: async (ms) => { sleeps.push(ms); } },
  );
  assert.deepEqual(result, { delivered: true, attempts: 3 });
  assert.deepEqual(sleeps, [500, 1000]); // default policy backoff before attempts 2 and 3
});

test('deliverCallback: gives up cleanly after the policy attempt count and logs once', async () => {
  const fetchFn = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch;
  const logs: string[] = [];

  const result = await deliverCallback(
    'https://caller.example.test/hook', 'tok', { run_id: 'r3', status: 'failed', error: 'x' },
    { fetchFn, sleep: async () => {}, policy: { attempts: 3, baseDelayMs: 1, maxDelayMs: 1 }, log: (m) => logs.push(m) },
  );
  assert.deepEqual(result, { delivered: false, attempts: 3 });
  assert.equal(logs.length, 1);
  assert.match(logs[0]!, /r3/);
  assert.match(logs[0]!, /failed after 3 attempt/);
});

test('DEFAULT_RETRY_POLICY is a sane, bounded default', () => {
  assert.ok(DEFAULT_RETRY_POLICY.attempts >= 3);
  assert.ok(DEFAULT_RETRY_POLICY.maxDelayMs <= 60_000);
});
