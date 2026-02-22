#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ADHD Agent — Approval Poller (Bridge-aware)
#
# Architecture: Raphael replies in Telegram → OpenClaw receives it → posts to
# bridge /incoming queue → ADHD agent polls bridge REST API for the reply.
# This is the correct path: ADHD Agent never competes with OpenClaw's
# getUpdates connection. OpenClaw owns the Telegram gateway.
#
# Returns:
#   0 + prints "YES"    → approved
#   0 + prints "NO"     → rejected
#   0 + prints "LATER"  → snooze
#   1                   → timeout or error
#
# Usage: ./poll_approval.sh "<fingerprint>" [timeout_seconds]
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$AGENT_DIR/config/settings.env"

source "$CONFIG"

FINGERPRINT="${1:-}"
TIMEOUT="${2:-${APPROVAL_TIMEOUT_SECONDS:-600}}"
POLL_INTERVAL=5

if [[ -z "$FINGERPRINT" ]]; then
  echo "[adhd] ERROR: fingerprint required" >&2
  exit 1
fi

echo "[adhd] Polling bridge for approval (fingerprint=$FINGERPRINT, timeout=${TIMEOUT}s)..." >&2
echo "[adhd] Waiting for Raphael's Telegram reply to come through OpenClaw → Bridge..." >&2

ELAPSED=0

while [[ $ELAPSED -lt $TIMEOUT ]]; do

  # Poll the bridge's julia-side queue — incoming Telegram messages land here
  # after OpenClaw processes them. We look for a YES/NO/LATER reply.
  BRIDGE_RESP=$(curl -s --max-time 5 "${BRIDGE_URL}/queues/julia" 2>/dev/null || echo '{"messages":[]}')

  DECISION=$(python3 - <<PYEOF
import json, sys

try:
    data = json.loads('''$BRIDGE_RESP''')
except:
    sys.exit(0)

messages = data if isinstance(data, list) else data.get("messages", [])

for msg in messages:
    text = ""
    # Bridge stores messages in various formats
    if isinstance(msg, dict):
        text = str(msg.get("text", "") or msg.get("reply", "") or "").strip().upper()

    if text in ("YES", "NO", "LATER"):
        print(text)
        sys.exit(0)

    # Also accept prefixed replies like "ADHD YES" or "YES adhd-focus"
    for keyword in ("YES", "NO", "LATER"):
        if text.startswith(keyword) or text.endswith(keyword):
            print(keyword)
            sys.exit(0)
PYEOF
  )

  if [[ -n "$DECISION" ]]; then
    echo "$DECISION"
    rm -f "$AGENT_DIR/memory/pending_approval.json"
    exit 0
  fi

  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

echo "[adhd] Timeout after ${TIMEOUT}s — treating as NO, snoozed" >&2
rm -f "$AGENT_DIR/memory/pending_approval.json"
echo "TIMEOUT"
exit 1
