#!/bin/bash

# ============================================================
# Health Checker — System Health Monitor
# Runs every 15 minutes via PM2 cron
# Checks all services, auto-heals PM2 processes, alerts on issues
# ============================================================

set -uo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/health-checker"
MEMORY_DIR="$AGENT_DIR/memory"
REPORTS_DIR="$AGENT_DIR/reports"
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%Y-%m-%d %H:%M:%S")
LOG_FILE="$MEMORY_DIR/health_check.log"
DAILY_REPORT="$REPORTS_DIR/$TODAY.log"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$MEMORY_DIR" "$REPORTS_DIR"

# Load secrets for Telegram
if [ -f "$PROJECT_DIR/.env.secrets" ]; then
    source <(grep -v '^#' "$PROJECT_DIR/.env.secrets" | sed 's/^/export /')
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-8519931474}"

log() {
    echo "[$NOW] $1" | tee -a "$LOG_FILE" >> "$DAILY_REPORT"
}

send_telegram() {
    local message="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d text="$message" \
            -d parse_mode="Markdown" > /dev/null 2>&1
    else
        log "WARNING: Telegram credentials not configured — cannot send alert"
    fi
}

ISSUES=""
ACTIONS=""
ALL_OK=true

add_issue() {
    ISSUES="${ISSUES}  - $1\n"
    ALL_OK=false
}

add_action() {
    ACTIONS="${ACTIONS}  - $1\n"
}

log "=== Health check started ==="

# ── 1. Check HTTP health endpoints ───────────────────────────────────────────

check_http() {
    local name="$1"
    local url="$2"
    local timeout="${3:-5}"

    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
        log "OK: $name ($url) — HTTP $http_code"
    else
        log "DOWN: $name ($url) — HTTP $http_code"
        add_issue "DOWN: $name ($url) — HTTP $http_code"
    fi
}

check_http "Frontend" "http://localhost:3002" 5
check_http "Bridge" "http://localhost:3001/health" 5
check_http "Backend API" "http://localhost:3000/health" 5
check_http "Cowork MCP" "http://localhost:3003/health" 5

# ── 2. Check PM2 processes ───────────────────────────────────────────────────

# Expected PM2 processes and whether they should be "online"
EXPECTED_PM2=(
    "frontend:online"
    "bridge:online"
    "orchestrator:online"
    "cowork-mcp:online"
    "backend-docker:online"
)

# These are cron/one-shot jobs — "stopped" is OK, "errored" is not
CRON_PM2=(
    "sentinel"
    "task-manager"
    "health-checker"
    "docs-agent"
)

if command -v pm2 &>/dev/null; then
    PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")

    for entry in "${EXPECTED_PM2[@]}"; do
        name="${entry%%:*}"
        expected_status="${entry##*:}"

        actual_status=$(echo "$PM2_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        print(app.get('pm2_env', {}).get('status', 'not_found'))
        sys.exit(0)
print('not_found')
" 2>/dev/null || echo "not_found")

        if [ "$actual_status" = "$expected_status" ]; then
            log "OK: PM2 $name — $actual_status"
        elif [ "$actual_status" = "stopped" ]; then
            log "STOPPED: PM2 $name — auto-restarting..."
            pm2 restart "$name" 2>/dev/null
            add_issue "STOPPED: PM2 $name — was stopped"
            add_action "Auto-restarted $name via PM2"
            log "ACTION: Restarted $name"
        elif [ "$actual_status" = "errored" ]; then
            # Check restart count
            restarts=$(echo "$PM2_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        print(app.get('pm2_env', {}).get('restart_time', 0))
        sys.exit(0)
print(0)
" 2>/dev/null || echo "0")
            log "ERRORED: PM2 $name — $restarts restarts (NOT auto-restarting)"
            add_issue "ERRORED: PM2 $name — $restarts restarts (needs manual investigation)"
        elif [ "$actual_status" = "not_found" ]; then
            log "MISSING: PM2 $name — not registered in PM2"
            add_issue "MISSING: PM2 $name — not found in PM2 process list"
        else
            log "UNKNOWN: PM2 $name — status=$actual_status"
            add_issue "UNKNOWN: PM2 $name — unexpected status: $actual_status"
        fi
    done

    # Check cron jobs — "stopped" is fine for these
    for name in "${CRON_PM2[@]}"; do
        actual_status=$(echo "$PM2_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        print(app.get('pm2_env', {}).get('status', 'not_found'))
        sys.exit(0)
print('not_found')
" 2>/dev/null || echo "not_found")

        if [ "$actual_status" = "errored" ]; then
            log "ERRORED: PM2 cron $name — needs investigation"
            add_issue "ERRORED: PM2 cron job $name — errored state"
        elif [ "$actual_status" = "not_found" ]; then
            log "MISSING: PM2 cron $name — not registered"
            add_issue "MISSING: PM2 cron job $name — not in PM2 process list"
        else
            log "OK: PM2 cron $name — $actual_status"
        fi
    done
else
    log "WARNING: pm2 not found in PATH"
    add_issue "pm2 not found — cannot check process status"
fi

# ── 3. Check Docker containers ───────────────────────────────────────────────

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    backend_running=$(docker ps --filter "name=backend" --format "{{.Names}}" 2>/dev/null | head -1)
    if [ -n "$backend_running" ]; then
        log "OK: Docker backend — running ($backend_running)"
    else
        log "DOWN: Docker backend — no running container"
        add_issue "DOWN: Docker backend — container not running"
    fi
else
    log "WARNING: Docker not available — skipping container check"
    # Don't add as issue if Docker Desktop isn't started — could be normal
fi

# ── 4. Check LaunchAgents ────────────────────────────────────────────────────

check_launchagent() {
    local label="$1"
    if launchctl list 2>/dev/null | grep -q "$label"; then
        log "OK: LaunchAgent $label — loaded"
    else
        log "NOT LOADED: LaunchAgent $label"
        add_issue "NOT LOADED: LaunchAgent $label — not in launchctl"
    fi
}

check_launchagent "com.juliaz.adhd-agent"
check_launchagent "com.juliaz.start-system"

# ── 5. Check OpenClaw ────────────────────────────────────────────────────────

if command -v openclaw &>/dev/null; then
    openclaw_health=$(openclaw health 2>/dev/null || echo "unreachable")
    if echo "$openclaw_health" | grep -qi "healthy\|running\|ok\|connected"; then
        log "OK: OpenClaw gateway — healthy"
    else
        log "DEGRADED: OpenClaw gateway — response: $openclaw_health"
        add_issue "DEGRADED: OpenClaw gateway — may not be running"
    fi
else
    # Try port check instead
    if curl -s --connect-timeout 3 "http://localhost:18789" &>/dev/null; then
        log "OK: OpenClaw gateway — port 18789 responsive"
    else
        log "WARNING: OpenClaw gateway — port 18789 not responsive (may be normal if WS-only)"
    fi
fi

# ── 6. Report ────────────────────────────────────────────────────────────────

if $ALL_OK; then
    log "=== All systems healthy ==="
else
    ALERT_MSG="*Health Checker Alert*
$NOW

*Issues:*
$(echo -e "$ISSUES")"

    if [ -n "$ACTIONS" ]; then
        ALERT_MSG="${ALERT_MSG}
*Actions taken:*
$(echo -e "$ACTIONS")"
    fi

    send_telegram "$ALERT_MSG"
    log "=== Health check complete — issues found, alert sent ==="
fi

log "=== Health check complete ==="
