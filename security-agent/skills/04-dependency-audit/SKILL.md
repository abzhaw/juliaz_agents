---
name: dependency-audit
description: Scan all npm packages across all services for known CVEs and outdated critical packages
---

# Skill: Dependency Audit

## Purpose
Third-party npm packages are the #1 supply-chain attack vector. This skill runs `npm audit` across every service and flags anything with a known CVE.

## Services to Scan
- `orchestrator/`
- `bridge/`
- `frontend/`
- `cowork-mcp/`
- `backend/`

## What It Checks
- Known CVEs in installed packages (`npm audit --json`)
- Severity: critical, high, moderate, low
- Direct vs. transitive dependencies
- Packages with no recent updates (>2 years stale)

## Commands
```bash
# Run audit across all services
for service in orchestrator bridge frontend cowork-mcp backend; do
  echo "=== $service ===" 
  npm audit --json --prefix /Users/raphael/juliaz_agents/$service 2>/dev/null \
    | python3 -c "
import json, sys
d = json.load(sys.stdin)
vulns = d.get('vulnerabilities', {})
for name, info in vulns.items():
    sev = info.get('severity', 'unknown')
    print(f'  [{sev.upper()}] {name}: {info.get(\"title\",\"\")}')
"
done
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| Critical CVE in direct dependency | 🔴 Critical |
| High CVE in direct dependency | 🟠 High |
| Critical/High in transitive dep | 🟡 Medium |
| Moderate/Low CVE | 🟢 Low |
| Package >2 years without update | 🟢 Low |

## Output Format
```
DEPENDENCY AUDIT
orchestrator: ✅ 0 vulnerabilities
bridge:       ⚠️  1 HIGH — axios: SSRF via redirect (CVE-2023-45857)
frontend:     ✅ 0 vulnerabilities
backend:      🔴 1 CRITICAL — lodash: prototype pollution (CVE-2021-23337)
cowork-mcp:   ✅ 0 vulnerabilities
```
