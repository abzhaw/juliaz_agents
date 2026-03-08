---
name: network-traffic-audit
description: Monitor active outbound connections from all services and flag unexpected destinations
---

# Skill: Network Traffic Audit

## Purpose
Know exactly what this machine is talking to. Every outbound connection is either expected or suspicious. This skill makes that list visible every day.

## What It Checks
- All active outbound connections from juliaz_agents processes
- Foreign IPs/domains vs. the known-good allowlist
- Any connection to unexpected countries or IP ranges
- WebSocket connections from the bridge
- OpenClaw's remote connections (if active)

## Known-Good Destinations
```
api.openai.com         — Julia's AI model
api.anthropic.com      — Cowork MCP (Claude)
api.telegram.org       — Telegram bot
smtp.gmail.com / imap.gmail.com — Email tools
medium.com             — Julia medium agent
*.docker.com           — Docker Hub pulls
localhost / 127.0.0.1  — Internal only
```

## Commands
```bash
# Active outbound connections
lsof -i -n -P | grep ESTABLISHED

# DNS lookups (recent)
log show --predicate 'process == "mDNSResponder"' --last 1h 2>/dev/null | grep -i "query\|answer" | tail -50
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| Connection to unknown IP | 🟠 High |
| Process making unexpected external call | 🟠 High |
| High volume of outbound requests | 🟡 Medium |
| Known-good connection | ⚪ Info |

## Output Format
```
NETWORK AUDIT
✅ openai.com — orchestrator (expected)
✅ telegram.org — orchestrator (expected)
⚠️  Unknown: 185.220.101.x — process: node (PID 4521)
```
