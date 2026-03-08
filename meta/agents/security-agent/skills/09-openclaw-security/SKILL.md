---
name: openclaw-security
description: Audit OpenClaw browser extension security — tab access scope, CDP connections, and skills with sensitive permissions
---

# Skill: OpenClaw Security Audit

## Purpose
OpenClaw has deep access to the browser — it can read and interact with any tab it's attached to. This skill audits what it can access, what it's actually doing, and whether any skills have permissions they shouldn't.

## What It Checks

### Tab Access
- What tabs is OpenClaw currently attached to?
- Are any sensitive tabs attached (banking, email, personal accounts)?
- Is the CDP (Chrome DevTools Protocol) port open unexpectedly?

### Skills with Sensitive Permissions
- Skills with `Bash(*)` — unrestricted shell access
- Skills with `Bash(op:*)` — 1Password access (especially dangerous)
- Skills with network fetch permissions to external services
- Any skills created or modified in the last 24h

### Gateway Config
- What agent workspaces are registered?
- What paths does each agent have access to?
- Are any agents mapped to sensitive directories?

### Logs
- OpenClaw activity log: any unusual actions, bulk operations, or errors

## Files to Check
```
/Users/raphael/juliaz_agents/openclaw/
├── gateway.yaml          — agent registrations and permissions
├── skills/               — custom skills
├── logs/                 — activity logs
└── HEURISTICS.md         — learned behaviors
```

## Commands
```bash
# Skills with broad permissions
grep -rn "Bash(\*\|op:" /Users/raphael/juliaz_agents/openclaw/skills/ 2>/dev/null

# Check gateway for agent registrations  
cat /Users/raphael/juliaz_agents/openclaw/gateway.yaml 2>/dev/null

# Check for recently modified skills
find /Users/raphael/juliaz_agents/openclaw/skills -name "*.md" -newer /tmp/sentinel-baseline 2>/dev/null

# CDP port check
lsof -iTCP:9222 -n -P 2>/dev/null
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| `Bash(op:*)` in any skill | 🔴 Critical |
| CDP port open and accepting connections | 🟠 High |
| Sensitive tab (bank, email) attached | 🟠 High |
| New skill added with broad permissions | 🟡 Medium |
| Unrecognized agent in gateway.yaml | 🟡 Medium |

## Output Format
```
OPENCLAW SECURITY
Skills:  ⚠️  1 skill has Bash(op:*) — openclaw/skills/email-tools
Gateway: ✅ 2 agents registered (julia, thesis-agent)
CDP:     ✅ not exposed
Tabs:    ✅ no sensitive tabs detected
```
