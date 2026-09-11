import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalEndpoint, stripThinking, maybeLlm } from '../src/core/llm.js';

test('only local endpoints are accepted', () => {
  assert.doesNotThrow(() => assertLocalEndpoint('http://127.0.0.1:11434'));
  assert.doesNotThrow(() => assertLocalEndpoint('http://localhost:8080'));
  assert.doesNotThrow(() => assertLocalEndpoint('http://192.168.1.20:11434'));
  assert.throws(() => assertLocalEndpoint('https://api.openai.com'), /not local/);
  assert.throws(() => assertLocalEndpoint('https://api.anthropic.com'), /not local/);
});

test('DeepSeek-R1 thinking blocks are stripped', () => {
  assert.equal(stripThinking('<think>\nplan\n</think>\nAnswer.'), 'Answer.');
});

test('maybeLlm returns the fallback when no local model answers', async () => {
  process.env.LLM_PROVIDER = 'none';
  const out = await maybeLlm(async () => 'from-model', 'fallback');
  assert.equal(out, 'fallback');
});
