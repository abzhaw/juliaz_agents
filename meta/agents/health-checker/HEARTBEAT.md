# Heartbeat — Health Checker Agent

## Schedule

- **Frequency**: Every 15 minutes via PM2 cron
- **Config**: `ecosystem.config.js` entry `health-checker`
- **Log**: `health-checker/memory/health_check.log`
- **Reports**: `health-checker/reports/YYYY-MM-DD.log` (daily aggregate)

## On Each Heartbeat

1. **Check PM2 processes**: Are all expected processes running?
2. **Probe health endpoints**: Can we reach ports 3000, 3001, 3002, 3003?
3. **Check Docker containers**: Is `backend-docker` up?
4. **Check LaunchAgents**: Are `com.juliaz.adhd-agent` and `com.juliaz.start-system` loaded?
5. **Check OpenClaw gateway**: Is it responsive?
6. **Auto-heal**: Restart any stopped PM2 process (not errored ones)
7. **Alert**: Send Telegram if anything is unhealthy
8. **Log**: Append to daily report

## Health Check Targets

| Target | Method | Expected |
|--------|--------|----------|
| Frontend | `curl localhost:3002` | HTTP 200 |
| Bridge | `curl localhost:3001/health` | HTTP 200 |
| Backend | `curl localhost:3000/health` | HTTP 200 |
| Cowork MCP | `curl localhost:3003/health` | HTTP 200 |
| Orchestrator | PM2 status = online | online |
| Sentinel | PM2 status != errored | stopped or online |
| Task Manager | PM2 status != errored | stopped or online |
| Docker | `docker ps` contains backend | running |
| ADHD Agent | `launchctl list` contains adhd-agent | loaded |
| OpenClaw | `openclaw status` or port 18789 | responsive |

## Reporting

- **Unhealthy**: Telegram alert immediately
- **Auto-healed**: Telegram note: "Restarted X via PM2"
- **All healthy**: Silent (log only)
- **Daily digest**: Every day at 20:00, if any issues occurred that day, send summary
