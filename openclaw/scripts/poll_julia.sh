#!/usr/bin/env bash
set -euo pipefail
LOG="logs/julia-live.log"
mkdir -p logs
: > "$LOG"
timestamp() { date "+%Y-%m-%dT%H:%M:%S%z"; }
echo "[poll] $(timestamp) watcher started" | tee -a "$LOG"
while true; do
  RESP=$(mcporter call julia-bridge.telegram_receive target=openclaw timeout=5000 || true)
  if [[ -z "$RESP" ]]; then
    continue
  fi
  COUNT=$(printf '%s' "$RESP" | jq '.messages | length')
  if [[ "$COUNT" -gt 0 ]]; then
    echo "[poll] $(timestamp) received $COUNT message(s)" | tee -a "$LOG"
    printf '%s\n' "$RESP" | tee -a "$LOG"
    printf '\a'
  fi
  sleep 1
done
