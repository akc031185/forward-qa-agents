// Optional model adapter — open-weight, locally-run models only.
//
// Rules this file enforces:
//   1. Every agent must produce its full deliverable with NO model (provider `none`).
//      A model may only *enrich* output; `maybeLlm()` guarantees the deterministic fallback.
//   2. Only local / private-network endpoints are accepted. Public hosts are rejected unless
//      LLM_ALLOW_REMOTE=1 is set for a self-hosted server you own. There is no paid provider.
//   3. `auto` (the default) probes Ollama, then an OpenAI-compatible local server
//      (llama.cpp, vLLM, LM Studio), then degrades to `none`.
import { config, type LlmProviderName } from './config.js';

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  readonly available: boolean;
  complete(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<string>;
}

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)$/i;

export function assertLocalEndpoint(baseUrl: string): void {
  const host = new URL(baseUrl).hostname;
  if (!PRIVATE_HOST.test(host) && !config.llmAllowRemote) {
    throw new Error(`LLM endpoint ${host} is not local. This repo only uses open-weight models you run yourself; set LLM_ALLOW_REMOTE=1 only for a server you host.`);
  }
}

class NoneProvider implements LlmProvider {
  name = 'none'; model = '-'; available = false;
  async complete(): Promise<string> { throw new Error('No local model configured: model calls are disabled'); }
}

class OllamaProvider implements LlmProvider {
  name = 'ollama'; available = true;
  constructor(readonly baseUrl: string, readonly model: string) { assertLocalEndpoint(baseUrl); }
  async complete(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, system: opts?.system, stream: false, options: { num_predict: opts?.maxTokens ?? 1024 } }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    return stripThinking(((await res.json()) as { response: string }).response);
  }
}

class OpenAiCompatibleProvider implements LlmProvider {
  name = 'openai-compatible'; available = true;
  constructor(readonly baseUrl: string, readonly model: string) { assertLocalEndpoint(baseUrl); }
  async complete(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model, max_tokens: opts?.maxTokens ?? 1024,
        messages: [...(opts?.system ? [{ role: 'system', content: opts.system }] : []), { role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openai-compatible ${res.status}`);
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    return stripThinking(j.choices[0]?.message.content ?? '');
  }
}

/** DeepSeek-R1 style models emit <think>…</think>; strip it so callers get the answer only. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

async function reachable(url: string, ms = 800): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return res.ok;
  } catch { return false; }
}

let cached: LlmProvider | undefined;

/** Resolve the provider once per process. Never throws; worst case returns `none`. */
export async function getLlm(): Promise<LlmProvider> {
  if (cached) return cached;
  const want: LlmProviderName = config.llmProvider;
  const tryOllama = async () => {
    const base = config.llmBaseUrl || config.ollamaDefaultUrl;
    return (await reachable(`${base}/api/tags`)) ? new OllamaProvider(base, config.llmModel) : undefined;
  };
  const tryCompat = async () => {
    const base = config.llmBaseUrl || config.openaiCompatDefaultUrl;
    return (await reachable(`${base}/v1/models`)) ? new OpenAiCompatibleProvider(base, config.llmModel) : undefined;
  };
  try {
    if (want === 'ollama') cached = await tryOllama();
    else if (want === 'openai-compatible') cached = await tryCompat();
    else if (want === 'auto') cached = (await tryOllama()) ?? (await tryCompat());
  } catch (err) {
    console.warn(`[llm] ${err instanceof Error ? err.message : err} — continuing without a model`);
  }
  cached ??= new NoneProvider();
  return cached;
}

/** For tests. */
export function resetLlmCache(): void { cached = undefined; }

/** Run `fn` only when a local model is reachable; otherwise (or on any error) return `fallback`. */
export async function maybeLlm<T>(fn: (llm: LlmProvider) => Promise<T>, fallback: T): Promise<T> {
  const llm = await getLlm();
  if (!llm.available) return fallback;
  try { return await fn(llm); } catch { return fallback; }
}
