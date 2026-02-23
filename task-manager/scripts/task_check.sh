#!/bin/bash

# ============================================================
# Task Manager — Heartbeat Check
# Runs every 6 hours via PM2 cron
# Checks task queue integrity, stale tasks, unblocked tasks
# Sends Telegram alerts when action is needed
# ============================================================

set -uo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/task-manager"
TODO_DIR="$PROJECT_DIR/todo"
MEMORY_DIR="$AGENT_DIR/memory"
INDEX_FILE="$TODO_DIR/index.yml"
LOG_FILE="$MEMORY_DIR/task_check.log"
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%Y-%m-%d %H:%M:%S")
DAY_OF_WEEK=$(date +%u)  # 1=Monday

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

ALERTS=""
add_alert() {
    ALERTS="${ALERTS}$1\n"
}

log "=== Task Manager heartbeat started ==="

# ── 1. Check index exists ─────────────────────────────────────────────────────
if [ ! -f "$INDEX_FILE" ]; then
    log "WARNING: index.yml missing"
    add_alert "- index.yml is missing from todo/"
fi

# ── 2. Count tasks by status ─────────────────────────────────────────────────
OPEN=0
IN_PROGRESS=0
BLOCKED=0
DONE=0
CANCELLED=0
TOTAL=0
STALE_TASKS=""

for task_file in "$TODO_DIR"/TASK-*.yml; do
    [ -f "$task_file" ] || continue
    TOTAL=$((TOTAL + 1))

    # Extract status
    status=$(grep -m1 "^status:" "$task_file" | sed 's/status: *//' | tr -d '[:space:]')

    case "$status" in
        open) OPEN=$((OPEN + 1)) ;;
        in_progress)
            IN_PROGRESS=$((IN_PROGRESS + 1))
            # Check if stale (modified more than 7 days ago)
            if [ "$(uname)" = "Darwin" ]; then
                mod_epoch=$(stat -f %m "$task_file" 2>/dev/null || echo 0)
            else
                mod_epoch=$(stat -c %Y "$task_file" 2>/dev/null || echo 0)
            fi
            now_epoch=$(date +%s)
            age_days=$(( (now_epoch - mod_epoch) / 86400 ))
            if [ "$age_days" -gt 7 ]; then
                task_id=$(basename "$task_file" .yml)
                title=$(grep -m1 "^title:" "$task_file" | sed 's/title: *//')
                STALE_TASKS="${STALE_TASKS}  - ${task_id}: ${title} (${age_days}d stale)\n"
                add_alert "- ${task_id} has been in\_progress for ${age_days} days: ${title}"
            fi
            ;;
        blocked) BLOCKED=$((BLOCKED + 1)) ;;
        done) DONE=$((DONE + 1)) ;;
        cancelled) CANCELLED=$((CANCELLED + 1)) ;;
    esac
done

log "Tasks: $TOTAL total | $OPEN open | $IN_PROGRESS in_progress | $BLOCKED blocked | $DONE done"

# ── 3. Check for unblocked tasks ─────────────────────────────────────────────
for task_file in "$TODO_DIR"/TASK-*.yml; do
    [ -f "$task_file" ] || continue
    status=$(grep -m1 "^status:" "$task_file" | sed 's/status: *//' | tr -d '[:space:]')
    [ "$status" = "blocked" ] || continue

    # Check depends_on
    deps=$(grep "depends_on:" "$task_file" | sed 's/.*depends_on: *//' | tr -d '[]' | tr ',' ' ')
    all_done=true
    for dep in $deps; do
        dep=$(echo "$dep" | tr -d '[:space:]')
        [ -z "$dep" ] && continue
        dep_file="$TODO_DIR/${dep}.yml"
        if [ -f "$dep_file" ]; then
            dep_status=$(grep -m1 "^status:" "$dep_file" | sed 's/status: *//' | tr -d '[:space:]')
            if [ "$dep_status" != "done" ]; then
                all_done=false
                break
            fi
        fi
    done

    if $all_done && [ -n "$deps" ]; then
        task_id=$(basename "$task_file" .yml)
        title=$(grep -m1 "^title:" "$task_file" | sed 's/title: *//')
        add_alert "- ${task_id} is now unblocked (dependencies done): ${title}"
        log "Auto-unblock candidate: $task_id"
    fi
done

# ── 4. Check orphan files (in todo/ but not in index) ────────────────────────
if [ -f "$INDEX_FILE" ]; then
    for task_file in "$TODO_DIR"/TASK-*.yml; do
        [ -f "$task_file" ] || continue
        task_id=$(basename "$task_file" .yml)
        if ! grep -q "$task_id" "$INDEX_FILE" 2>/dev/null; then
            add_alert "- Orphan task file: ${task_id} (not in index.yml)"
            log "Orphan task: $task_id"
        fi
    done
fi

# ── 5. Send weekly summary on Mondays ────────────────────────────────────────
if [ "$DAY_OF_WEEK" = "1" ]; then
    WEEKLY_MSG=$(cat <<EOF
*Task Manager - Weekly Summary*
$TODAY

Open: $OPEN | In Progress: $IN_PROGRESS | Blocked: $BLOCKED | Done: $DONE | Total: $TOTAL
EOF
)
    if [ -n "$STALE_TASKS" ]; then
        WEEKLY_MSG="${WEEKLY_MSG}

*Stale tasks (>7 days):*
$(echo -e "$STALE_TASKS")"
    fi
    send_telegram "$WEEKLY_MSG"
    log "Weekly summary sent"
fi

# ── 6. Send alerts if any ────────────────────────────────────────────────────
if [ -n "$ALERTS" ]; then
    ALERT_MSG=$(cat <<EOF
*Task Manager Alert*
$(echo -e "$ALERTS")
EOF
)
    send_telegram "$ALERT_MSG"
    log "Alerts sent: $(echo -e "$ALERTS" | wc -l) items"
fi

log "=== Task Manager heartbeat complete ==="
