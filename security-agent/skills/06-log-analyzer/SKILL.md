---
name: log-analyzer
description: Scan all service logs for error spikes, failed auth attempts, and suspicious access patterns
---

# Skill: Log Analyzer

## Purpose
Logs are the black box of the system. This skill reads them so you don't have to. It looks for patterns that signal something is wrong: auth failures, error explosions, and unexpected access.

## Log Sources
| Source | Location |
|--------|----------|
| PM2 logs | `~/.pm2/logs/` |
| Startup log | `security-agent/../logs/startup.log` |
| Bridge log | PM2 stdout for `bridge` |
| Orchestrator log | PM2 stdout for `orchestrator` |
| Frontend log | PM2 stdout for `frontend` |
| Docker logs | `docker logs backend-api` + `docker logs postgres` |

## What It Checks

### Auth & Access
- Failed Telegram auth attempts (unknown user IDs)
- API requests with missing or invalid auth headers
- Repeated 401/403 responses in logs

### Errors
- Any `ERROR` or `FATAL` entries in the last 24h
- Error rate vs. previous day (trend)
- Repeated identical errors (possible loop)

### Suspicious Patterns
- Requests from unexpected IP addresses
- Large request payloads (possible injection attempt)
- Unusually high request volume (possible scraping/DoS)

## Commands
```bash
# Last 24h PM2 logs
pm2 logs --nostream --lines 500 2>/dev/null

# Docker container logs (last 24h)
docker logs --since 24h juliaz_agents-api-1 2>/dev/null
docker logs --since 24h juliaz_agents-postgres-1 2>/dev/null

# Count errors by service
pm2 logs --nostream --lines 1000 2>/dev/null | grep -c "ERROR\|FATAL"
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| Unknown Telegram user ID messaged Julia | 🔴 Critical |
| Auth failures >10 in 24h | 🟠 High |
| Error rate up >300% vs. yesterday | 🟠 High |
| Same error repeated >50 times | 🟡 Medium |
| Unusual request volume | 🟡 Medium |

## Output Format
```
LOG ANALYSIS (last 24h)
orchestrator: 3 errors (down from 12 yesterday) ✅
bridge:       0 errors ✅
frontend:     47 errors ⚠️  (React hydration — known issue)
docker-api:   1 FATAL — DB connection timeout 🟠
auth:         ✅ No unknown Telegram users
```
