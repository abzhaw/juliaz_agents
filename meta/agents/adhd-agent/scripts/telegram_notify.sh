#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ADHD Agent — Telegram Notifier
# Sends a proactive message to Raphael via the Telegram Bot API.
# Stores the message metadata so poll_approval.sh can match the reply.
#
# Usage: ./telegram_notify.sh "<message_text>" "<fingerprint>"
# Returns: 0 on success, 1 on failure
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$AGENT_DIR/config/settings.env"

# Load config
if [[ ! -f "$CONFIG" ]]; then
  echo "[adhd] ERROR: config/settings.env not found at $CONFIG" >&2
  exit 1
fi
source "$CONFIG"

# Load bot token from secrets
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "[adhd] ERROR: secrets file not found at $SECRETS_FILE" >&2
  exit 1
fi
source "$SECRETS_FILE"

# Validate required vars
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "[adhd] ERROR: TELEGRAM_BOT_TOKEN not set in $SECRETS_FILE" >&2
  exit 1
fi
if [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "[adhd] ERROR: TELEGRAM_CHAT_ID not set in $CONFIG" >&2
  echo "[adhd] Run: curl 'https://api.telegram.org/bot\${TELEGRAM_BOT_TOKEN}/getUpdates' to find your chat ID" >&2
  exit 1
fi

MESSAGE_TEXT="${1:-}"
FINGERPRINT="${2:-unknown}"

if [[ -z "$MESSAGE_TEXT" ]]; then
  echo "[adhd] ERROR: No message text provided" >&2
  exit 1
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Send the message via Telegram Bot API
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"${TELEGRAM_CHAT_ID}\",
    \"text\": $(echo "$MESSAGE_TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
    \"parse_mode\": \"Markdown\"
  }")

# Check success
OK=$(echo "$RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("ok","false"))' 2>/dev/null || echo "false")
MSG_ID=$(echo "$RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("result",{}).get("message_id",""))' 2>/dev/null || echo "")

if [[ "$OK" != "True" ]] && [[ "$OK" != "true" ]]; then
  echo "[adhd] Telegram send failed: $RESPONSE" >&2
  exit 1
fi

# Store pending approval metadata
PENDING_FILE="$AGENT_DIR/memory/pending_approval.json"
python3 -c "
import json, os
data = {
  'fingerprint': '$FINGERPRINT',
  'message_id': '$MSG_ID',
  'chat_id': '$TELEGRAM_CHAT_ID',
  'sent_at': '$TIMESTAMP',
  'message': $(echo "$MESSAGE_TEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
}
os.makedirs('$(dirname "$PENDING_FILE")', exist_ok=True)
with open('$PENDING_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"

echo "[adhd] ✅ Telegram message sent (msg_id=$MSG_ID) for: $FINGERPRINT"
