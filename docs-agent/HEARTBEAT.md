# HEARTBEAT — Docs Agent

## Schedule

- **Frequency**: Every 12 hours via PM2 cron (`0 */12 * * *`)
- **Mechanism**: PM2 cron_restart
- **Script**: `scripts/docs_drift_check.sh`

## What It Checks

1. **Agent count**: Does README.md claim the correct number of components?
2. **Port map**: Do documented ports match `ecosystem.config.js`?
3. **Agent table**: Do agent statuses in `agent_system_overview.md` match PM2 process list?
4. **Agent cards**: Does every agent directory have a corresponding card in `docs/agent_cards/`?
5. **Startup steps**: Does `start-system.sh` step count match what docs claim?

## Escalation

- **Drift found**: Send Telegram alert with specific file + line + fix suggestion
- **All synced**: Log "docs synchronized" — no alert

## Logs

- `memory/docs_drift.log` — timestamped check results
