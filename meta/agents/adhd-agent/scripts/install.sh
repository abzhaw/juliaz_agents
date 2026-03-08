#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ADHD Agent — Installer
# Run once to set up the ambient agent on this Mac.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_SRC="$AGENT_DIR/config/com.juliaz.adhd-agent.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.juliaz.adhd-agent.plist"
CONFIG="$AGENT_DIR/config/settings.env"

echo "🧹 ADHD Agent Installer"
echo "========================"

# ── Step 1: Check TELEGRAM_CHAT_ID ───────────────────────────────────────────
source "$CONFIG"
if [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo ""
  echo "⚠️  TELEGRAM_CHAT_ID is not set in config/settings.env"
  echo ""
  echo "To find your chat ID:"
  echo "  1. Send any message to your Telegram bot"

  # Try to get it automatically if token is available
  if [[ -f "${SECRETS_FILE:-}" ]]; then
    source "$SECRETS_FILE"
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
      echo "  2. Running getUpdates to find your chat ID..."
      UPDATES=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates")
      CHAT_ID=$(echo "$UPDATES" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    results = data.get('result', [])
    if results:
        chat_id = results[-1]['message']['chat']['id']
        print(chat_id)
except:
    pass
" 2>/dev/null || echo "")
      if [[ -n "$CHAT_ID" ]]; then
        echo "  ✅ Found chat ID: $CHAT_ID"
        # Patch the settings file
        sed -i '' "s/^TELEGRAM_CHAT_ID=$/TELEGRAM_CHAT_ID=$CHAT_ID/" "$CONFIG"
        echo "  ✅ Saved to config/settings.env"
      else
        echo "  ❌ No messages found. Send a message to your bot first, then re-run."
        exit 1
      fi
    fi
  fi
fi

# ── Step 2: Make scripts executable ──────────────────────────────────────────
chmod +x "$AGENT_DIR/scripts/"*.sh
echo "✅ Scripts made executable"

# ── Step 3: Install launchd plist ────────────────────────────────────────────
mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SRC" "$PLIST_DEST"
echo "✅ Installed plist to $PLIST_DEST"

# Unload if already running
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# Load and start
launchctl load "$PLIST_DEST"
echo "✅ LaunchAgent loaded (runs every 6 hours)"

# ── Step 4: Run a dry-run to verify everything works ─────────────────────────
echo ""
echo "🔍 Running a dry scan to verify setup..."
python3 "$AGENT_DIR/scripts/scan_skills.py" 2>&1 || echo "⚠️  Scanner encountered an issue — check python3 is available"

echo ""
echo "✅ ADHD Agent installed and running!"
echo ""
echo "Useful commands:"
echo "  Run now:     bash $AGENT_DIR/scripts/adhd_loop.sh --once"
echo "  Dry run:     bash $AGENT_DIR/scripts/adhd_loop.sh --once --dry-run"
echo "  Stop agent:  launchctl unload $PLIST_DEST"
echo "  Start agent: launchctl load $PLIST_DEST"
echo "  View logs:   tail -f $AGENT_DIR/memory/adhd_loop.log"
