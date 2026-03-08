# Architecture Agent Heartbeat

**Status**: Active
**Last Verified**: 2026-03-08
**Schedule**: Every 6 hours via PM2 cron

## Health Indicators

- `memory/last_graph.json` exists and is < 7 hours old
- `frontend/src/lib/architectureGraph.json` exists
- `memory/changelog.md` has entries

## Recovery

If this agent stops producing graphs:
1. Check PM2: `pm2 info architecture-agent`
2. Check logs: `pm2 logs architecture-agent --lines 50`
3. Manual run: `bash architecture-agent/scripts/architecture_scan.sh`
4. Verify Python 3 is available: `python3 --version`
