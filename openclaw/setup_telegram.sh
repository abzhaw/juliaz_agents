#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Julia System — OpenClaw Telegram Channel Setup
# Run this script once you have:
#   1. A Telegram bot token (from @BotFather)
#   2. Your Telegram numeric user ID (from @userinfobot)
# ─────────────────────────────────────────────────────────────────────

set -e

# ── CONFIG — FILL THESE IN ──────────────────────────────────────────
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"           # or paste directly
ALLOWED_USER_IDS=("YOUR_TELEGRAM_USER_ID")   # add more: ("id1" "id2")
# ────────────────────────────────────────────────────────────────────

if [[ -z "$BOT_TOKEN" ]]; then
  echo "ERROR: Set TELEGRAM_BOT_TOKEN env var or edit BOT_TOKEN in this script."
  exit 1
fi

echo "🦞 Registering Telegram channel with OpenClaw..."
openclaw channels add \
  --channel telegram \
  --token "$BOT_TOKEN"

echo "🔒 Setting dmPolicy to pairing (unknown senders get a pairing code)..."
openclaw config set channels.telegram.dmPolicy pairing

echo "📋 Setting allowFrom list..."
# Build a JSON array from ALLOWED_USER_IDS
IDS_JSON=$(printf '"%s",' "${ALLOWED_USER_IDS[@]}" | sed 's/,$//')
openclaw config set channels.telegram.allowFrom "[${IDS_JSON}]"

echo "⚙️  Setting agent workspace for skills..."
openclaw config set agents.defaults.workspace "~/.openclaw/workspace"

echo "🔄 Restarting gateway to apply config..."
openclaw gateway start

echo ""
echo "✅ Telegram channel configured."
echo ""
echo "Next steps:"
echo "  1. Start your Telegram bot and send it a message from an allowed ID"
echo "  2. Run: openclaw channels status --deep"
echo "  3. Run: openclaw logs   (to watch for incoming messages)"
echo "  4. Confirm the message reaches Julia: you should see openclaw agent invoked"
