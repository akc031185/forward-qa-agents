// Gate is a plain in-process counting semaphore: no HTTP, no timers, so it is testable with
// nothing but manually-controlled promises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gate } from '../../src/core/concurrency.js';

/** A task whose completion is controlled by the test, so ordering can be asserted precisely. */
function deferredTask(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

test('rejects a limit below 1', () => {
  assert.throws(() => new Gate(0));
  assert.throws(() => new Gate(-1));
  assert.doesNotThrow(() => new Gate(1));
});

test('under the limit, tasks run immediately with no queueing', async () => {
  const gate = new Gate(2);
  const a = deferredTask(); const b = deferredTask();
  const ra = gate.run(() => a.promise);
  const rb = gate.run(() => b.promise);
  assert.equal(gate.activeCount, 2);
  assert.equal(gate.queuedCount, 0);
  a.resolve(); b.resolve();
  await Promise.all([ra, rb]);
  assert.equal(gate.activeCount, 0);
});

test('over the limit, extra tasks queue and start in submission order once a slot frees', async () => {
  const gate = new Gate(1);
  const order: string[] = [];
  const first = deferredTask();
  const firstDone = gate.run(async () => { order.push('first-start'); await first.promise; order.push('first-end'); });

  // submitted while the gate is full: must not start yet
  const second = deferredTask();
  const secondDone = gate.run(async () => { order.push('second-start'); await second.promise; order.push('second-end'); });
  const third = deferredTask();
  const thirdDone = gate.run(async () => { order.push('third-start'); await third.promise; order.push('third-end'); });

  await Promise.resolve(); await Promise.resolve();
  assert.equal(gate.activeCount, 1, 'only one task holds the single slot');
  assert.equal(gate.queuedCount, 2, 'the other two are waiting their turn');
  assert.deepEqual(order, ['first-start'], 'second and third have not started');

  first.resolve();
  await firstDone;
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start'], 'second starts the instant the slot frees, not third out of order');
  assert.equal(gate.queuedCount, 1);

  second.resolve();
  await secondDone;
  third.resolve();
  await thirdDone;
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end', 'third-start', 'third-end']);
  assert.equal(gate.activeCount, 0);
  assert.equal(gate.queuedCount, 0);
});

test('a slot is freed even when the task throws, so one failure cannot wedge the queue', async () => {
  const gate = new Gate(1);
  const boom = gate.run(async () => { throw new Error('boom'); });
  await assert.rejects(boom, /boom/);
  assert.equal(gate.activeCount, 0);

  let ran = false;
  await gate.run(async () => { ran = true; });
  assert.ok(ran, 'the gate still accepts work after a failure');
});

test('limit is readable for reporting (e.g. GET /worker/queue)', () => {
  const gate = new Gate(3);
  assert.equal(gate.limit, 3);
});
