#!/bin/bash

# ============================================================
# Sentinel — Daily Security Report v2
# Security Agent for juliaz_agents
# Runs at 07:00 every morning via PM2 cron + once at boot
#
# Intelligence features v2:
#   - Atomic write: builds report in temp file, moves atomically (no duplication)
#   - Known-safe registry: skips macOS system ports, accepted findings
#   - Incident awareness: reads shared-findings to skip known-down services
#   - Real diff: compares today vs yesterday, highlights NEW findings
#   - Self-learning: tracks trends, not just daily counts
# ============================================================

set -euo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/meta/agents/security-agent"
REPORTS_DIR="$AGENT_DIR/reports"
MEMORY_DIR="$AGENT_DIR/memory"
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%Y-%m-%d %H:%M:%S")
REPORT_FILE="$REPORTS_DIR/$TODAY.md"
KNOWN_SAFE_FILE="$MEMORY_DIR/known_safe.json"
SHARED_FINDINGS="$PROJECT_DIR/shared-findings/incidents.json"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── BUG FIX: Atomic write — use temp file, move at end ──────────────────────
# This prevents duplicate sections when script runs twice on same day
TEMP_REPORT=$(mktemp /tmp/sentinel_report.XXXXXX.md)
trap 'rm -f "$TEMP_REPORT"' EXIT

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$REPORTS_DIR" "$MEMORY_DIR"

# Load secrets for Telegram
if [ -f "$PROJECT_DIR/.env.secrets" ]; then
    source <(grep -v '^#' "$PROJECT_DIR/.env.secrets" | sed 's/^/export /')
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-8519931474}"

# ── Initialize known-safe registry if not exists ─────────────────────────────
if [ ! -f "$KNOWN_SAFE_FILE" ]; then
    cat > "$KNOWN_SAFE_FILE" << 'KNOWNSAFE'
{
  "_comment": "Known-safe findings that Sentinel should not flag as issues. Edit this file to suppress false positives.",
  "safe_ports": {
    "5000": {"process": "ControlCenter", "reason": "macOS AirPlay Receiver (System Settings > General > AirDrop & Handoff)"},
    "7000": {"process": "ControlCenter", "reason": "macOS AirPlay Receiver (System Settings > General > AirDrop & Handoff)"},
    "49152": {"process": "rapportd", "reason": "macOS Rapport daemon (Continuity/Handoff between Apple devices)"},
    "49153": {"process": "rapportd", "reason": "macOS Rapport daemon (alternative port)"},
    "631": {"process": "cupsd", "reason": "macOS CUPS print server (local only)"}
  },
  "safe_files": {
    ".agent/skills/playwright-skill/lib/helpers.js": "Contains example password patterns for form-fill testing, not real credentials",
    ".worktrees/ambient-redesign/.agent/skills/playwright-skill/lib/helpers.js": "Worktree copy of same"
  },
  "last_updated": "2026-03-08"
}
KNOWNSAFE
fi

# ── Load known-safe data ─────────────────────────────────────────────────────
SAFE_PORTS=$(python3 -c "
import json
try:
    data = json.load(open('$KNOWN_SAFE_FILE'))
    print(' '.join(data.get('safe_ports', {}).keys()))
except: print('')
" 2>/dev/null || echo "")

SAFE_FILES=$(python3 -c "
import json
try:
    data = json.load(open('$KNOWN_SAFE_FILE'))
    print('\n'.join(data.get('safe_files', {}).keys()))
except: print('')
" 2>/dev/null || echo "")

# ── Load active incidents from Health Checker ────────────────────────────────
ACTIVE_INCIDENTS=$(python3 -c "
import json
try:
    data = json.load(open('$SHARED_FINDINGS'))
    groups = set()
    for fp, inc in data.get('incidents', {}).items():
        groups.add(inc.get('group', ''))
    print(' '.join(groups))
except: print('')
" 2>/dev/null || echo "")

# ── Load yesterday's findings for diff ───────────────────────────────────────
YESTERDAY=$(date -v-1d +"%Y-%m-%d" 2>/dev/null || date -d "yesterday" +"%Y-%m-%d" 2>/dev/null || echo "")
YESTERDAY_FINDINGS=""
if [ -n "$YESTERDAY" ] && [ -f "$REPORTS_DIR/$YESTERDAY.md" ]; then
    YESTERDAY_FINDINGS=$(grep "^\s*[0-9]*\." "$REPORTS_DIR/$YESTERDAY.md" 2>/dev/null || true)
fi

# Severity counters
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
FINDINGS=""
NEW_FINDINGS=""

add_finding() {
    local severity="$1"
    local section="$2"
    local message="$3"
    local fingerprint="${section}::${message}"
    FINDINGS="${FINDINGS}\n${severity} [${section}] ${message}"
    case "$severity" in
        🔴) CRITICAL=$((CRITICAL+1)) ;;
        🟠) HIGH=$((HIGH+1)) ;;
        🟡) MEDIUM=$((MEDIUM+1)) ;;
        🟢) LOW=$((LOW+1)) ;;
    esac
    # Check if this is NEW (not in yesterday's report)
    if [ -n "$YESTERDAY_FINDINGS" ]; then
        if ! echo "$YESTERDAY_FINDINGS" | grep -qF "$message"; then
            NEW_FINDINGS="${NEW_FINDINGS}\n🆕 ${severity} [${section}] ${message}"
        fi
    else
        NEW_FINDINGS="${NEW_FINDINGS}\n🆕 ${severity} [${section}] ${message}"
    fi
}

is_safe_port() {
    local port="$1"
    echo "$SAFE_PORTS" | tr ' ' '\n' | grep -qx "$port" 2>/dev/null
}

is_safe_file() {
    local filepath="$1"
    echo "$SAFE_FILES" | grep -qF "$filepath" 2>/dev/null
}

is_known_down() {
    local group="$1"
    echo "$ACTIVE_INCIDENTS" | tr ' ' '\n' | grep -qx "$group" 2>/dev/null
}

# ── Start Report ──────────────────────────────────────────────────────────────
cat > "$TEMP_REPORT" << HEADER
# 🔐 Sentinel — Daily Security Report
**Date:** $TODAY
**Generated:** $NOW
**System:** juliaz_agents @ /Users/raphael/juliaz_agents

---

HEADER

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 1: PORT SCAN
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🔌 Port Scan" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

EXPECTED_PORTS=(3000 3001 3002 3003)
PORT_OUTPUT=$(lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null || true)

for port in "${EXPECTED_PORTS[@]}"; do
    if echo "$PORT_OUTPUT" | grep -q ":$port "; then
        echo "- ✅ Port $port — listening (expected)" >> "$TEMP_REPORT"
    else
        # Check if this service is known-down via Health Checker
        case "$port" in
            3000) group="backend" ;;
            3001) group="bridge" ;;
            3002) group="frontend" ;;
            3003) group="cowork-mcp" ;;
            *) group="" ;;
        esac
        if is_known_down "$group"; then
            echo "- ⚪ Port $port — NOT listening (known incident — Health Checker tracking)" >> "$TEMP_REPORT"
        else
            echo "- ⚠️  Port $port — NOT listening (service may be down)" >> "$TEMP_REPORT"
            add_finding "🟡" "port-scan" "Expected port $port is not listening"
        fi
    fi
done

# Unknown ports — now with known-safe filtering
UNKNOWN_PORTS=$(echo "$PORT_OUTPUT" | awk '{print $9}' | grep -oE ':[0-9]+$' | tr -d ':' | sort -u | \
    while read p; do
        skip=false
        for ep in "${EXPECTED_PORTS[@]}" 5432; do [ "$p" = "$ep" ] && skip=true; done
        [[ "$p" -lt 1024 || "$p" -gt 60000 ]] && skip=true
        is_safe_port "$p" && skip=true
        $skip || echo "$p"
    done || true)

if [ -n "$UNKNOWN_PORTS" ]; then
    while IFS= read -r port; do
        [ -z "$port" ] && continue
        PROCESS=$(echo "$PORT_OUTPUT" | grep ":$port " | awk '{print $1, $2}' | head -1)
        echo "- 🟠 Port $port — UNKNOWN listener: $PROCESS" >> "$TEMP_REPORT"
        add_finding "🟠" "port-scan" "Unknown port $port open: $PROCESS"
    done <<< "$UNKNOWN_PORTS"
else
    echo "- ✅ No unexpected ports detected" >> "$TEMP_REPORT"
fi

# Show known-safe ports (for transparency)
SAFE_LISTENING=""
for port in $SAFE_PORTS; do
    if echo "$PORT_OUTPUT" | grep -q ":$port "; then
        REASON=$(python3 -c "import json; d=json.load(open('$KNOWN_SAFE_FILE')); print(d['safe_ports']['$port']['reason'])" 2>/dev/null || echo "known safe")
        SAFE_LISTENING="${SAFE_LISTENING}  - Port $port — known safe ($REASON)\n"
    fi
done
if [ -n "$SAFE_LISTENING" ]; then
    echo "" >> "$TEMP_REPORT"
    echo "Known-safe ports (suppressed):" >> "$TEMP_REPORT"
    echo -e "$SAFE_LISTENING" >> "$TEMP_REPORT"
fi

# PostgreSQL exposure check
PG_EXTERNAL=$(echo "$PORT_OUTPUT" | grep ":5432 " | grep -v "127.0.0.1\|localhost" || true)
if [ -n "$PG_EXTERNAL" ]; then
    echo "- 🔴 PostgreSQL port 5432 exposed on all interfaces!" >> "$TEMP_REPORT"
    add_finding "🔴" "port-scan" "PostgreSQL externally exposed on 0.0.0.0:5432"
fi

echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 2: NETWORK TRAFFIC AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🌐 Network Traffic" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

KNOWN_DESTINATIONS="openai.com|anthropic.com|telegram.org|gmail.com|google.com|medium.com|docker.com|docker.io|amazonaws.com|cloudflare.com|fastly.com|github.com|localhost|127.0.0.1|apple.com|icloud.com|aaplimg.com|mzstatic.com|cdn-apple.com"
CONNECTIONS=$(lsof -i -n -P 2>/dev/null | grep ESTABLISHED || true)
TOTAL_CONNS=$(echo "$CONNECTIONS" | grep -c "node\|docker" || true)

echo "- 📊 Active outbound connections: $TOTAL_CONNS" >> "$TEMP_REPORT"

UNKNOWN_CONNS=$(echo "$CONNECTIONS" | grep "node\|docker" | awk '{print $9}' | \
    grep -v "$KNOWN_DESTINATIONS" | grep -v "^$\|127\.\|::" | head -5 || true)

if [ -n "$UNKNOWN_CONNS" ]; then
    echo "- 🟠 Unknown destinations detected:" >> "$TEMP_REPORT"
    echo "$UNKNOWN_CONNS" | while read conn; do
        echo "  - $conn" >> "$TEMP_REPORT"
        add_finding "🟠" "network" "Unknown outbound connection: $conn"
    done
else
    echo "- ✅ All connections to known destinations" >> "$TEMP_REPORT"
fi
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 3: CREDENTIAL AUDIT (with known-safe file filtering)
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🔑 Credential Audit" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

ENV_PERMS=$(stat -f "%OLp" "$PROJECT_DIR/.env.secrets" 2>/dev/null || echo "missing")
if [ "$ENV_PERMS" = "600" ]; then
    echo "- ✅ .env.secrets permissions: 600 (secure)" >> "$TEMP_REPORT"
elif [ "$ENV_PERMS" = "missing" ]; then
    echo "- ⚪ .env.secrets: not found (using runtime injection)" >> "$TEMP_REPORT"
else
    echo "- 🟠 .env.secrets permissions: $ENV_PERMS (should be 600)" >> "$TEMP_REPORT"
    add_finding "🟠" "credentials" ".env.secrets has permissions $ENV_PERMS — should be 600"
fi

# Scan for secret patterns — filter out known-safe files
SECRET_FILES=$(grep -rEl "(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|password\s*[:=]\s*[\"'][^\"']{6,})" \
    "$PROJECT_DIR" \
    --include="*.ts" --include="*.js" --include="*.sh" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    --exclude-dir=security-agent --exclude-dir=.worktrees 2>/dev/null || true)

# Filter out known-safe files
REAL_SECRET_FILES=""
if [ -n "$SECRET_FILES" ]; then
    while IFS= read -r f; do
        SHORT="${f#$PROJECT_DIR/}"
        if ! is_safe_file "$SHORT"; then
            REAL_SECRET_FILES="${REAL_SECRET_FILES}${SHORT}\n"
        fi
    done <<< "$SECRET_FILES"
fi

if [ -n "$REAL_SECRET_FILES" ]; then
    echo "- 🔴 Possible secrets in source files:" >> "$TEMP_REPORT"
    echo -e "$REAL_SECRET_FILES" | while read f; do
        [ -z "$f" ] && continue
        echo "  - $f" >> "$TEMP_REPORT"
    done
    add_finding "🔴" "credentials" "Possible secrets hardcoded in source files"
else
    echo "- ✅ No hardcoded secrets found in source files" >> "$TEMP_REPORT"
    if [ -n "$SECRET_FILES" ]; then
        SUPPRESSED_COUNT=$(echo "$SECRET_FILES" | wc -l | tr -d ' ')
        echo "  (${SUPPRESSED_COUNT} known-safe files suppressed)" >> "$TEMP_REPORT"
    fi
fi

ENV_IN_GIT=$(git -C "$PROJECT_DIR" log --all --oneline -- "**/.env" "**/.env.secrets" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ENV_IN_GIT" -gt 0 ]; then
    echo "- 🟠 .env files appear in git history ($ENV_IN_GIT commits)" >> "$TEMP_REPORT"
    add_finding "🟠" "credentials" ".env files found in git history — consider purging"
else
    echo "- ✅ No .env files committed to git history" >> "$TEMP_REPORT"
fi
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 4: DEPENDENCY AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## 📦 Dependency Vulnerabilities" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

TOTAL_VULNS=0
for service in orchestrator bridge frontend cowork-mcp backend; do
    SVC_DIR="$PROJECT_DIR/julia/$service"
    if [ -f "$SVC_DIR/package.json" ]; then
        AUDIT=$(npm audit --json --prefix "$SVC_DIR" 2>/dev/null || true)
        CRITICAL_V=$(echo "$AUDIT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('critical',0))" 2>/dev/null || echo 0)
        HIGH_V=$(echo "$AUDIT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('high',0))" 2>/dev/null || echo 0)
        TOTAL_V=$((CRITICAL_V + HIGH_V))
        TOTAL_VULNS=$((TOTAL_VULNS + TOTAL_V))
        if [ "$CRITICAL_V" -gt 0 ]; then
            echo "- 🔴 **$service**: $CRITICAL_V critical, $HIGH_V high CVEs" >> "$TEMP_REPORT"
            add_finding "🔴" "dependencies" "$service has $CRITICAL_V critical CVEs"
        elif [ "$HIGH_V" -gt 0 ]; then
            echo "- 🟠 **$service**: $HIGH_V high CVEs" >> "$TEMP_REPORT"
            add_finding "🟠" "dependencies" "$service has $HIGH_V high severity CVEs"
        else
            echo "- ✅ **$service**: no critical/high vulnerabilities" >> "$TEMP_REPORT"
        fi
    fi
done
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 5: PROCESS AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## ⚙️  Process Audit" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

PM2_STATUS=$(pm2 jlist 2>/dev/null || echo "[]")
ONLINE=$(echo "$PM2_STATUS" | python3 -c "import json,sys; ps=json.load(sys.stdin); print(sum(1 for p in ps if p.get('pm2_env',{}).get('status')=='online'))" 2>/dev/null || echo 0)
TOTAL_PM2=$(echo "$PM2_STATUS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
ERRORED=$(echo "$PM2_STATUS" | python3 -c "
import json, sys
ps = json.load(sys.stdin)
for p in ps:
    env = p.get('pm2_env', {})
    restarts = env.get('restart_time', 0)
    name = env.get('name', '?')
    status = env.get('status', '?')
    if status != 'online' or restarts > 5:
        print(f'{name}: status={status}, restarts={restarts}')
" 2>/dev/null || true)

echo "- 📊 PM2 processes: $ONLINE/$TOTAL_PM2 online" >> "$TEMP_REPORT"
if [ -n "$ERRORED" ]; then
    echo "- 🟡 Issues detected:" >> "$TEMP_REPORT"
    echo "$ERRORED" | while read line; do
        echo "  - $line" >> "$TEMP_REPORT"
        add_finding "🟡" "process" "PM2 issue: $line"
    done
else
    echo "- ✅ All PM2 processes healthy" >> "$TEMP_REPORT"
fi

DOCKER_RUNNING=$(docker ps --format "{{.Names}}" 2>/dev/null || echo "docker unavailable")
echo "- 🐳 Docker containers: $(echo "$DOCKER_RUNNING" | paste -sd ', ')" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 6: LOG ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
echo "## 📋 Log Analysis (last 24h)" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

for service in orchestrator bridge frontend cowork-mcp; do
    SVC_LOG="$HOME/.pm2/logs/${service}-out.log"
    if [ -f "$SVC_LOG" ]; then
        ERRORS=$(grep -c "ERROR\|FATAL\|error\|Error" "$SVC_LOG" 2>/dev/null || echo 0)
        if [ "$ERRORS" -gt 50 ]; then
            echo "- 🟠 **$service**: $ERRORS errors in log" >> "$TEMP_REPORT"
            add_finding "🟠" "logs" "$service log has $ERRORS errors"
        elif [ "$ERRORS" -gt 0 ]; then
            echo "- 🟡 **$service**: $ERRORS errors in log" >> "$TEMP_REPORT"
        else
            echo "- ✅ **$service**: clean log" >> "$TEMP_REPORT"
        fi
    else
        echo "- ⚪ **$service**: no log file found" >> "$TEMP_REPORT"
    fi
done
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 7: DOCKER SECURITY
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🐳 Docker Security" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

if docker info &>/dev/null; then
    RUNNING_IDS=$(docker ps -q 2>/dev/null)
    if [ -n "$RUNNING_IDS" ]; then
        PRIVILEGED=$(docker inspect $RUNNING_IDS 2>/dev/null | \
            python3 -c "
import json, sys
cs = json.load(sys.stdin)
for c in cs:
    name = c.get('Name', '?').strip('/')
    if c.get('HostConfig', {}).get('Privileged', False):
        print(f'{name}: PRIVILEGED')
" 2>/dev/null || true)

        if [ -n "$PRIVILEGED" ]; then
            echo "- 🔴 Privileged containers: $PRIVILEGED" >> "$TEMP_REPORT"
            add_finding "🔴" "docker" "Privileged container running: $PRIVILEGED"
        else
            echo "- ✅ No privileged containers" >> "$TEMP_REPORT"
        fi
    else
        echo "- ⚪ No running containers to inspect" >> "$TEMP_REPORT"
    fi

    PG_PORT=$(docker ps --format "{{.Ports}}" 2>/dev/null | grep 5432 | grep "0.0.0.0" || true)
    if [ -n "$PG_PORT" ]; then
        echo "- 🔴 PostgreSQL exposed on 0.0.0.0:5432 (all interfaces)" >> "$TEMP_REPORT"
        add_finding "🔴" "docker" "PostgreSQL exposed on all interfaces"
    else
        echo "- ✅ PostgreSQL not exposed externally" >> "$TEMP_REPORT"
    fi
else
    echo "- ⚪ Docker not running — skipped" >> "$TEMP_REPORT"
fi
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 8: API SECURITY
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🔗 API Security" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$BACKEND_CODE" = "200" ]; then
    echo "- ✅ Backend (3000): responding, health check OK" >> "$TEMP_REPORT"
elif is_known_down "backend"; then
    echo "- ⚪ Backend (3000): not reachable (known incident — Health Checker tracking)" >> "$TEMP_REPORT"
elif [ "$BACKEND_CODE" = "000" ]; then
    echo "- ⚪ Backend (3000): not reachable (service may be down)" >> "$TEMP_REPORT"
else
    echo "- 🟡 Backend (3000): returned HTTP $BACKEND_CODE" >> "$TEMP_REPORT"
fi

CORS=$(curl -s -I -H "Origin: https://evil-test-sentinel.com" --max-time 3 http://localhost:3000/api/ 2>/dev/null | \
    grep -i "access-control-allow-origin" || true)
if echo "$CORS" | grep -q "\*"; then
    echo "- 🟠 Backend CORS: wildcard (*) — open to all origins" >> "$TEMP_REPORT"
    add_finding "🟠" "api" "Backend has CORS wildcard Access-Control-Allow-Origin: *"
elif [ -n "$CORS" ]; then
    echo "- ✅ Backend CORS: restricted ($CORS)" >> "$TEMP_REPORT"
else
    echo "- ⚪ Backend CORS: no CORS headers (or service down)" >> "$TEMP_REPORT"
fi
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 9: OPENCLAW SECURITY
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🦞 OpenClaw Security" >> "$TEMP_REPORT"
echo "" >> "$TEMP_REPORT"

OPENCLAW_DIR="$PROJECT_DIR/julia/openclaw"

BROAD_SKILLS=$(grep -rn "Bash(\*)\|Bash(op:" "$OPENCLAW_DIR/skills/" 2>/dev/null | head -5 || true)
if [ -n "$BROAD_SKILLS" ]; then
    echo "- 🔴 Skills with broad shell permissions:" >> "$TEMP_REPORT"
    echo "$BROAD_SKILLS" | while read line; do
        echo "  - $line" >> "$TEMP_REPORT"
    done
    add_finding "🔴" "openclaw" "Skills with Bash(*) or Bash(op:*) found"
else
    echo "- ✅ No overly permissive skill permissions detected" >> "$TEMP_REPORT"
fi

CDP=$(lsof -iTCP:9222 -n -P 2>/dev/null | grep LISTEN || true)
if [ -n "$CDP" ]; then
    echo "- 🟠 CDP port 9222 is open (Chrome DevTools Protocol)" >> "$TEMP_REPORT"
    add_finding "🟠" "openclaw" "Chrome DevTools Protocol port 9222 is open"
else
    echo "- ✅ CDP port 9222 not open" >> "$TEMP_REPORT"
fi

RECENT_SKILLS=$(find "$OPENCLAW_DIR/skills" -name "*.md" -newer "$AGENT_DIR/memory/baseline.json" 2>/dev/null | head -5 || true)
if [ -n "$RECENT_SKILLS" ]; then
    echo "- 🟡 Skills modified since last baseline:" >> "$TEMP_REPORT"
    echo "$RECENT_SKILLS" | while read f; do
        echo "  - ${f#$PROJECT_DIR/}" >> "$TEMP_REPORT"
    done
else
    echo "- ✅ No OpenClaw skills modified since last scan" >> "$TEMP_REPORT"
fi
echo "" >> "$TEMP_REPORT"

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY SECTION
# ─────────────────────────────────────────────────────────────────────────────
TOTAL=$((CRITICAL + HIGH + MEDIUM + LOW))

if [ "$CRITICAL" -gt 0 ]; then
    OVERALL_STATUS="🔴 CRITICAL ACTION REQUIRED"
elif [ "$HIGH" -gt 0 ]; then
    OVERALL_STATUS="🟠 ATTENTION NEEDED"
elif [ "$MEDIUM" -gt 0 ]; then
    OVERALL_STATUS="🟡 REVIEW RECOMMENDED"
else
    OVERALL_STATUS="🟢 ALL CLEAR"
fi

cat >> "$TEMP_REPORT" << SUMMARY

---

## 📊 Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | $CRITICAL |
| 🟠 High | $HIGH |
| 🟡 Medium | $MEDIUM |
| 🟢 Low | $LOW |
| **Total** | **$TOTAL** |

**Overall Status: $OVERALL_STATUS**

SUMMARY

if [ -n "$FINDINGS" ]; then
    echo "### Action Items" >> "$TEMP_REPORT"
    echo "" >> "$TEMP_REPORT"
    echo -e "$FINDINGS" | grep -v "^$" | nl -w2 -s". " >> "$TEMP_REPORT"
fi

# Show NEW findings (not seen yesterday)
if [ -n "$NEW_FINDINGS" ] && [ -n "$YESTERDAY_FINDINGS" ]; then
    echo "" >> "$TEMP_REPORT"
    echo "### 🆕 New Since Yesterday" >> "$TEMP_REPORT"
    echo "" >> "$TEMP_REPORT"
    echo -e "$NEW_FINDINGS" | grep -v "^$" >> "$TEMP_REPORT"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 10: SELF-LEARNING — Real trend tracking
# ─────────────────────────────────────────────────────────────────────────────

# Update baseline with real data
python3 - "$MEMORY_DIR/baseline.json" "$MEMORY_DIR/learnings.md" "$TODAY" "$TOTAL" "$CRITICAL" "$HIGH" "$MEDIUM" "$LOW" "$OVERALL_STATUS" <<'PYEOF'
import json, sys, os
from datetime import datetime

baseline_file = sys.argv[1]
learnings_file = sys.argv[2]
today = sys.argv[3]
total = int(sys.argv[4])
critical = int(sys.argv[5])
high = int(sys.argv[6])
medium = int(sys.argv[7])
low = int(sys.argv[8])
status = sys.argv[9]

# Load existing baseline
try:
    with open(baseline_file) as f:
        baseline = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    baseline = {"scan_count": 0, "history": []}

# Update baseline with trend data
baseline["last_updated"] = today
baseline["scan_count"] = baseline.get("scan_count", 0) + 1
baseline.setdefault("history", [])

# Only add one entry per day (prevents duplicate learnings)
if not baseline["history"] or baseline["history"][-1].get("date") != today:
    baseline["history"].append({
        "date": today,
        "total": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "status": status,
    })
    # Keep last 30 days
    baseline["history"] = baseline["history"][-30:]

    # Calculate trend
    if len(baseline["history"]) >= 2:
        prev = baseline["history"][-2]["total"]
        if total < prev:
            baseline["trend"] = f"improving ({prev} → {total})"
        elif total > prev:
            baseline["trend"] = f"degrading ({prev} → {total})"
        else:
            baseline["trend"] = "stable"
    else:
        baseline["trend"] = "insufficient data"
else:
    # Same day — update in place
    baseline["history"][-1] = {
        "date": today,
        "total": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "status": status,
    }

with open(baseline_file, "w") as f:
    json.dump(baseline, f, indent=2)

# Append to learnings journal — only once per day
try:
    existing = open(learnings_file).read()
except FileNotFoundError:
    existing = ""

day_header = f"## {today}"
if day_header not in existing:
    trend_str = baseline.get("trend", "unknown")
    with open(learnings_file, "a") as f:
        f.write(f"\n{day_header}\n")
        f.write(f"- Total findings: {total} (🔴{critical} 🟠{high} 🟡{medium} 🟢{low})\n")
        f.write(f"- Status: {status}\n")
        f.write(f"- Trend: {trend_str}\n")
        f.write(f"- Scan #{baseline['scan_count']}\n")
PYEOF

# Add self-learning section to report
TREND=$(python3 -c "import json; d=json.load(open('$MEMORY_DIR/baseline.json')); print(d.get('trend', 'unknown'))" 2>/dev/null || echo "unknown")
SCAN_COUNT=$(python3 -c "import json; d=json.load(open('$MEMORY_DIR/baseline.json')); print(d.get('scan_count', '?'))" 2>/dev/null || echo "?")

cat >> "$TEMP_REPORT" << LEARNING

---

## 🧠 Self-Learning Update
- Findings today: $TOTAL ($CRITICAL critical, $HIGH high, $MEDIUM medium, $LOW low)
- Trend: $TREND
- Scan #: $SCAN_COUNT
- Baseline updated: $TODAY
- Next scan: tomorrow at 07:00
LEARNING

# ── Atomic write: move temp → final ──────────────────────────────────────────
mv "$TEMP_REPORT" "$REPORT_FILE"
trap - EXIT  # Clear the cleanup trap since we moved the file

# ─────────────────────────────────────────────────────────────────────────────
# SEND TELEGRAM SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    if [ "$TOTAL" -eq 0 ]; then
        TG_MSG="🔐 *Sentinel — Daily Report ($TODAY)*

🟢 *ALL CLEAR* — No security findings today.
Trend: $TREND (scan #$SCAN_COUNT)

_Report saved to security-agent/reports/$TODAY.md_"
    else
        # Build concise Telegram message with NEW findings highlighted
        NEW_COUNT=$(echo -e "$NEW_FINDINGS" | grep -c "🆕" || true)
        TG_MSG="🔐 *Sentinel — Daily Report ($TODAY)*

*$OVERALL_STATUS*
Trend: $TREND

| Severity | Count |
|---|---|
| 🔴 Critical | $CRITICAL |
| 🟠 High | $HIGH |
| 🟡 Medium | $MEDIUM |

$(echo -e "$FINDINGS" | grep -E "^🔴|^🟠" | head -5)"

        if [ "$NEW_COUNT" -gt 0 ]; then
            TG_MSG="${TG_MSG}

🆕 *$NEW_COUNT new finding(s)* since yesterday"
        fi

        TG_MSG="${TG_MSG}

_Full report: security-agent/reports/$TODAY.md_"
    fi

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${TG_MSG}" \
        -d "parse_mode=Markdown" > /dev/null 2>&1 || true
fi

echo ""
echo "✅ Sentinel report complete: $REPORT_FILE"
echo "   Status: $OVERALL_STATUS ($TOTAL findings, trend: $TREND)"
