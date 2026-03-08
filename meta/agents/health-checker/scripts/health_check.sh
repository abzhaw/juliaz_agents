#!/bin/bash

# ============================================================
# Health Checker — Intelligent System Health Monitor v2
# Runs every 15 minutes via PM2 cron
#
# Intelligence features:
#   - Alert deduplication: won't re-send identical alerts
#   - Escalation tiers: NEW → PERSISTENT (3x) → CRITICAL (6x) → SILENT (daily digest)
#   - Issue correlation: groups related failures (e.g. Docker + API = one incident)
#   - Self-healing: tiered recovery for stopped/waiting restart/errored states
#   - Shared findings: writes to shared-findings/incidents.json for other agents
#   - Recovery detection: notifies when issues resolve
# ============================================================

set -uo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/meta/agents/health-checker"
MEMORY_DIR="$AGENT_DIR/memory"
REPORTS_DIR="$AGENT_DIR/reports"
SHARED_FINDINGS="$PROJECT_DIR/shared-findings/incidents.json"
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%Y-%m-%d %H:%M:%S")
NOW_EPOCH=$(date +%s)
LOG_FILE="$MEMORY_DIR/health_check.log"
DAILY_REPORT="$REPORTS_DIR/$TODAY.log"
ALERT_STATE_FILE="$MEMORY_DIR/alert_state.json"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$MEMORY_DIR" "$REPORTS_DIR" "$(dirname "$SHARED_FINDINGS")"

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

# ── Issue Collection ──────────────────────────────────────────────────────────
# Issues are now structured: fingerprint|severity|group|message
ISSUES_RAW=""
ACTIONS=""
ALL_OK=true

add_issue() {
    local fingerprint="$1"
    local severity="$2"   # critical, high, medium, low
    local group="$3"      # correlation group (e.g., "backend" groups Docker + API)
    local message="$4"
    ISSUES_RAW="${ISSUES_RAW}${fingerprint}|${severity}|${group}|${message}\n"
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
    local group="$3"
    local timeout="${4:-5}"

    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" "$url" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
        log "OK: $name ($url) — HTTP $http_code"
    else
        log "DOWN: $name ($url) — HTTP $http_code"
        add_issue "http_${name// /_}" "high" "$group" "DOWN: $name ($url) — HTTP $http_code"
    fi
}

check_http "Frontend" "http://localhost:3002" "frontend" 5
check_http "Bridge" "http://localhost:3001/health" "bridge" 5
check_http "Backend API" "http://localhost:3000/health" "backend" 5
check_http "Cowork MCP" "http://localhost:3003/health" "cowork-mcp" 5

# ── 2. Check PM2 processes ───────────────────────────────────────────────────

EXPECTED_PM2=(
    "frontend:online:frontend"
    "bridge:online:bridge"
    "orchestrator:online:orchestrator"
    "cowork-mcp:online:cowork-mcp"
    "backend-docker:online:backend"
)

CRON_PM2=(
    "sentinel"
    "task-manager"
    "health-checker"
    "docs-agent"
)

if command -v pm2 &>/dev/null; then
    PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")

    for entry in "${EXPECTED_PM2[@]}"; do
        name=$(echo "$entry" | cut -d: -f1)
        expected_status=$(echo "$entry" | cut -d: -f2)
        group=$(echo "$entry" | cut -d: -f3)

        pm2_info=$(echo "$PM2_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        env = app.get('pm2_env', {})
        print(f\"{env.get('status', 'not_found')}|{env.get('restart_time', 0)}\")
        sys.exit(0)
print('not_found|0')
" 2>/dev/null || echo "not_found|0")

        actual_status=$(echo "$pm2_info" | cut -d'|' -f1)
        restarts=$(echo "$pm2_info" | cut -d'|' -f2)

        if [ "$actual_status" = "$expected_status" ]; then
            log "OK: PM2 $name — $actual_status"

        elif [ "$actual_status" = "stopped" ]; then
            # Tier 1 self-heal: auto-restart stopped processes
            log "STOPPED: PM2 $name — auto-restarting..."
            pm2 restart "$name" 2>/dev/null
            add_action "Auto-restarted $name via PM2"
            log "ACTION: Restarted $name"
            # Check if it came back
            sleep 3
            new_status=$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        print(app.get('pm2_env', {}).get('status', 'unknown'))
        sys.exit(0)
print('unknown')
" 2>/dev/null || echo "unknown")
            if [ "$new_status" = "online" ]; then
                log "HEALED: PM2 $name — successfully restarted"
                add_action "Self-healed: $name is back online"
            else
                add_issue "pm2_${name}" "high" "$group" "STOPPED: PM2 $name — restart attempted but status is $new_status"
            fi

        elif [ "$actual_status" = "waiting restart" ]; then
            # NEW: Handle "waiting restart" explicitly
            # This means PM2 is in backoff delay. If restarts < max, let it retry.
            # If restarts >= max, it's stuck — try a manual restart.
            if [ "$restarts" -ge 5 ]; then
                log "STUCK: PM2 $name — waiting restart with $restarts restarts, attempting manual restart..."
                pm2 delete "$name" 2>/dev/null
                sleep 2
                pm2 start "$PROJECT_DIR/ecosystem.config.js" --only "$name" 2>/dev/null
                add_action "Force-restarted $name (was stuck in waiting restart with $restarts restarts)"
                add_issue "pm2_${name}" "high" "$group" "STUCK: PM2 $name — was in waiting restart loop ($restarts restarts), force-restarted"
            else
                log "RECOVERING: PM2 $name — waiting restart ($restarts restarts, letting PM2 retry)"
                add_issue "pm2_${name}" "medium" "$group" "RECOVERING: PM2 $name — waiting restart ($restarts retries so far)"
            fi

        elif [ "$actual_status" = "errored" ]; then
            # Tier 2 self-heal: try one restart for errored, but only if restarts < threshold
            if [ "$restarts" -lt 15 ]; then
                log "ERRORED: PM2 $name — $restarts restarts, attempting one restart..."
                pm2 restart "$name" 2>/dev/null
                add_action "Attempted restart of errored $name ($restarts prior restarts)"
                sleep 3
                new_status=$(pm2 jlist 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for app in data:
    if app.get('name') == '$name':
        print(app.get('pm2_env', {}).get('status', 'unknown'))
        sys.exit(0)
print('unknown')
" 2>/dev/null || echo "unknown")
                if [ "$new_status" = "online" ]; then
                    log "HEALED: PM2 $name — recovered from errored state"
                    add_action "Self-healed: $name recovered from errored state"
                else
                    add_issue "pm2_${name}" "critical" "$group" "ERRORED: PM2 $name — $restarts restarts, restart failed (needs manual investigation)"
                fi
            else
                log "ERRORED: PM2 $name — $restarts restarts (too many, not auto-restarting)"
                add_issue "pm2_${name}" "critical" "$group" "ERRORED: PM2 $name — $restarts restarts (exceeded threshold, needs manual investigation)"
            fi

        elif [ "$actual_status" = "not_found" ]; then
            log "MISSING: PM2 $name — not registered in PM2"
            add_issue "pm2_${name}" "critical" "$group" "MISSING: PM2 $name — not found in PM2 process list"
        else
            log "UNKNOWN: PM2 $name — status=$actual_status"
            add_issue "pm2_${name}" "medium" "$group" "UNEXPECTED: PM2 $name — status: $actual_status"
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
            add_issue "pm2_cron_${name}" "medium" "cron" "ERRORED: PM2 cron job $name — errored state"
        elif [ "$actual_status" = "not_found" ]; then
            log "MISSING: PM2 cron $name — not registered"
            add_issue "pm2_cron_${name}" "medium" "cron" "MISSING: PM2 cron job $name — not in PM2 process list"
        else
            log "OK: PM2 cron $name — $actual_status"
        fi
    done
else
    log "WARNING: pm2 not found in PATH"
    add_issue "pm2_missing" "critical" "system" "pm2 not found — cannot check process status"
fi

# ── 3. Check Docker containers ───────────────────────────────────────────────

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    backend_running=$(docker ps --filter "name=backend" --format "{{.Names}}" 2>/dev/null | head -1)
    if [ -n "$backend_running" ]; then
        log "OK: Docker backend — running ($backend_running)"
    else
        log "DOWN: Docker backend — no running container"
        # Tier 3 self-heal: try docker compose up if container is down
        log "HEAL: Attempting docker compose up for backend..."
        if docker compose -f "$PROJECT_DIR/julia/backend/docker-compose.yml" up -d 2>/dev/null; then
            sleep 5
            backend_running=$(docker ps --filter "name=backend" --format "{{.Names}}" 2>/dev/null | head -1)
            if [ -n "$backend_running" ]; then
                log "HEALED: Docker backend — container restarted successfully"
                add_action "Self-healed: Docker backend container restarted"
            else
                add_issue "docker_backend" "high" "backend" "DOWN: Docker backend — container not running, docker compose up failed"
            fi
        else
            add_issue "docker_backend" "high" "backend" "DOWN: Docker backend — container not running, docker compose up failed"
        fi
    fi
else
    log "WARNING: Docker not available — skipping container check"
fi

# ── 4. Check LaunchAgents ────────────────────────────────────────────────────

check_launchagent() {
    local label="$1"
    if launchctl list 2>/dev/null | grep -q "$label"; then
        log "OK: LaunchAgent $label — loaded"
    else
        log "NOT LOADED: LaunchAgent $label"
        add_issue "launchagent_${label}" "low" "system" "NOT LOADED: LaunchAgent $label — not in launchctl"
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
        add_issue "openclaw" "medium" "openclaw" "DEGRADED: OpenClaw gateway — may not be running"
    fi
else
    if curl -s --connect-timeout 3 "http://localhost:18789" &>/dev/null; then
        log "OK: OpenClaw gateway — port 18789 responsive"
    else
        log "WARNING: OpenClaw gateway — port 18789 not responsive (may be normal if WS-only)"
    fi
fi

# ── 6. Intelligent Alert Processing ──────────────────────────────────────────
# This is the brain: dedup, escalation, correlation, recovery detection

python3 - "$ALERT_STATE_FILE" "$SHARED_FINDINGS" "$NOW_EPOCH" "$ALL_OK" <<'PYEOF'
import json, sys, os, hashlib

ALERT_STATE_FILE = sys.argv[1]
SHARED_FINDINGS_FILE = sys.argv[2]
NOW_EPOCH = int(sys.argv[3])
ALL_OK = sys.argv[4] == "true"

# ── Escalation Config ──
# After N occurrences within the window, escalate to next tier
ESCALATION_TIERS = {
    1: "NEW",           # First time seen
    3: "PERSISTENT",    # Seen 3 times (= 45 min)
    6: "CRITICAL",      # Seen 6 times (= 1.5 hours)
    12: "SILENT",       # Seen 12 times (= 3 hours) — stop alerting, daily digest only
}
ESCALATION_WINDOW = 14400  # 4 hours — reset escalation if issue disappears for 4h

# ── Load previous state ──
try:
    with open(ALERT_STATE_FILE) as f:
        state = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    state = {}

# ── Parse raw issues from environment ──
raw_issues_str = os.environ.get("HEALTH_ISSUES_RAW", "")
current_issues = {}
current_groups = {}

for line in raw_issues_str.strip().split("\n"):
    if not line.strip() or "|" not in line:
        continue
    parts = line.split("|", 3)
    if len(parts) < 4:
        continue
    fingerprint, severity, group, message = parts
    current_issues[fingerprint] = {
        "severity": severity,
        "group": group,
        "message": message,
    }
    current_groups.setdefault(group, []).append(fingerprint)

# ── Correlate Issues ──
# If a group has multiple issues, merge them into one correlated incident
correlated = {}
for group, fps in current_groups.items():
    if len(fps) > 1:
        # Combine messages, use highest severity
        sev_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        highest_sev = max((current_issues[fp]["severity"] for fp in fps), key=lambda s: sev_rank.get(s, 0))
        combined_msgs = []
        for fp in fps:
            combined_msgs.append(current_issues[fp]["message"])

        correlated_fp = f"correlated_{group}"
        correlated[correlated_fp] = {
            "severity": highest_sev,
            "group": group,
            "message": f"[{group.upper()} cluster] " + " + ".join(combined_msgs),
            "component_fps": fps,
        }
        # Remove individual issues from current_issues
        for fp in fps:
            current_issues.pop(fp, None)
    else:
        # Single issue in group — keep as-is
        pass

# Merge correlated back
for fp, data in correlated.items():
    current_issues[fp] = data

# ── Update State & Determine Escalation ──
alerts_to_send = []
recoveries = []

# Check for recoveries (issues that were in state but are now gone)
for fp, s in list(state.items()):
    if fp not in current_issues:
        if s.get("tier", "NEW") != "NEW":  # Only announce recovery for escalated issues
            recoveries.append(f"RESOLVED: {s.get('message', fp)}")
        del state[fp]

# Process current issues
for fp, issue in current_issues.items():
    if fp in state:
        entry = state[fp]
        # Update occurrence count
        entry["count"] = entry.get("count", 1) + 1
        entry["last_seen"] = NOW_EPOCH
        entry["message"] = issue["message"]
        entry["severity"] = issue["severity"]

        # Check if escalation window expired (issue went away and came back)
        if NOW_EPOCH - entry.get("last_seen", NOW_EPOCH) > ESCALATION_WINDOW:
            entry["count"] = 1
            entry["first_seen"] = NOW_EPOCH

        # Determine tier
        count = entry["count"]
        tier = "NEW"
        for threshold in sorted(ESCALATION_TIERS.keys(), reverse=True):
            if count >= threshold:
                tier = ESCALATION_TIERS[threshold]
                break

        old_tier = entry.get("tier", "NEW")
        entry["tier"] = tier

        # Alert logic based on tier
        if tier == "SILENT":
            # Only alert once per day in SILENT mode
            last_daily = entry.get("last_daily_alert", "")
            today = __import__("datetime").date.today().isoformat()
            if last_daily != today:
                alerts_to_send.append({
                    "tier": "DAILY_DIGEST",
                    "message": issue["message"],
                    "count": count,
                    "duration_min": (NOW_EPOCH - entry.get("first_seen", NOW_EPOCH)) // 60,
                })
                entry["last_daily_alert"] = today
        elif tier != old_tier:
            # Tier changed — always alert on escalation
            alerts_to_send.append({
                "tier": tier,
                "message": issue["message"],
                "count": count,
                "duration_min": (NOW_EPOCH - entry.get("first_seen", NOW_EPOCH)) // 60,
            })
            entry["last_alert_epoch"] = NOW_EPOCH
        # If tier didn't change and it's not SILENT, don't re-alert (dedup)

    else:
        # New issue
        state[fp] = {
            "fingerprint": fp,
            "severity": issue["severity"],
            "group": issue.get("group", "unknown"),
            "message": issue["message"],
            "count": 1,
            "first_seen": NOW_EPOCH,
            "last_seen": NOW_EPOCH,
            "tier": "NEW",
            "last_alert_epoch": NOW_EPOCH,
        }
        alerts_to_send.append({
            "tier": "NEW",
            "message": issue["message"],
            "count": 1,
            "duration_min": 0,
        })

# ── Save state ──
with open(ALERT_STATE_FILE, "w") as f:
    json.dump(state, f, indent=2)

# ── Update shared-findings/incidents.json for other agents ──
try:
    with open(SHARED_FINDINGS_FILE) as f:
        shared = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    shared = {"incidents": {}, "resolved": []}

# Update active incidents
active_incidents = {}
for fp, s in state.items():
    active_incidents[fp] = {
        "source": "health-checker",
        "severity": s.get("severity", "medium"),
        "message": s.get("message", ""),
        "group": s.get("group", "unknown"),
        "first_seen": s.get("first_seen", NOW_EPOCH),
        "last_seen": s.get("last_seen", NOW_EPOCH),
        "count": s.get("count", 1),
        "tier": s.get("tier", "NEW"),
    }

# Add recoveries to resolved list
import datetime
for r in recoveries:
    shared.setdefault("resolved", []).append({
        "message": r,
        "resolved_at": datetime.datetime.now().isoformat(),
        "source": "health-checker",
    })
    # Keep only last 50 resolved
    shared["resolved"] = shared["resolved"][-50:]

shared["incidents"] = active_incidents
shared["last_updated"] = datetime.datetime.now().isoformat()
shared["updated_by"] = "health-checker"

with open(SHARED_FINDINGS_FILE, "w") as f:
    json.dump(shared, f, indent=2)

# ── Build Telegram message ──
output = {"alerts": alerts_to_send, "recoveries": recoveries, "all_ok": ALL_OK}
# Write to temp file for the shell to read
with open(ALERT_STATE_FILE + ".telegram", "w") as f:
    json.dump(output, f, indent=2)

PYEOF

# Pass issues to Python via environment
export HEALTH_ISSUES_RAW=$(echo -e "$ISSUES_RAW")

# Re-run the Python (it reads from env)
python3 - "$ALERT_STATE_FILE" "$SHARED_FINDINGS" "$NOW_EPOCH" "$ALL_OK" <<'PYEOF'
import json, sys, os, hashlib, datetime

ALERT_STATE_FILE = sys.argv[1]
SHARED_FINDINGS_FILE = sys.argv[2]
NOW_EPOCH = int(sys.argv[3])
ALL_OK = sys.argv[4] == "true"

ESCALATION_TIERS = {1: "NEW", 3: "PERSISTENT", 6: "CRITICAL", 12: "SILENT"}
ESCALATION_WINDOW = 14400

try:
    with open(ALERT_STATE_FILE) as f:
        state = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    state = {}

raw_issues_str = os.environ.get("HEALTH_ISSUES_RAW", "")
current_issues = {}
current_groups = {}

for line in raw_issues_str.strip().split("\n"):
    if not line.strip() or "|" not in line:
        continue
    parts = line.split("|", 3)
    if len(parts) < 4:
        continue
    fingerprint, severity, group, message = parts
    current_issues[fingerprint] = {"severity": severity, "group": group, "message": message}
    current_groups.setdefault(group, []).append(fingerprint)

# Correlate: group multiple failures in same group
correlated = {}
for group, fps in current_groups.items():
    if len(fps) > 1:
        sev_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        highest_sev = max((current_issues[fp]["severity"] for fp in fps), key=lambda s: sev_rank.get(s, 0))
        combined_msgs = [current_issues[fp]["message"] for fp in fps]
        correlated_fp = f"correlated_{group}"
        correlated[correlated_fp] = {
            "severity": highest_sev, "group": group,
            "message": f"[{group.upper()}] " + " | ".join(combined_msgs),
        }
        for fp in fps:
            current_issues.pop(fp, None)

for fp, data in correlated.items():
    current_issues[fp] = data

alerts_to_send = []
recoveries = []

for fp in list(state.keys()):
    if fp not in current_issues:
        s = state[fp]
        if s.get("tier", "NEW") != "NEW":
            recoveries.append(s.get("message", fp))
        del state[fp]

for fp, issue in current_issues.items():
    if fp in state:
        entry = state[fp]
        entry["count"] = entry.get("count", 1) + 1
        entry["last_seen"] = NOW_EPOCH
        entry["message"] = issue["message"]
        entry["severity"] = issue["severity"]

        if NOW_EPOCH - entry.get("first_seen", NOW_EPOCH) > ESCALATION_WINDOW and entry.get("count", 1) == 1:
            entry["count"] = 1
            entry["first_seen"] = NOW_EPOCH

        count = entry["count"]
        tier = "NEW"
        for threshold in sorted(ESCALATION_TIERS.keys(), reverse=True):
            if count >= threshold:
                tier = ESCALATION_TIERS[threshold]
                break

        old_tier = entry.get("tier", "NEW")
        entry["tier"] = tier

        if tier == "SILENT":
            last_daily = entry.get("last_daily_alert", "")
            today = datetime.date.today().isoformat()
            if last_daily != today:
                alerts_to_send.append({"tier": "DAILY_DIGEST", "message": issue["message"],
                    "count": count, "duration_min": (NOW_EPOCH - entry.get("first_seen", NOW_EPOCH)) // 60})
                entry["last_daily_alert"] = today
        elif tier != old_tier:
            alerts_to_send.append({"tier": tier, "message": issue["message"],
                "count": count, "duration_min": (NOW_EPOCH - entry.get("first_seen", NOW_EPOCH)) // 60})
            entry["last_alert_epoch"] = NOW_EPOCH
    else:
        state[fp] = {
            "fingerprint": fp, "severity": issue["severity"], "group": issue.get("group", "unknown"),
            "message": issue["message"], "count": 1, "first_seen": NOW_EPOCH,
            "last_seen": NOW_EPOCH, "tier": "NEW", "last_alert_epoch": NOW_EPOCH,
        }
        alerts_to_send.append({"tier": "NEW", "message": issue["message"], "count": 1, "duration_min": 0})

with open(ALERT_STATE_FILE, "w") as f:
    json.dump(state, f, indent=2)

# Update shared findings
try:
    with open(SHARED_FINDINGS_FILE) as f:
        shared = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    shared = {"incidents": {}, "resolved": []}

active_incidents = {}
for fp, s in state.items():
    active_incidents[fp] = {
        "source": "health-checker", "severity": s.get("severity", "medium"),
        "message": s.get("message", ""), "group": s.get("group", "unknown"),
        "first_seen": s.get("first_seen", NOW_EPOCH), "last_seen": s.get("last_seen", NOW_EPOCH),
        "count": s.get("count", 1), "tier": s.get("tier", "NEW"),
    }

for r in recoveries:
    shared.setdefault("resolved", []).append({
        "message": f"RESOLVED: {r}", "resolved_at": datetime.datetime.now().isoformat(),
        "source": "health-checker",
    })
    shared["resolved"] = shared["resolved"][-50:]

shared["incidents"] = active_incidents
shared["last_updated"] = datetime.datetime.now().isoformat()
shared["updated_by"] = "health-checker"

with open(SHARED_FINDINGS_FILE, "w") as f:
    json.dump(shared, f, indent=2)

output = {"alerts": alerts_to_send, "recoveries": recoveries, "all_ok": ALL_OK and not current_issues}
with open(ALERT_STATE_FILE + ".telegram", "w") as f:
    json.dump(output, f, indent=2)
PYEOF

# ── 7. Send Telegram (intelligent) ───────────────────────────────────────────

TELEGRAM_DATA="$ALERT_STATE_FILE.telegram"
if [ -f "$TELEGRAM_DATA" ]; then
    TELEGRAM_MSG=$(python3 -c "
import json, sys

with open('$TELEGRAM_DATA') as f:
    data = json.load(f)

alerts = data.get('alerts', [])
recoveries = data.get('recoveries', [])
all_ok = data.get('all_ok', False)

if all_ok and not alerts and not recoveries:
    sys.exit(0)  # Nothing to send — silent when healthy

lines = []

# Recovery notifications
if recoveries:
    lines.append('✅ *Health Checker — Recovery*')
    lines.append('$NOW')
    lines.append('')
    for r in recoveries:
        lines.append(f'  ✅ {r}')
    lines.append('')

# New/escalated alerts
if alerts:
    # Group by tier
    tier_emoji = {
        'NEW': '🔵',
        'PERSISTENT': '🟠',
        'CRITICAL': '🔴',
        'DAILY_DIGEST': '📋',
    }
    tier_label = {
        'NEW': 'New Issue',
        'PERSISTENT': 'Persistent (>45min)',
        'CRITICAL': 'CRITICAL (>1.5h)',
        'DAILY_DIGEST': 'Daily Digest',
    }

    highest_tier = 'NEW'
    tier_rank = {'NEW': 1, 'PERSISTENT': 2, 'CRITICAL': 3, 'DAILY_DIGEST': 2}
    for a in alerts:
        if tier_rank.get(a['tier'], 0) > tier_rank.get(highest_tier, 0):
            highest_tier = a['tier']

    emoji = tier_emoji.get(highest_tier, '🔵')
    lines.append(f'{emoji} *Health Checker — {tier_label.get(highest_tier, \"Alert\")}*')
    lines.append('$NOW')
    lines.append('')

    for a in alerts:
        e = tier_emoji.get(a['tier'], '•')
        dur = f\" ({a['duration_min']}min)\" if a.get('duration_min', 0) > 0 else ''
        occ = f\" [x{a['count']}]\" if a.get('count', 1) > 1 else ''
        lines.append(f'  {e} {a[\"message\"]}{occ}{dur}')

# Actions taken
actions_str = '''$(echo -e "$ACTIONS")'''
if actions_str.strip():
    lines.append('')
    lines.append('*Actions taken:*')
    lines.append(actions_str)

if lines:
    print('\n'.join(lines))
" 2>/dev/null)

    if [ -n "$TELEGRAM_MSG" ]; then
        send_telegram "$TELEGRAM_MSG"
        log "=== Intelligent alert sent ==="
    else
        log "=== All systems healthy — staying silent ==="
    fi

    rm -f "$TELEGRAM_DATA"
else
    # Fallback: if Python failed, use simple alerting
    if ! $ALL_OK; then
        ALERT_MSG="*Health Checker Alert*
$NOW

*Issues:*
$(echo -e "$ISSUES_RAW" | while IFS='|' read -r fp sev grp msg; do echo "  - $msg"; done)"
        if [ -n "$ACTIONS" ]; then
            ALERT_MSG="${ALERT_MSG}
*Actions taken:*
$(echo -e "$ACTIONS")"
        fi
        send_telegram "$ALERT_MSG"
        log "=== Fallback alert sent ==="
    fi
fi

log "=== Health check complete ==="
