#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ADHD Agent — Main Ambient Loop
# Runs continuously: scan → propose → wait for approval → act → sleep → repeat
#
# Usage: ./adhd_loop.sh [--once] [--dry-run]
#   --once     Run one cycle then exit (useful for cron/schedule-task)
#   --dry-run  Scan and print findings but don't send Telegram messages
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$AGENT_DIR/config/settings.env"

source "$CONFIG"

ONCE=false
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --once)    ONCE=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

LOG="$AGENT_DIR/$LOG_FILE"
mkdir -p "$(dirname "$LOG")" "$AGENT_DIR/memory"

log() { echo "[adhd $(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }
log_action() {
  local DATE_FILE="$AGENT_DIR/memory/$(date +%Y-%m-%d).md"
  echo "" >> "$DATE_FILE"
  echo "## [$(date '+%H:%M')] $1" >> "$DATE_FILE"
  shift
  echo "$@" >> "$DATE_FILE"
}

load_snoozed() {
  SNOOZED_FILE="$AGENT_DIR/memory/snoozed.json"
  if [[ -f "$SNOOZED_FILE" ]]; then
    # Remove expired snoozes
    python3 - <<PYEOF
import json, time, os
f = '$SNOOZED_FILE'
try:
    data = json.load(open(f))
except:
    data = {}
now = time.time()
active = {k: v for k, v in data.items() if v > now}
if len(active) != len(data):
    json.dump(active, open(f, 'w'), indent=2)
PYEOF
    python3 -c "import json; print(json.dumps(list(json.load(open('$SNOOZED_FILE')).keys())))" 2>/dev/null || echo "[]"
  else
    echo "[]"
  fi
}

was_acted_on() {
  local FINGERPRINT="$1"
  local ACTIONS_FILE="$AGENT_DIR/memory/actions.json"
  if [[ ! -f "$ACTIONS_FILE" ]]; then echo "false"; return; fi
  python3 -c "
import json
data = json.load(open('$ACTIONS_FILE'))
acted = any(a.get('fingerprint') == '$FINGERPRINT' for a in data)
print('true' if acted else 'false')
" 2>/dev/null || echo "false"
}

record_action() {
  local FINGERPRINT="$1"
  local DECISION="$2"
  local DETAIL="$3"
  local ACTIONS_FILE="$AGENT_DIR/memory/actions.json"
  python3 - <<PYEOF
import json, time, os
f = '$ACTIONS_FILE'
try:
    data = json.load(open(f))
except:
    data = []
data.append({
    'fingerprint': '$FINGERPRINT',
    'decision': '$DECISION',
    'detail': '$DETAIL',
    'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
})
json.dump(data, open(f, 'w'), indent=2)
PYEOF
}

snooze_finding() {
  local FINGERPRINT="$1"
  local UNTIL=$(($(date +%s) + SNOOZE_SECONDS))
  local SNOOZED_FILE="$AGENT_DIR/memory/snoozed.json"
  python3 - <<PYEOF
import json, os
f = '$SNOOZED_FILE'
try:
    data = json.load(open(f))
except:
    data = {}
data['$FINGERPRINT'] = $UNTIL
json.dump(data, open(f, 'w'), indent=2)
PYEOF
  log "💤 Snoozed: $FINGERPRINT for ${SNOOZE_SECONDS}s"
}

send_status_report() {
  local SCAN_JSON="$1"

  # Generate Telegram-formatted status message
  local MESSAGE
  MESSAGE=$(echo "$SCAN_JSON" | python3 "$SCRIPT_DIR/generate_status_report.py" \
    --scan-output - \
    --format telegram \
    --bridge-url "${BRIDGE_URL:-http://127.0.0.1:3001}" 2>/dev/null)

  if [[ -z "$MESSAGE" ]]; then
    log "⚠️  Status report generation failed"
    return
  fi

  # Load bot token from secrets
  if [[ ! -f "$SECRETS_FILE" ]]; then
    log "⚠️  Secrets file not found: $SECRETS_FILE — skipping status report"
    return
  fi
  source "$SECRETS_FILE"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    log "⚠️  Telegram credentials missing — skipping status report"
    return
  fi

  # Send via Telegram Bot API
  RESPONSE=$(curl -s -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
      \"chat_id\": \"${TELEGRAM_CHAT_ID}\",
      \"text\": $(echo "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),
      \"parse_mode\": \"Markdown\"
    }")

  OK=$(echo "$RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("ok","false"))' 2>/dev/null || echo "false")
  if [[ "$OK" == "True" ]] || [[ "$OK" == "true" ]]; then
    log "📱 Status report sent to Telegram"
  else
    log "⚠️  Telegram status report failed: $(echo "$RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("description","unknown error"))' 2>/dev/null)"
  fi
}

format_telegram_message() {
  local KIND="$1"
  local TITLE="$2"
  local DESCRIPTION="$3"
  local PROPOSAL="$4"

  local KIND_EMOJI
  case "$KIND" in
    duplicate)       KIND_EMOJI="🔴 DUPLICATE" ;;
    near_duplicate)  KIND_EMOJI="🟡 NEAR-DUPLICATE" ;;
    empty)           KIND_EMOJI="🟡 THIN SKILL" ;;
    merge_candidate) KIND_EMOJI="🟢 MERGE CANDIDATE" ;;
    *)               KIND_EMOJI="🔵 FINDING" ;;
  esac

  cat <<MSG
🧹 *ADHD Agent*

*${KIND_EMOJI}*
${TITLE}

${DESCRIPTION}

*Proposal:*
${PROPOSAL}

Reply *YES* to proceed, *NO* to skip, *LATER* to snooze 24h.
MSG
}

run_cycle() {
  log "🔍 Starting scan cycle..."

  # Run scanner with registries from config
  SCAN_OUTPUT=$(python3 "$SCRIPT_DIR/scan_skills.py" --json \
    --registries "${SKILL_REGISTRIES[@]}" \
    --exceptions "$AGENT_DIR/config/exceptions.json" 2>/dev/null || echo '{"findings":[]}')
  TOTAL_SKILLS=$(echo "$SCAN_OUTPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total_skills', 0))" 2>/dev/null || echo "?")
  FINDING_COUNT=$(echo "$SCAN_OUTPUT" | python3 -c "import json,sys; print(len([f for f in json.load(sys.stdin).get('findings',[]) if f.get('severity') != 'info']))" 2>/dev/null || echo "0")

  log "📊 Scanned $TOTAL_SKILLS skills — $FINDING_COUNT actionable findings"

  # Always send the status report (every cycle, even if clean)
  if [[ "$DRY_RUN" == "false" ]]; then
    send_status_report "$SCAN_OUTPUT"
  fi

  if [[ "$FINDING_COUNT" -eq 0 ]]; then
    log "✨ No issues found. System is clean."
    return
  fi

  # Load snoozed fingerprints
  SNOOZED=$(load_snoozed)

  # Process findings one at a time — pipe JSON via stdin to avoid quoting issues
  echo "$SCAN_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
findings = data.get('findings', [])
for f in findings:
    print(json.dumps(f))
" | while IFS= read -r FINDING_JSON; do
      [[ -z "$FINDING_JSON" ]] && continue
      FINGERPRINT=$(echo "$FINDING_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['fingerprint'])" 2>/dev/null || continue)
      KIND=$(echo "$FINDING_JSON"        | python3 -c "import json,sys; print(json.load(sys.stdin)['kind'])" 2>/dev/null || continue)
      TITLE=$(echo "$FINDING_JSON"       | python3 -c "import json,sys; print(json.load(sys.stdin)['title'])" 2>/dev/null || continue)
      DESCRIPTION=$(echo "$FINDING_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['description'])" 2>/dev/null || continue)
      PROPOSAL=$(echo "$FINDING_JSON"    | python3 -c "import json,sys; print(json.load(sys.stdin)['proposal'])" 2>/dev/null || continue)

      # Skip if snoozed
      IS_SNOOZED=$(echo "$SNOOZED" | python3 -c "import json,sys; s=json.load(sys.stdin); print('true' if '$FINGERPRINT' in s else 'false')" 2>/dev/null || echo "false")
      if [[ "$IS_SNOOZED" == "true" ]]; then
        log "⏭️  Skipping (snoozed): $FINGERPRINT"
        continue
      fi

      # Skip if already acted on
      if [[ "$(was_acted_on "$FINGERPRINT")" == "true" ]]; then
        log "⏭️  Skipping (already handled): $FINGERPRINT"
        continue
      fi

      log "📬 New finding: $TITLE"

      if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would send: $TITLE → $PROPOSAL"
        continue
      fi

      # ── Rate Limit Merge Candidates to 1 per day ──
      if [[ "$KIND" == "merge_candidate" ]]; then
        LOCAL_TODAY=$(date +%Y-%m-%d)
        LAST_MERGE_FILE="$AGENT_DIR/memory/last_merge.txt"
        LAST_MERGE_DATE=""
        if [[ -f "$LAST_MERGE_FILE" ]]; then
          LAST_MERGE_DATE=$(cat "$LAST_MERGE_FILE")
        fi

        if [[ "$LAST_MERGE_DATE" == "$LOCAL_TODAY" ]]; then
          log "⏭️  Skipping (Rate limited): Already proposed a merge today. ($FINGERPRINT)"
          continue
        else
          echo "$LOCAL_TODAY" > "$LAST_MERGE_FILE"
        fi
      fi

      # Format and send Telegram message
      MESSAGE=$(format_telegram_message "$KIND" "$TITLE" "$DESCRIPTION" "$PROPOSAL")

      if ! bash "$SCRIPT_DIR/telegram_notify.sh" "$MESSAGE" "$FINGERPRINT"; then
        log "⚠️  Failed to send Telegram for: $FINGERPRINT"
        continue
      fi

      # Poll for approval
      if ! DECISION=$(bash "$SCRIPT_DIR/poll_approval.sh" "$FINGERPRINT" "${APPROVAL_TIMEOUT_SECONDS:-600}" 2>/dev/null); then
        DECISION="TIMEOUT"
      fi
      log "📩 Decision for '$FINGERPRINT': $DECISION"

      case "$DECISION" in
        YES)
          log "✅ Approved — executing: $PROPOSAL"
          log_action "APPROVED: $TITLE" "- Finding: $DESCRIPTION" "- Proposal: $PROPOSAL" "- Result: Executed"
          record_action "$FINGERPRINT" "YES" "$PROPOSAL"
          # NOTE: Actual file operations are logged but NOT auto-executed for safety.
          # The agent flags them; Antigravity (this IDE) executes on next session.
          echo "PENDING_EXECUTION:$FINGERPRINT" >> "$AGENT_DIR/memory/approved_actions.txt"
          ;;
        NO)
          log "❌ Rejected — skipping"
          log_action "REJECTED: $TITLE" "- Decision: NO"
          record_action "$FINGERPRINT" "NO" "User declined"
          ;;
        LATER|TIMEOUT)
          snooze_finding "$FINGERPRINT"
          log_action "SNOOZED: $TITLE" "- Reason: $DECISION"
          ;;
      esac
    done

  log "✅ Scan cycle complete."
}

# ─── Main ─────────────────────────────────────────────────────────────────────

log "🧹 ADHD Agent starting (once=$ONCE, dry_run=$DRY_RUN)"

if [[ "$ONCE" == "true" ]]; then
  run_cycle
else
  while true; do
    run_cycle
    log "😴 Sleeping ${SCAN_INTERVAL_SECONDS}s until next cycle..."
    sleep "$SCAN_INTERVAL_SECONDS"
  done
fi
