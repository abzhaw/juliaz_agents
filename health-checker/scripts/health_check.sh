#!/bin/bash

# ============================================================
# Health Checker — System Health Monitor
# Runs every 15 minutes via PM2 cron
# Checks all services, auto-heals PM2 processes, alerts on issues
# ============================================================

set -uo pipefail

PROJECT_DIR="${PROJECT_DIR:-/Users/raphael/juliaz_agents}"
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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FINDINGS_LINES=""

emit_finding() {
    local id="$1" severity="$2" category="$3" title="$4" detail="$5"
    local related="${6:-}"
    local raw_data="${7:-\{\}}"
    FINDINGS_LINES="${FINDINGS_LINES}
{\"id\":\"${id}\",\"severity\":\"${severity}\",\"category\":\"${category}\",\"title\":\"${title}\",\"detail\":\"${detail}\",\"related_to\":[${related}],\"raw_data\":${raw_data},\"status\":\"finding\"}"
}

emit_healthy() {
    local id="$1" label="$2"
    FINDINGS_LINES="${FINDINGS_LINES}
{\"status\":\"healthy\",\"id\":\"${id}\",\"label\":\"${label}\"}"
}

log "=== Health check started ==="

# ── 1. Check HTTP health endpoints ───────────────────────────────────────────

check_http() {
    local name="$1"
    local url="$2"
    local timeout="${3:-5}"
    local id="hc-http-$(echo "$url" | sed 's|[^a-zA-Z0-9]|-|g')"

    # Try twice with 3s gap
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null || echo "000")
    if [ "$http_code" = "000" ] || [ "$http_code" = "500" ]; then
        sleep 3
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null || echo "000")
    fi

    if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
        log "OK: $name ($url) — HTTP $http_code"
        emit_healthy "$id" "$name ($url): HTTP $http_code"
    else
        log "DOWN: $name ($url) — HTTP $http_code"
        emit_finding "$id" "critical" "service-down" "$name unreachable" "HTTP $http_code from $url (retry failed)" "" "{\"http_code\":\"$http_code\",\"url\":\"$url\"}"
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
            emit_healthy "hc-pm2-$name" "PM2 $name: $actual_status"
        elif [ "$actual_status" = "stopped" ]; then
            log "STOPPED: PM2 $name — auto-restarting..."
            pm2 restart "$name" 2>/dev/null
            emit_finding "hc-pm2-$name-stopped" "high" "service-stopped" "PM2 $name was stopped" "Auto-restarted via PM2" "" "{\"pm2_status\":\"stopped\"}"
            log "ACTION: Restarted $name"
        elif [ "$actual_status" = "errored" ]; then
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
            emit_finding "hc-pm2-$name-errored" "critical" "service-errored" "PM2 $name errored ($restarts restarts)" "Needs manual investigation" "\"hc-http-*\"" "{\"pm2_status\":\"errored\",\"restarts\":$restarts}"
        elif [ "$actual_status" = "waiting restart" ]; then
            restarts=$(echo "$PM2_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        print(app.get('pm2_env', {}).get('restart_time', 0))
        sys.exit(0)
print(0)
" 2>/dev/null || echo "0")
            log "CRASH-LOOP: PM2 $name — waiting restart ($restarts restarts)"
            emit_finding "hc-pm2-$name-crash-loop" "critical" "service-crash-loop" "PM2 $name crash-looping ($restarts restarts)" "PM2 in exponential backoff" "\"hc-http-*\"" "{\"pm2_status\":\"waiting restart\",\"restarts\":$restarts}"
        elif [ "$actual_status" = "launching" ]; then
            log "LAUNCHING: PM2 $name — transient, skip"
            # Don't emit anything — check again next cycle
        elif [ "$actual_status" = "not_found" ]; then
            log "MISSING: PM2 $name — not registered in PM2"
            emit_finding "hc-pm2-$name-missing" "high" "service-missing" "PM2 $name not found" "Not registered in PM2 process list"
        else
            log "UNKNOWN: PM2 $name — status=$actual_status"
            emit_finding "hc-pm2-$name-unknown" "medium" "service-unknown" "PM2 $name unexpected status: $actual_status" "Status: $actual_status" "" "{\"pm2_status\":\"$actual_status\"}"
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
            emit_finding "hc-pm2-cron-$name-errored" "high" "cron-errored" "PM2 cron $name errored" "Cron job in errored state" "" "{\"pm2_status\":\"errored\"}"
        elif [ "$actual_status" = "not_found" ]; then
            log "MISSING: PM2 cron $name — not registered"
            emit_finding "hc-pm2-cron-$name-missing" "medium" "cron-missing" "PM2 cron $name not found" "Not in PM2 process list"
        else
            log "OK: PM2 cron $name — $actual_status"
            emit_healthy "hc-pm2-cron-$name" "PM2 cron $name: $actual_status"
        fi
    done
else
    log "WARNING: pm2 not found in PATH"
    emit_finding "hc-pm2-not-found" "high" "tooling-missing" "pm2 not found" "Cannot check process status — pm2 not in PATH"
fi

# ── 3. Check Docker containers ───────────────────────────────────────────────

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    backend_running=$(docker ps --filter "name=backend" --format "{{.Names}}" 2>/dev/null | head -1)
    if [ -n "$backend_running" ]; then
        log "OK: Docker backend — running ($backend_running)"
        emit_healthy "hc-docker-backend" "Docker backend: running ($backend_running)"
    else
        log "DOWN: Docker backend — no running container"
        emit_finding "hc-docker-backend" "critical" "service-down" "Docker backend not running" "No running container found"
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
        emit_healthy "hc-launchagent-$label" "LaunchAgent $label: loaded"
    else
        log "NOT LOADED: LaunchAgent $label"
        emit_finding "hc-launchagent-$label" "medium" "launchagent-missing" "LaunchAgent $label not loaded" "Not found in launchctl"
    fi
}

check_launchagent "com.juliaz.adhd-agent"
check_launchagent "com.juliaz.start-system"

# ── 5. Check OpenClaw ────────────────────────────────────────────────────────

if command -v openclaw &>/dev/null; then
    openclaw_health=$(openclaw health 2>/dev/null || echo "unreachable")
    if echo "$openclaw_health" | grep -qi "healthy\|running\|ok\|connected"; then
        log "OK: OpenClaw gateway — healthy"
        emit_healthy "hc-openclaw" "OpenClaw gateway: healthy"
    else
        log "DEGRADED: OpenClaw gateway — response: $openclaw_health"
        emit_finding "hc-openclaw" "high" "gateway-degraded" "OpenClaw gateway degraded" "Response: $openclaw_health"
    fi
else
    # Try port check instead
    if curl -s --connect-timeout 3 "http://localhost:18789" &>/dev/null; then
        log "OK: OpenClaw gateway — port 18789 responsive"
        emit_healthy "hc-openclaw" "OpenClaw gateway: port 18789 responsive"
    else
        log "WARNING: OpenClaw gateway — port 18789 not responsive (may be normal if WS-only)"
        # Don't emit finding — WS-only is expected behavior
    fi
fi

# ── 6. Write structured output ────────────────────────────────────────────────
echo "$FINDINGS_LINES" | python3 "$SCRIPT_DIR/write_findings.py"

log "=== Health check complete ==="
