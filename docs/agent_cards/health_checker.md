# Agent Card — Health Checker

## Identity

| Field | Value |
|-------|-------|
| **Name** | Health Checker |
| **Role** | System watchdog — monitors all services and auto-heals |
| **Workspace** | `health-checker/` |
| **Status** | Autonomous (PM2 cron every 15 min) |

## What It Does

The Health Checker runs every 15 minutes and verifies that every service, ambient agent, and scheduled process in the juliaz_agents ecosystem is alive. If something is down, it alerts Raphael via Telegram. If a PM2 process is simply stopped (not errored), it auto-restarts it.

## What It Checks

- HTTP health endpoints: Frontend (3002), Bridge (3001), Backend (3000), Cowork MCP (3003)
- PM2 processes: frontend, bridge, orchestrator, cowork-mcp, backend-docker, sentinel, task-manager
- Docker containers: backend
- LaunchAgents: com.juliaz.adhd-agent, com.juliaz.start-system
- OpenClaw gateway health

## Trigger Mechanics (Silent-Unless-Actionable)
The Health Checker evaluates the system on its 15-minute cycle but is **completely silent** if all services are healthy.

## Behavior

- **All healthy**: Silent (log only)
- **Service stopped**: Auto-restart via PM2, notify Telegram
- **Service errored**: Telegram alert only (needs manual investigation)
- **Docker down**: Telegram alert (manual intervention needed)
- **LaunchAgent not loaded**: Telegram alert with install instructions

## Automation

- **Schedule**: Every 15 minutes via PM2 `cron_restart`
- **Config**: `ecosystem.config.js` entry `health-checker`
- **Script**: `health-checker/scripts/health_check.sh`

## Key Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Core identity and behavioral rules |
| `HEARTBEAT.md` | Schedule and check targets |
| `IDENTITY.md` | Agent identity |
| `scripts/health_check.sh` | Main health check script |
| `memory/health_check.log` | Running log |
| `reports/YYYY-MM-DD.log` | Daily aggregated reports |
