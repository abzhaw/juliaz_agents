#!/bin/bash

# ============================================================
# Docs Agent — Documentation Drift Detector
# Runs every 12 hours via PM2 cron
# Compares actual system state against documentation claims
# Alerts on actionable drift via Telegram
# ============================================================

set -uo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/docs-agent"
MEMORY_DIR="$AGENT_DIR/memory"
LOG_FILE="$MEMORY_DIR/docs_drift.log"
NOW=$(date +"%Y-%m-%d %H:%M:%S")

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$MEMORY_DIR"

# Load secrets for Telegram
if [ -f "$PROJECT_DIR/.env.secrets" ]; then
    source <(grep -v '^#' "$PROJECT_DIR/.env.secrets" | sed 's/^/export /')
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-8519931474}"

log() {
    echo "[$NOW] $1" >> "$LOG_FILE"
}

send_telegram() {
    local message="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d text="$message" \
            -d parse_mode="Markdown" > /dev/null 2>&1
    fi
}

DRIFTS=""
add_drift() {
    DRIFTS="${DRIFTS}  - $1\n"
}

log "=== Docs drift check started ==="

# ── 1. Check agent directories vs agent cards ─────────────────────────────────
# Every directory with a SOUL.md should have an agent card
for soul_file in "$PROJECT_DIR"/*/SOUL.md; do
    [ -f "$soul_file" ] || continue
    agent_dir=$(dirname "$soul_file")
    agent_name=$(basename "$agent_dir")

    # Map directory names to card filenames
    case "$agent_name" in
        security-agent) card_name="sentinel" ;;
        adhd-agent) card_name="adhd_agent" ;;
        health-checker) card_name="health_checker" ;;
        task-manager) card_name="task_manager" ;;
        docs-agent) card_name="docs_agent" ;;
        *) card_name="$agent_name" ;;
    esac

    card_file="$PROJECT_DIR/docs/agent_cards/${card_name}.md"
    if [ ! -f "$card_file" ]; then
        log "DRIFT: Agent '$agent_name' has SOUL.md but no agent card at docs/agent_cards/${card_name}.md"
        add_drift "Missing agent card for *$agent_name* (has SOUL.md but no card)"
    fi
done

# ── 2. Check PM2 ecosystem entries vs overview ───────────────────────────────
# Count PM2 apps in ecosystem.config.js
ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.config.js"
if [ -f "$ECOSYSTEM_FILE" ]; then
    PM2_COUNT=$(grep -c "name:" "$ECOSYSTEM_FILE" 2>/dev/null || echo 0)

    # Check if agent_system_overview.md mentions all PM2 services
    OVERVIEW_FILE="$PROJECT_DIR/docs/agent_system_overview.md"
    if [ -f "$OVERVIEW_FILE" ]; then
        # Extract PM2 service names from ecosystem config
        PM2_NAMES=$(grep "name:" "$ECOSYSTEM_FILE" | sed "s/.*name: *['\"]\\([^'\"]*\\)['\"].*/\\1/" | tr -d ",' ")
        for name in $PM2_NAMES; do
            if ! grep -qi "$name" "$OVERVIEW_FILE" 2>/dev/null; then
                log "DRIFT: PM2 service '$name' not mentioned in agent_system_overview.md"
                add_drift "PM2 service *$name* not in agent\\_system\\_overview.md"
            fi
        done
    fi
fi

# ── 3. Check port claims ─────────────────────────────────────────────────────
# Verify that documented ports match what ecosystem.config.js actually configures
OVERVIEW_FILE="$PROJECT_DIR/docs/agent_system_overview.md"
README_FILE="$PROJECT_DIR/README.md"

for port in 3000 3001 3002 3003; do
    if [ -f "$OVERVIEW_FILE" ] && ! grep -q "$port" "$OVERVIEW_FILE" 2>/dev/null; then
        log "DRIFT: Port $port not documented in agent_system_overview.md"
        add_drift "Port $port missing from agent\\_system\\_overview.md"
    fi
done

# ── 4. Check start-system.sh step count vs docs ─────────────────────────────
if [ -f "$PROJECT_DIR/start-system.sh" ]; then
    # Count actual steps (look for "# ── N." pattern)
    ACTUAL_STEPS=$(grep -c "^# ── [0-9]" "$PROJECT_DIR/start-system.sh" 2>/dev/null || echo 0)

    # Check if README mentions the correct step count
    if [ -f "$README_FILE" ]; then
        if grep -q "7-stage\|7 stage\|7 steps" "$README_FILE" 2>/dev/null && [ "$ACTUAL_STEPS" -ne 7 ]; then
            log "DRIFT: README says 7 stages but start-system.sh has $ACTUAL_STEPS"
            add_drift "README claims 7 startup stages but start-system.sh has $ACTUAL_STEPS"
        fi
    fi
fi

# ── 5. Check identity file completeness ──────────────────────────────────────
# Every agent directory with SOUL.md should also have IDENTITY.md and HEARTBEAT.md
for soul_file in "$PROJECT_DIR"/*/SOUL.md; do
    [ -f "$soul_file" ] || continue
    agent_dir=$(dirname "$soul_file")
    agent_name=$(basename "$agent_dir")

    if [ ! -f "$agent_dir/IDENTITY.md" ]; then
        log "DRIFT: $agent_name has SOUL.md but no IDENTITY.md"
        add_drift "*$agent_name* missing IDENTITY.md"
    fi
    if [ ! -f "$agent_dir/HEARTBEAT.md" ]; then
        log "DRIFT: $agent_name has SOUL.md but no HEARTBEAT.md"
        add_drift "*$agent_name* missing HEARTBEAT.md"
    fi
done

# ── 6. Report ────────────────────────────────────────────────────────────────
if [ -z "$DRIFTS" ]; then
    log "=== All documentation synchronized — no drift detected ==="
else
    ALERT_MSG="📖 *Docs Agent — Drift Detected*
$NOW

*Documentation has drifted from reality:*
$(echo -e "$DRIFTS")"

    send_telegram "$ALERT_MSG"
    log "=== Drift detected — alert sent ==="
fi

log "=== Docs drift check complete ==="
