#!/usr/bin/env bash
# Installs Ollama (if missing) and pulls an open-weight model so the agents can enrich their
# output fully offline. Everything here is free; nothing calls a paid API.
set -euo pipefail
MODEL="${1:-deepseek-r1:8b}"

if ! command -v ollama >/dev/null 2>&1; then
  if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    brew install --cask ollama
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
fi

# Start the server if it is not already answering.
if ! curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  (ollama serve >/tmp/ollama.log 2>&1 &)
  for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
fi

ollama pull "$MODEL"
echo "ready: LLM_PROVIDER=auto LLM_MODEL=$MODEL (once pulled, this works with the network off)"
