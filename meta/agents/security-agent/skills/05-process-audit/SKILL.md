---
name: process-audit
description: Check all running processes on the system for anomalies, unknown services, and resource abuse
---

# Skill: Process Audit

## Purpose
Know exactly what is running on this machine. Any unexpected process — whether malware, a crashed service restarting in a loop, or a forgotten dev server — shows up here.

## What It Checks
- All processes owned by `raphael`
- PM2-managed processes (expected: frontend, bridge, orchestrator, cowork-mcp, backend-docker)
- Docker containers (expected: postgres, backend-api)
- Processes consuming >10% CPU with no known reason
- Processes listening on network ports that aren't registered services
- Any `cron` or `launchd` jobs added since last baseline

## Commands
```bash
# All user processes
ps aux | grep -v grep | grep "$(whoami)"

# PM2 process list as JSON
pm2 jlist 2>/dev/null

# Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null

# LaunchAgents (persistent background jobs)
launchctl list | grep -v "^-.*com.apple"

# High CPU processes
ps aux --sort=-%cpu | head -10
```

## Known-Good Processes
```
pm2 daemon              — process manager
node (frontend)         — Next.js frontend
node (bridge)           — Message bridge
node (orchestrator)     — Julia orchestrator
node (cowork-mcp)       — Claude MCP server
docker                  — container runtime
postgres                — database (inside Docker)
com.juliaz.*            — our LaunchAgents
com.juliaz.adhd-agent   — ADHD agent
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| Unknown process with network access | 🔴 Critical |
| Unknown persistent LaunchAgent | 🟠 High |
| PM2 process crash-looping (restarts >5) | 🟡 Medium |
| High CPU with no explanation | 🟡 Medium |
| Docker container running unexpectedly | 🟡 Medium |

## Output Format
```
PROCESS AUDIT
✅ PM2: 5/5 expected processes online
✅ Docker: postgres, api healthy
⚠️  bridge restarted 7 times today (crash-loop risk)
🔴 Unknown process: /tmp/updater (PID 8821) — listening on :4444
```
