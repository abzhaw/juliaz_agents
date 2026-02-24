#!/bin/bash

# ============================================================
# Sentinel — Daily Security Report
# Security Agent for juliaz_agents
# Runs at 07:00 every morning via LaunchAgent
# ============================================================

set -euo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/security-agent"
REPORTS_DIR="$AGENT_DIR/reports"
MEMORY_DIR="$AGENT_DIR/memory"
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%Y-%m-%d %H:%M:%S")
REPORT_FILE="$REPORTS_DIR/$TODAY.md"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$REPORTS_DIR" "$MEMORY_DIR"

# Load secrets for Telegram
if [ -f "$PROJECT_DIR/.env.secrets" ]; then
    source <(grep -v '^#' "$PROJECT_DIR/.env.secrets" | sed 's/^/export /')
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Severity counters
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
FINDINGS=""

add_finding() {
    local severity="$1"
    local section="$2"
    local message="$3"
    FINDINGS="${FINDINGS}\n${severity} [${section}] ${message}"
    case "$severity" in
        🔴) CRITICAL=$((CRITICAL+1)) ;;
        🟠) HIGH=$((HIGH+1)) ;;
        🟡) MEDIUM=$((MEDIUM+1)) ;;
        🟢) LOW=$((LOW+1)) ;;
    esac
}

# ── Start Report ──────────────────────────────────────────────────────────────
cat > "$REPORT_FILE" << HEADER
# 🔐 Sentinel — Daily Security Report
**Date:** $TODAY  
**Generated:** $NOW  
**System:** juliaz_agents @ /Users/raphael/juliaz_agents

---

HEADER

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 1: PORT SCAN
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🔌 Port Scan" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

EXPECTED_PORTS=(3000 3001 3002 3003)
PORT_OUTPUT=$(lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null || true)

for port in "${EXPECTED_PORTS[@]}"; do
    if echo "$PORT_OUTPUT" | grep -q ":$port "; then
        echo "- ✅ Port $port — listening (expected)" >> "$REPORT_FILE"
    else
        echo "- ⚠️  Port $port — NOT listening (service may be down)" >> "$REPORT_FILE"
        add_finding "🟡" "port-scan" "Expected port $port is not listening"
    fi
done

# Unknown ports
KNOWN_SYSTEM_PROCS="Electron|Code.Helper|com\.apple|rapportd|ControlCe|AMPLibrary|Google.Chrome.He|CoreAudio|WindowServer"

UNKNOWN_PORTS=$(echo "$PORT_OUTPUT" | awk '{print $9}' | grep -oE ':[0-9]+$' | tr -d ':' | sort -u | \
    while read p; do
        skip=false
        for ep in "${EXPECTED_PORTS[@]}" 5432; do [ "$p" = "$ep" ] && skip=true; done
        [[ "$p" -lt 1024 || "$p" -gt 60000 ]] && skip=true
        $skip || echo "$p"
    done || true)

if [ -n "$UNKNOWN_PORTS" ]; then
    while IFS= read -r port; do
        PROCESS=$(echo "$PORT_OUTPUT" | grep ":$port " | awk '{print $1, $2}' | head -1)
        PROC_NAME=$(echo "$PROCESS" | awk '{print $1}')
        if echo "$PROC_NAME" | grep -qE "$KNOWN_SYSTEM_PROCS"; then
            echo "- ℹ️  Port $port — system process: $PROCESS" >> "$REPORT_FILE"
        else
            echo "- 🟠 Port $port — UNKNOWN listener: $PROCESS" >> "$REPORT_FILE"
            add_finding "🟠" "port-scan" "Unknown port $port open: $PROCESS"
        fi
    done <<< "$UNKNOWN_PORTS"
else
    echo "- ✅ No unexpected ports detected" >> "$REPORT_FILE"
fi

# PostgreSQL exposure check
PG_EXTERNAL=$(echo "$PORT_OUTPUT" | grep ":5432 " | grep -v "127.0.0.1\|localhost" || true)
if [ -n "$PG_EXTERNAL" ]; then
    echo "- 🔴 PostgreSQL port 5432 exposed on all interfaces!" >> "$REPORT_FILE"
    add_finding "🔴" "port-scan" "PostgreSQL externally exposed on 0.0.0.0:5432"
fi

echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 2: NETWORK TRAFFIC AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🌐 Network Traffic" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

KNOWN_DESTINATIONS="openai.com|anthropic.com|telegram.org|gmail.com|google.com|medium.com|docker.com|docker.io|amazonaws.com|cloudflare.com|fastly.com|github.com|localhost|127.0.0.1"
CONNECTIONS=$(lsof -i -n -P 2>/dev/null | grep ESTABLISHED || true)
TOTAL_CONNS=$(echo "$CONNECTIONS" | grep -c "node\|docker" || true)

echo "- 📊 Active outbound connections: $TOTAL_CONNS" >> "$REPORT_FILE"

UNKNOWN_CONNS=$(echo "$CONNECTIONS" | grep "node\|docker" | awk '{print $9}' | \
    grep -v "$KNOWN_DESTINATIONS" | grep -v "^$\|127\.\|::" | head -5 || true)

if [ -n "$UNKNOWN_CONNS" ]; then
    echo "- 🟠 Unknown destinations detected:" >> "$REPORT_FILE"
    echo "$UNKNOWN_CONNS" | while read conn; do
        echo "  - $conn" >> "$REPORT_FILE"
        add_finding "🟠" "network" "Unknown outbound connection: $conn"
    done
else
    echo "- ✅ All connections to known destinations" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 3: CREDENTIAL AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🔑 Credential Audit" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Check .env.secrets permissions
ENV_PERMS=$(stat -f "%OLp" "$PROJECT_DIR/.env.secrets" 2>/dev/null || echo "missing")
if [ "$ENV_PERMS" = "600" ]; then
    echo "- ✅ .env.secrets permissions: 600 (secure)" >> "$REPORT_FILE"
elif [ "$ENV_PERMS" = "missing" ]; then
    echo "- ⚪ .env.secrets: not found (using runtime injection)" >> "$REPORT_FILE"
else
    echo "- 🟠 .env.secrets permissions: $ENV_PERMS (should be 600)" >> "$REPORT_FILE"
    add_finding "🟠" "credentials" ".env.secrets has permissions $ENV_PERMS — should be 600"
fi

# Scan for secret patterns in source files
SECRET_FILES=$(grep -rEl "(sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|password\s*[:=]\s*[\"'][^\"']{6,})" \
    "$PROJECT_DIR" \
    --include="*.ts" --include="*.js" --include="*.sh" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    --exclude-dir=security-agent 2>/dev/null || true)

if [ -n "$SECRET_FILES" ]; then
    echo "- 🔴 Possible secrets in source files:" >> "$REPORT_FILE"
    echo "$SECRET_FILES" | while read f; do
        SHORT="${f#$PROJECT_DIR/}"
        echo "  - $SHORT" >> "$REPORT_FILE"
    done
    add_finding "🔴" "credentials" "Possible secrets hardcoded in source files"
else
    echo "- ✅ No hardcoded secrets found in source files" >> "$REPORT_FILE"
fi

# Check git history for .env commits
ENV_IN_GIT=$(git -C "$PROJECT_DIR" log --all --oneline -- "**/.env" "**/.env.secrets" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ENV_IN_GIT" -gt 0 ]; then
    echo "- 🟠 .env files appear in git history ($ENV_IN_GIT commits)" >> "$REPORT_FILE"
    add_finding "🟠" "credentials" ".env files found in git history — consider purging"
else
    echo "- ✅ No .env files committed to git history" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 4: DEPENDENCY AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## 📦 Dependency Vulnerabilities" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

TOTAL_VULNS=0
for service in orchestrator bridge frontend cowork-mcp backend; do
    SVC_DIR="$PROJECT_DIR/$service"
    if [ -f "$SVC_DIR/package.json" ]; then
        AUDIT=$(npm audit --json --prefix "$SVC_DIR" 2>/dev/null || true)
        CRITICAL_V=$(echo "$AUDIT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('critical',0))" 2>/dev/null || echo 0)
        HIGH_V=$(echo "$AUDIT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('high',0))" 2>/dev/null || echo 0)
        TOTAL_V=$((CRITICAL_V + HIGH_V))
        TOTAL_VULNS=$((TOTAL_VULNS + TOTAL_V))
        if [ "$CRITICAL_V" -gt 0 ]; then
            echo "- 🔴 **$service**: $CRITICAL_V critical, $HIGH_V high CVEs" >> "$REPORT_FILE"
            add_finding "🔴" "dependencies" "$service has $CRITICAL_V critical CVEs"
        elif [ "$HIGH_V" -gt 0 ]; then
            echo "- 🟠 **$service**: $HIGH_V high CVEs" >> "$REPORT_FILE"
            add_finding "🟠" "dependencies" "$service has $HIGH_V high severity CVEs"
        else
            echo "- ✅ **$service**: no critical/high vulnerabilities" >> "$REPORT_FILE"
        fi
    fi
done
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 5: PROCESS AUDIT
# ─────────────────────────────────────────────────────────────────────────────
echo "## ⚙️  Process Audit" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

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

echo "- 📊 PM2 processes: $ONLINE/$TOTAL_PM2 online" >> "$REPORT_FILE"
if [ -n "$ERRORED" ]; then
    echo "- 🟡 Issues detected:" >> "$REPORT_FILE"
    echo "$ERRORED" | while read line; do
        echo "  - $line" >> "$REPORT_FILE"
        add_finding "🟡" "process" "PM2 issue: $line"
    done
else
    echo "- ✅ All PM2 processes healthy" >> "$REPORT_FILE"
fi

DOCKER_RUNNING=$(docker ps --format "{{.Names}}" 2>/dev/null || echo "docker unavailable")
echo "- 🐳 Docker containers: $(echo "$DOCKER_RUNNING" | paste -sd ', ')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 6: LOG ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
echo "## 📋 Log Analysis (last 24h)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Use date for 24h window
YESTERDAY=$(date -v-1d +"%Y-%m-%d" 2>/dev/null || date -d "yesterday" +"%Y-%m-%d" 2>/dev/null || echo "")

for service in orchestrator bridge frontend cowork-mcp; do
    LOG_FILE=$(ls "$HOME/.pm2/logs/${service}-out.log" 2>/dev/null || true)
    if [ -f "$LOG_FILE" ]; then
        if [ -n "$YESTERDAY" ]; then
            ERRORS=$(grep "$TODAY\|$YESTERDAY" "$LOG_FILE" 2>/dev/null | grep -c "ERROR\|FATAL" 2>/dev/null || echo 0)
        else
            # Fallback: count errors in last 1000 lines
            ERRORS=$(tail -1000 "$LOG_FILE" | grep -c "ERROR\|FATAL" 2>/dev/null || echo 0)
        fi
        if [ "$ERRORS" -gt 50 ]; then
            echo "- 🟠 **$service**: $ERRORS errors in log" >> "$REPORT_FILE"
            add_finding "🟠" "logs" "$service log has $ERRORS errors"
        elif [ "$ERRORS" -gt 0 ]; then
            echo "- 🟡 **$service**: $ERRORS errors in log" >> "$REPORT_FILE"
        else
            echo "- ✅ **$service**: clean log" >> "$REPORT_FILE"
        fi
    else
        echo "- ⚪ **$service**: no log file found" >> "$REPORT_FILE"
    fi
done
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 7: DOCKER SECURITY
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🐳 Docker Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if docker info &>/dev/null; then
    # Check for privileged containers
    PRIVILEGED=$(docker inspect $(docker ps -q 2>/dev/null) 2>/dev/null | \
        python3 -c "
import json, sys
cs = json.load(sys.stdin)
for c in cs:
    name = c.get('Name', '?').strip('/')
    if c.get('HostConfig', {}).get('Privileged', False):
        print(f'{name}: PRIVILEGED')
" 2>/dev/null || true)

    if [ -n "$PRIVILEGED" ]; then
        echo "- 🔴 Privileged containers: $PRIVILEGED" >> "$REPORT_FILE"
        add_finding "🔴" "docker" "Privileged container running: $PRIVILEGED"
    else
        echo "- ✅ No privileged containers" >> "$REPORT_FILE"
    fi

    # Check PostgreSQL exposure
    PG_PORT=$(docker ps --format "{{.Ports}}" 2>/dev/null | grep 5432 | grep "0.0.0.0" || true)
    if [ -n "$PG_PORT" ]; then
        echo "- 🔴 PostgreSQL exposed on 0.0.0.0:5432 (all interfaces)" >> "$REPORT_FILE"
        add_finding "🔴" "docker" "PostgreSQL exposed on all interfaces"
    else
        echo "- ✅ PostgreSQL not exposed externally" >> "$REPORT_FILE"
    fi
else
    echo "- ⚪ Docker not running — skipped" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 8: API SECURITY
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🔗 API Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Backend health check
BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$BACKEND_CODE" = "200" ]; then
    echo "- ✅ Backend (3000): responding, health check OK" >> "$REPORT_FILE"
elif [ "$BACKEND_CODE" = "000" ]; then
    echo "- ⚪ Backend (3000): not reachable (service may be down)" >> "$REPORT_FILE"
else
    echo "- 🟡 Backend (3000): returned HTTP $BACKEND_CODE" >> "$REPORT_FILE"
fi

# CORS check
CORS=$(curl -s -I -H "Origin: https://evil-test-sentinel.com" --max-time 3 http://localhost:3000/api/ 2>/dev/null | \
    grep -i "access-control-allow-origin" || true)
if echo "$CORS" | grep -q "\*"; then
    echo "- 🟠 Backend CORS: wildcard (*) — open to all origins" >> "$REPORT_FILE"
    add_finding "🟠" "api" "Backend has CORS wildcard Access-Control-Allow-Origin: *"
elif [ -n "$CORS" ]; then
    echo "- ✅ Backend CORS: restricted ($CORS)" >> "$REPORT_FILE"
else
    echo "- ⚪ Backend CORS: no CORS headers (or service down)" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 9: OPENCLAW SECURITY
# ─────────────────────────────────────────────────────────────────────────────
echo "## 🦞 OpenClaw Security" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

OPENCLAW_DIR="$PROJECT_DIR/openclaw"

# Skills with broad permissions
BROAD_SKILLS=$(grep -rn "Bash(\*)\|Bash(op:" "$OPENCLAW_DIR/skills/" 2>/dev/null | head -5 || true)
if [ -n "$BROAD_SKILLS" ]; then
    echo "- 🔴 Skills with broad shell permissions:" >> "$REPORT_FILE"
    echo "$BROAD_SKILLS" | while read line; do
        echo "  - $line" >> "$REPORT_FILE"
    done
    add_finding "🔴" "openclaw" "Skills with Bash(*) or Bash(op:*) found"
else
    echo "- ✅ No overly permissive skill permissions detected" >> "$REPORT_FILE"
fi

# CDP port
CDP=$(lsof -iTCP:9222 -n -P 2>/dev/null | grep LISTEN || true)
if [ -n "$CDP" ]; then
    echo "- 🟠 CDP port 9222 is open (Chrome DevTools Protocol)" >> "$REPORT_FILE"
    add_finding "🟠" "openclaw" "Chrome DevTools Protocol port 9222 is open"
else
    echo "- ✅ CDP port 9222 not open" >> "$REPORT_FILE"
fi

# Recently modified skills
RECENT_SKILLS=$(find "$OPENCLAW_DIR/skills" -name "*.md" -newer "$AGENT_DIR/memory/baseline.json" 2>/dev/null | head -5 || true)
if [ -n "$RECENT_SKILLS" ]; then
    echo "- 🟡 Skills modified since last baseline:" >> "$REPORT_FILE"
    echo "$RECENT_SKILLS" | while read f; do
        echo "  - ${f#$PROJECT_DIR/}" >> "$REPORT_FILE"
    done
else
    echo "- ✅ No OpenClaw skills modified since last scan" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

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

cat >> "$REPORT_FILE" << SUMMARY

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
    echo "### Action Items" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo -e "$FINDINGS" | grep -v "^$" | nl -w2 -s". " >> "$REPORT_FILE"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SKILL 10: SELF-LEARNING — Update baseline and learnings
# ─────────────────────────────────────────────────────────────────────────────
cat >> "$REPORT_FILE" << LEARNING

---

## 🧠 Self-Learning Update
- Findings today: $TOTAL ($CRITICAL critical, $HIGH high, $MEDIUM medium, $LOW low)
- Baseline updated: $TODAY
- Next scan: tomorrow at 07:00
LEARNING

# Update baseline timestamp
echo '{"last_updated": "'$TODAY'", "scan_count": '$(cat "$MEMORY_DIR/baseline.json" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('scan_count',0)+1)" 2>/dev/null || echo 1)'}' > "$MEMORY_DIR/baseline.json"
touch "$MEMORY_DIR/baseline.json"

# Append to learnings journal
cat >> "$MEMORY_DIR/learnings.md" << JOURNAL

## $TODAY
- Total findings: $TOTAL (🔴$CRITICAL 🟠$HIGH 🟡$MEDIUM 🟢$LOW)
- Status: $OVERALL_STATUS
JOURNAL

# ── Write shared-findings output ─────────────────────────────────────────────
python3 - <<PYEOF
import json, os
from datetime import datetime, timezone

findings_list = []
for line in """$(echo -e "$FINDINGS")""".strip().split("\n"):
    line = line.strip()
    if not line:
        continue
    # Parse: "🔴 [section] message" or "🟠 [section] message"
    parts = line.split(" ", 2)
    if len(parts) < 3:
        continue
    emoji, section_raw, message = parts[0], parts[1], parts[2]
    section = section_raw.strip("[]")
    severity_map = {"🔴": "critical", "🟠": "high", "🟡": "medium", "🟢": "low"}
    severity = severity_map.get(emoji, "info")
    fid = f"sentinel-{section}-{abs(hash(message)) % 10000}"
    findings_list.append({
        "id": fid,
        "severity": severity,
        "category": section,
        "title": message[:100],
        "detail": message,
        "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "related_to": [],
    })

output = {
    "agent": "sentinel",
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "findings": findings_list,
    "healthy": [],
}

shared_path = "/Users/raphael/juliaz_agents/shared-findings/sentinel.json"
os.makedirs(os.path.dirname(shared_path), exist_ok=True)
with open(shared_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"[sentinel] {len(findings_list)} findings → {shared_path}")
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# SEND TELEGRAM SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    if [ "$TOTAL" -eq 0 ]; then
        TG_MSG="🔐 *Sentinel — Daily Report ($TODAY)*

🟢 *ALL CLEAR* — No security findings today.
All services healthy, no credential leaks, no unexpected connections.

_Report saved to security-agent/reports/$TODAY.md_"
    else
        TG_MSG="🔐 *Sentinel — Daily Report ($TODAY)*

*$OVERALL_STATUS*

| Severity | Count |
|---|---|
| 🔴 Critical | $CRITICAL |
| 🟠 High | $HIGH |
| 🟡 Medium | $MEDIUM |

$(echo -e "$FINDINGS" | grep -E "^🔴|^🟠" | head -5)

_Full report: security-agent/reports/$TODAY.md_"
    fi

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${TG_MSG}" \
        -d "parse_mode=Markdown" > /dev/null 2>&1 || true
fi

echo ""
echo "✅ Sentinel report complete: $REPORT_FILE"
echo "   Status: $OVERALL_STATUS ($TOTAL findings)"
