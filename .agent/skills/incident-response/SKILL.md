---
name: incident-response
description: Security incident handling, escalation, auto-quarantine patterns. Use when Julia's security sentinel detects a critical finding or when designing incident workflows.
---

# Incident Response

## Severity Levels
| Level | Examples | Response |
|-------|---------|---------|
| 🟢 **Info** | New dependency version available | Log only |
| 🟡 **Medium** | npm audit high severity | Notify Raphael next morning |
| 🔴 **High** | Critical CVE in prod dependency | Immediate Telegram alert |
| 🚨 **Critical** | Secret leaked in git, active exploit | Immediate + auto-remediation |

## Incident Response Checklist
```
1. DETECT   — sentinel finds issue, logs with timestamp
2. ASSESS   — determine severity level
3. NOTIFY   — alert Raphael via Telegram (if high+)
4. CONTAIN  — if critical: auto-quarantine (stop service, rotate key)
5. FIX      — apply patch, update deps, rotate credentials
6. VERIFY   — re-run scan to confirm issue resolved
7. DOCUMENT — update memory/incidents.log with full timeline
```

## Auto-Quarantine Pattern (for leaked secrets)
```bash
# Immediately rotate and stop the affected service
rotate_secret() {
  local service=$1
  echo "$(date) CRITICAL: Rotating secret for $service" >> incidents.log
  pm2 stop "$service"                    # stop immediately
  notify_raphael "🚨 CRITICAL: Rotating $service credentials NOW"
  # Human must supply new credentials and restart
}
```

## Post-Incident Log Format
```
[2026-02-23 07:45:00] INCIDENT-001
  Severity: HIGH
  Finding: npm audit — critical CVE in express@4.18.0
  Impact: bridge, cowork-mcp potentially vulnerable
  Action: npm audit fix, redeployed both services
  Resolved: [2026-02-23 08:10:00]
  Prevention: Add npm audit to CI and weekly cron
```
