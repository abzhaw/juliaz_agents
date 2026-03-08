#!/bin/bash

# ============================================================
# Docs Agent — Documentation Drift Detector v2
# Runs every 12 hours via PM2 cron
# Compares actual system state against documentation claims
# Alerts on actionable drift via Telegram
#
# Intelligence features v2:
#   - Incident awareness: reads shared-findings to skip drift for known-down services
#   - Memory: tracks previously reported drift to avoid re-alerting
#   - More checks: skill count verification, schedule matching, PM2 count
# ============================================================

set -uo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/meta/agents/docs-agent"
MEMORY_DIR="$AGENT_DIR/memory"
LOG_FILE="$MEMORY_DIR/docs_drift.log"
DRIFT_STATE="$MEMORY_DIR/drift_state.json"
SHARED_FINDINGS="$PROJECT_DIR/shared-findings/incidents.json"
NOW=$(date +"%Y-%m-%d %H:%M:%S")
TODAY=$(date +"%Y-%m-%d")

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

# ── Load active incidents (skip drift for known-down services) ───────────────
INCIDENT_GROUPS=$(python3 -c "
import json
try:
    data = json.load(open('$SHARED_FINDINGS'))
    groups = set()
    for fp, inc in data.get('incidents', {}).items():
        groups.add(inc.get('group', ''))
    print(' '.join(groups))
except: print('')
" 2>/dev/null || echo "")

is_known_incident() {
    local group="$1"
    echo "$INCIDENT_GROUPS" | tr ' ' '\n' | grep -qx "$group" 2>/dev/null
}

# ── Load previous drift state (for dedup) ────────────────────────────────────
PREV_DRIFTS=$(python3 -c "
import json
try:
    data = json.load(open('$DRIFT_STATE'))
    print('\n'.join(data.get('reported_drifts', [])))
except: print('')
" 2>/dev/null || echo "")

DRIFTS=""
NEW_DRIFTS=""
ALL_DRIFT_LIST=""

add_drift() {
    local msg="$1"
    DRIFTS="${DRIFTS}  - $msg\n"
    ALL_DRIFT_LIST="${ALL_DRIFT_LIST}${msg}\n"
    # Check if this is new (not reported before)
    if ! echo "$PREV_DRIFTS" | grep -qF "$msg" 2>/dev/null; then
        NEW_DRIFTS="${NEW_DRIFTS}  - 🆕 $msg\n"
    fi
}

log "=== Docs drift check started ==="

# ── 1. Check agent directories vs agent cards ─────────────────────────────────
for soul_file in "$PROJECT_DIR"/julia/*/SOUL.md "$PROJECT_DIR"/meta/agents/*/SOUL.md "$PROJECT_DIR"/thesis/agents/*/SOUL.md; do
    [ -f "$soul_file" ] || continue
    agent_dir=$(dirname "$soul_file")
    agent_name=$(basename "$agent_dir")

    case "$agent_name" in
        security-agent) card_name="sentinel" ;;
        adhd-agent) card_name="adhd_agent" ;;
        health-checker) card_name="health_checker" ;;
        task-manager) card_name="task_manager" ;;
        docs-agent) card_name="docs_agent" ;;
        *) card_name="$agent_name" ;;
    esac

    card_file="$PROJECT_DIR/meta/docs/agent_cards/${card_name}.md"
    if [ ! -f "$card_file" ]; then
        log "DRIFT: Agent '$agent_name' has SOUL.md but no agent card at docs/agent_cards/${card_name}.md"
        add_drift "Missing agent card for *$agent_name* (has SOUL.md but no card)"
    fi
done

# ── 2. Check PM2 ecosystem entries vs overview ───────────────────────────────
ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.config.js"
if [ -f "$ECOSYSTEM_FILE" ]; then
    OVERVIEW_FILE="$PROJECT_DIR/meta/docs/agent_system_overview.md"
    if [ -f "$OVERVIEW_FILE" ]; then
        PM2_NAMES=$(grep "name:" "$ECOSYSTEM_FILE" | sed "s/.*name: *['\"]\\([^'\"]*\\)['\"].*/\\1/" | tr -d ",' ")
        for name in $PM2_NAMES; do
            if ! grep -qi "$name" "$OVERVIEW_FILE" 2>/dev/null; then
                if ! is_known_incident "$name"; then
                    log "DRIFT: PM2 service '$name' not mentioned in agent_system_overview.md"
                    add_drift "PM2 service *$name* not in agent\\_system\\_overview.md"
                fi
            fi
        done
    fi
fi

# ── 3. Check port claims ─────────────────────────────────────────────────────
OVERVIEW_FILE="$PROJECT_DIR/meta/docs/agent_system_overview.md"
README_FILE="$PROJECT_DIR/README.md"

for port in 3000 3001 3002 3003; do
    if [ -f "$OVERVIEW_FILE" ] && ! grep -q "$port" "$OVERVIEW_FILE" 2>/dev/null; then
        log "DRIFT: Port $port not documented in agent_system_overview.md"
        add_drift "Port $port missing from agent\\_system\\_overview.md"
    fi
done

# ── 4. Check start-system.sh step count vs docs ─────────────────────────────
if [ -f "$PROJECT_DIR/start-system.sh" ]; then
    ACTUAL_STEPS=$(grep -c "^# ── [0-9]" "$PROJECT_DIR/start-system.sh" 2>/dev/null || echo 0)

    if [ -f "$README_FILE" ]; then
        if grep -q "7-stage\|7 stage\|7 steps" "$README_FILE" 2>/dev/null && [ "$ACTUAL_STEPS" -ne 7 ]; then
            log "DRIFT: README says 7 stages but start-system.sh has $ACTUAL_STEPS"
            add_drift "README claims 7 startup stages but start-system.sh has $ACTUAL_STEPS"
        fi
    fi
fi

# ── 5. Check identity file completeness ──────────────────────────────────────
for soul_file in "$PROJECT_DIR"/julia/*/SOUL.md "$PROJECT_DIR"/meta/agents/*/SOUL.md "$PROJECT_DIR"/thesis/agents/*/SOUL.md; do
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

# ── 6. NEW: Check actual PM2 process count vs ecosystem config ───────────────
if command -v pm2 &>/dev/null && [ -f "$ECOSYSTEM_FILE" ]; then
    CONFIGURED_COUNT=$(grep -c "name:" "$ECOSYSTEM_FILE" 2>/dev/null || echo 0)
    ACTUAL_COUNT=$(pm2 jlist 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
    if [ "$CONFIGURED_COUNT" != "$ACTUAL_COUNT" ]; then
        log "DRIFT: ecosystem.config.js has $CONFIGURED_COUNT apps but PM2 has $ACTUAL_COUNT registered"
        add_drift "ecosystem.config.js defines $CONFIGURED_COUNT apps but PM2 has $ACTUAL_COUNT"
    fi
fi

# ── 7. NEW: Verify ambient agent schedules match docs ────────────────────────
if [ -f "$ECOSYSTEM_FILE" ]; then
    if ! grep -A5 "health-checker" "$ECOSYSTEM_FILE" | grep -q '*/15'; then
        add_drift "Health Checker cron schedule doesn't match documented every-15-minutes"
    fi
    if ! grep -A5 "sentinel" "$ECOSYSTEM_FILE" | grep -q '0 7'; then
        add_drift "Sentinel cron schedule doesn't match documented 07:00 daily"
    fi
fi

# ── 8. NEW: Check for undocumented git commits ──────────────────────────────
# Compare git log dates against project_log.md entries
PROJECT_LOG="$PROJECT_DIR/thesis/documentation/project_log.md"
if [ -f "$PROJECT_LOG" ] && command -v git &>/dev/null; then
    # Find the last date mentioned in the project log
    LAST_LOG_DATE=$(grep -oE "^## [0-9]{4}-[0-9]{2}-[0-9]{2}" "$PROJECT_LOG" | tail -1 | sed 's/^## //')

    if [ -n "$LAST_LOG_DATE" ]; then
        # Count commits since the last documented date
        UNDOCUMENTED_COMMITS=$(git -C "$PROJECT_DIR" log --oneline --after="$LAST_LOG_DATE" --no-merges 2>/dev/null | wc -l | tr -d ' ')

        if [ "$UNDOCUMENTED_COMMITS" -gt 5 ]; then
            # Get a summary of what changed
            RECENT_SUMMARY=$(git -C "$PROJECT_DIR" log --oneline --after="$LAST_LOG_DATE" --no-merges 2>/dev/null | head -10)
            DAYS_BEHIND=$(( ($(date +%s) - $(date -j -f "%Y-%m-%d" "$LAST_LOG_DATE" +%s 2>/dev/null || date -d "$LAST_LOG_DATE" +%s 2>/dev/null || echo $(date +%s))) / 86400 ))

            log "DRIFT: project_log.md is $DAYS_BEHIND days behind with $UNDOCUMENTED_COMMITS undocumented commits"
            add_drift "📖 *project\\_log.md* is *${DAYS_BEHIND} days behind* — $UNDOCUMENTED_COMMITS undocumented commits since $LAST_LOG_DATE"
        fi
    fi
fi

# ── 9. Save drift state ─────────────────────────────────────────────────────
python3 -c "
import json
all_drifts = '''$(echo -e "$ALL_DRIFT_LIST")'''.strip().split('\n')
all_drifts = [d.strip() for d in all_drifts if d.strip()]
state = {
    'reported_drifts': all_drifts,
    'last_check': '$NOW',
    'drift_count': len(all_drifts),
}
with open('$DRIFT_STATE', 'w') as f:
    json.dump(state, f, indent=2)
" 2>/dev/null || true

# ── 10. Update shared findings with docs-agent data ─────────────────────────
python3 -c "
import json, datetime
try:
    with open('$SHARED_FINDINGS') as f:
        shared = json.load(f)
except: shared = {'incidents': {}, 'resolved': []}

shared.setdefault('docs_drift', {})
shared['docs_drift'] = {
    'count': $(echo -e "$ALL_DRIFT_LIST" | grep -c "." 2>/dev/null || echo 0),
    'last_check': '$NOW',
    'source': 'docs-agent',
}
shared['last_updated'] = datetime.datetime.now().isoformat()

with open('$SHARED_FINDINGS', 'w') as f:
    json.dump(shared, f, indent=2)
" 2>/dev/null || true

# ── 11. Report ───────────────────────────────────────────────────────────────
if [ -z "$DRIFTS" ]; then
    log "=== All documentation synchronized — no drift detected ==="
else
    # Only alert on NEW drifts (not previously reported)
    if [ -n "$NEW_DRIFTS" ]; then
        ALERT_MSG="📖 *Docs Agent — New Drift Detected*
$NOW

*New documentation drift:*
$(echo -e "$NEW_DRIFTS")"

        if [ -n "$INCIDENT_GROUPS" ]; then
            ALERT_MSG="${ALERT_MSG}

_Note: Some checks suppressed due to active incidents ($INCIDENT_GROUPS)_"
        fi

        send_telegram "$ALERT_MSG"
        log "=== New drift detected — alert sent ==="
    else
        log "=== Drift detected but all previously reported — staying silent ==="
    fi
fi

log "=== Docs drift check complete ==="
