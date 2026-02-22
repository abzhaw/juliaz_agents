#!/usr/bin/env bash
set -euo pipefail
LOG="logs/julia-live.log"
mkdir -p logs
: > "$LOG"
timestamp() { date "+%Y-%m-%dT%H:%M:%S%z"; }
echo "[poll] $(timestamp) watcher started" | tee -a "$LOG"
LAST_SIG=""
EMPTY_CYCLES=0
while true; do
  RESP=$(mcporter call julia-bridge.telegram_receive target=openclaw timeout=5000 || true)
  if [[ -z "$RESP" ]]; then
    continue
  fi
  COUNT=$(printf '%s' "$RESP" | jq '.messages | length')
  if [[ "$COUNT" -eq 0 ]]; then
    EMPTY_CYCLES=$((EMPTY_CYCLES + 1))
    if (( EMPTY_CYCLES * 6 >= 30 && EMPTY_CYCLES % 5 == 0 )); then
      echo "[poll] $(timestamp) idle ~$(EMPTY_CYCLES*6)s (no bridge replies)" | tee -a "$LOG"
    fi
    sleep 1
    continue
  fi
  EMPTY_CYCLES=0
  SIG=$(printf '%s' "$RESP" | jq -r '.messages | map(.id) | join("|")')
  if [[ "$SIG" == "$LAST_SIG" ]]; then
    sleep 1
    continue
  fi
  LAST_SIG="$SIG"
  echo "[poll] $(timestamp) received $COUNT new message(s)" | tee -a "$LOG"
  printf '%s\n' "$RESP" | tee -a "$LOG"
  printf '\a'
  sleep 1
done
