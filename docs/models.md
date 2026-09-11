# Model policy: open-weight, local, free

Both agents in this repo are **deterministic first**. Every deliverable (crawl, findings,
generated Playwright + MCP project, migration report) is produced with no model at all.
A model is used only to *enrich* text (executive summaries, suggestions for leftovers the
parsers could not convert), and always with a deterministic fallback.

When a model is used it must be an open-weight model running on hardware you control, with
no per-token bill and no internet dependency once the weights are downloaded. The adapter in
`src/core/llm.ts` rejects non-local endpoints unless `LLM_ALLOW_REMOTE=1` is set for a server
you host yourself. There is no paid-provider code path.

## Recommended models (pull once, then run offline)

| Tag (Ollama)                 | Family            | Size on disk | Fits on                          | Use it for |
|------------------------------|-------------------|--------------|----------------------------------|------------|
| `deepseek-r1:8b`             | DeepSeek-R1 distill | ~5 GB      | 16 GB Mac / any 8 GB GPU         | default; summaries, leftover conversion |
| `deepseek-r1:14b`            | DeepSeek-R1 distill | ~9 GB      | 32 GB Mac / 16 GB GPU            | better code conversion |
| `deepseek-coder-v2:16b`      | DeepSeek-Coder-V2 Lite (MoE) | ~9 GB | 32 GB Mac                    | code-heavy conversion of odd Selenium constructs |
| `qwen2.5-coder:7b`           | Qwen2.5 Coder     | ~4.7 GB      | 16 GB Mac                        | fast alternative if DeepSeek is slow |
| `kimi-k2` (via llama.cpp GGUF, heavily quantised) | Moonshot Kimi K2 (1T MoE) | ≥ 250 GB | multi-GPU / 512 GB+ server only | strongest results, not a laptop model |

DeepSeek-R1 models emit `<think>…</think>` reasoning; the adapter strips it.

## Setup

```bash
./scripts/setup-local-llm.sh                # installs Ollama if needed, pulls deepseek-r1:8b
./scripts/setup-local-llm.sh deepseek-r1:14b
```

Then leave `LLM_PROVIDER=auto` (default). The adapter probes `http://127.0.0.1:11434`
(Ollama) and `http://127.0.0.1:8080` (llama.cpp `llama-server`, vLLM, LM Studio). If neither
answers, the agents run in pure deterministic mode and say so in their reports.

To force deterministic mode for CI or audits: `LLM_PROVIDER=none`.

## Verifying no paid calls happen

```bash
grep -rn "api.openai.com\|api.anthropic.com\|generativelanguage.googleapis.com" src || echo "no paid endpoints"
```
