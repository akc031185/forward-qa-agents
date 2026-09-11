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
};
