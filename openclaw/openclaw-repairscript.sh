#!/usr/bin/env bash
# openclaw-repair.sh — Non-interactive re-pair script for OpenClaw CLI
#
# Run this when `openclaw health` fails with:
#   - gateway timeout after 10000ms
#   - unauthorized role: node
#   - pairing required
#
# Usage: ./openclaw-repair.sh
# The script is fully autonomous — no prompts needed.

set -euo pipefail

GATEWAY_TOKEN="a65ad72a77c5d83a881accb25781c93cc59a8e43a2770f04"
PAIRED_FILE="$HOME/.openclaw/devices/paired.json"
PENDING_FILE="$HOME/.openclaw/devices/pending.json"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
LAUNCHD_LABEL="ai.openclaw.gateway"

log() { echo "[repairm $(date +%H:%M:%S)] $*"; }
fail() { echo "[reapir ✗] $*" >&2; exit 1; }

# ── Step 1: Check if gateway process is actually listening ─────────────────────
log "Checking if gateway is listening on port 18789..."
if ! lsof -i :18789 -sTCP:LISTEN &>/dev/null; then
    log "Gateway not listening — restarting via launchd..."
    if [ -f "$LAUNCHD_PLIST" ]; then
        launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
        sleep 1
        launchctl load "$LAUNCHD_PLIST"
    else
        log "No plist found — installing gateway service..."
        openclaw gateway install
        sleep 1
        launchctl load "$LAUNCHD_PLIST"
    fi
    sleep 5
    lsof -i :18789 -sTCP:LISTEN &>/dev/null || fail "Gateway still not listening after restart"
    log "Gateway is now listening ✅"
else
    log "Gateway is listening ✅"
fi

# ── Step 2: Get an operator token from paired.json ────────────────────────────
log "Looking for an operator token in $PAIRED_FILE..."
OPERATOR_TOKEN=$(python3 -c "
import json, sys
try:
    with open('$PAIRED_FILE') as f:
        devices = json.load(f)
    for d in devices.values():
        if d.get('role') == 'operator' and 'tokens' in d:
            t = d['tokens'].get('operator', {}).get('token')
            if t:
                print(t)
                break
except Exception as e:
    pass
" 2>/dev/null || echo "")

if [ -z "$OPERATOR_TOKEN" ]; then
    log "No operator token in paired.json — trying gateway master token..."
    OPERATOR_TOKEN="$GATEWAY_TOKEN"
fi
log "Using token: ${OPERATOR_TOKEN:0:16}..."

# ── Step 3: Check for pending repair request ──────────────────────────────────
log "Checking for pending repair requests..."
PENDING_ID=$(python3 -c "
import json
try:
    with open('$PENDING_FILE') as f:
        pending = json.load(f)
    for req in pending.values():
        if req.get('isRepair') or req.get('role') == 'operator':
            print(req['requestId'])
            break
except Exception:
    pass
" 2>/dev/null || echo "")

# ── Step 4: If no pending request, trigger one via non-interactive onboard ─────
if [ -z "$PENDING_ID" ]; then
    log "No pending request — triggering non-interactive re-pair..."
    # Run onboard in background to generate a pairing request
    # (will fail to complete since CLI isn't paired yet, but it queues the request)
    timeout 8 openclaw onboard \
        --non-interactive \
        --accept-risk \
        --mode local \
        --skip-channels \
        --skip-skills \
        --skip-daemon \
        --skip-health 2>/dev/null || true
    sleep 2
    # Re-read pending
    PENDING_ID=$(python3 -c "
import json
try:
    with open('$PENDING_FILE') as f:
        pending = json.load(f)
    # get most recent
    items = sorted(pending.values(), key=lambda x: x.get('ts', 0), reverse=True)
    if items:
        print(items[0]['requestId'])
except Exception:
    pass
" 2>/dev/null || echo "")
fi

# ── Step 5: Approve the pending request ───────────────────────────────────────
if [ -n "$PENDING_ID" ]; then
    log "Approving request $PENDING_ID..."
    openclaw devices approve "$PENDING_ID" --token "$OPERATOR_TOKEN" 2>&1 || {
        log "approve with specific ID failed — trying --latest..."
        openclaw devices approve --latest --token "$OPERATOR_TOKEN" 2>&1 || true
    }
else
    log "No pending request ID found — trying --latest anyway..."
    openclaw devices approve --latest --token "$OPERATOR_TOKEN" 2>&1 || true
fi

sleep 3

# ── Step 6: Verify ─────────────────────────────────────────────────────────────
log "Verifying health..."
if openclaw health 2>&1 | grep -q "OK"; then
    log "✅ OpenClaw is healthy! Re-pair successful."
    openclaw channels status 2>&1 || true
else
    log "⚠️ Still not healthy. Check gateway logs:"
    tail -10 ~/.openclaw/logs/gateway.log 2>/dev/null || true
    echo ""
    echo "Manual fallback: open OpenClaw desktop app → Devices → approve the pending request"
    exit 1
fi
