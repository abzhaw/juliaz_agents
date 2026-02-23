# Agent Card — Task Manager

## Identity

| Field | Value |
|-------|-------|
| **Name** | Task Manager |
| **Role** | Project management — maintains shared TODO queue |
| **Workspace** | `task-manager/` + `todo/` |
| **Status** | Autonomous (PM2 cron every 6h) |

## What It Does

The Task Manager maintains the shared TODO queue in `todo/`. It checks task queue integrity, detects stale tasks, auto-unblocks tasks whose dependencies are resolved, and sends a weekly summary every Monday.

## What It Watches

- Index consistency: Does `todo/index.yml` match actual task files?
- Stale tasks: Any task `in_progress` for >7 days without updates?
- Unblocked tasks: Dependencies resolved? Auto-move from `blocked` to `open`
- Orphan files: Task files not listed in the index

## Behavior

- **Normal (nothing to report)**: Silent
- **Stale task found**: Telegram alert
- **Task auto-unblocked**: Telegram notification
- **Weekly summary (Mondays)**: Open/in-progress/blocked/done counts

## Automation

- **Schedule**: Every 6 hours via PM2 `cron_restart`
- **Config**: `ecosystem.config.js` entry `task-manager`
- **Script**: `task-manager/scripts/task_check.sh`

## Key Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Core identity and behavioral rules |
| `HEARTBEAT.md` | Schedule and check logic |
| `IDENTITY.md` | Agent identity |
| `AGENTS.md` | Sub-agent configuration |
| `TOOLS.md` | Available tools |
| `scripts/task_check.sh` | Main heartbeat script |
| `memory/` | Operational notes |
