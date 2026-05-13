#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

pids=()

cleanup() {
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait || true
}

trap cleanup EXIT INT TERM

start_service() {
  local name="$1"
  shift

  (
    "$@" 2>&1 | while IFS= read -r line; do
      printf '[%s] %s\n' "$name" "$line"
    done
  ) &

  pids+=("$!")
}

start_service "indexer" pnpm --filter indexer dev
start_service "web" pnpm --filter web dev
start_service "orchestrator" pnpm --filter orchestrator dev

wait
