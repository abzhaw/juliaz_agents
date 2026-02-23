---
name: security-scanning
description: Dependency audits, SAST, credential leak detection, and daily scans. Use when building or running Julia's security sentinel or setting up automated security checks.
---

# Security Scanning

## Daily Scan Script Pattern
```bash
#!/bin/bash
LOG="$PROJECT_DIR/security-agent/memory/daily-report.log"
FINDINGS=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# 1. Dependency audit
log "=== npm audit ==="
for dir in backend bridge frontend orchestrator cowork-mcp; do
  result=$(cd "$PROJECT_DIR/$dir" && npm audit --json 2>/dev/null)
  critical=$(echo "$result" | jq '.metadata.vulnerabilities.critical // 0')
  high=$(echo "$result" | jq '.metadata.vulnerabilities.high // 0')
  [ "$critical" -gt 0 ] && { log "🔴 CRITICAL in $dir: $critical"; FINDINGS=$((FINDINGS+1)); }
  [ "$high" -gt 0 ] && log "🟡 HIGH in $dir: $high"
done

# 2. Exposed secrets scan (git history)
log "=== Secret scan ==="
if git -C "$PROJECT_DIR" log --all --oneline -100 | xargs git show | grep -qE '(sk-[a-zA-Z0-9]{20,}|AIza[a-z0-9_-]{35})'; then
  log "🔴 Possible secret in git history!"; FINDINGS=$((FINDINGS+1))
fi

# 3. Open ports check
log "=== Open ports ==="
unexpected=$(netstat -an | grep LISTEN | grep -vE ':(3000|3001|3002|3003|5432|22) ')
[ -n "$unexpected" ] && log "⚠️ Unexpected ports: $unexpected"

# 4. Report
[ "$FINDINGS" -gt 0 ] && notify_raphael "Security scan: $FINDINGS finding(s) — check logs"
log "=== Scan complete. Findings: $FINDINGS ==="
```

## Tools
```bash
npm audit                        # Node.js dependency vulnerabilities
npm audit fix --force            # Auto-fix (test after!)
npx snyk test                    # More detailed scan via Snyk
grep -r "sk-" --include="*.ts"   # Quick secret leak check in source
git log --all -S "sk-"           # Check git history for secrets
```
