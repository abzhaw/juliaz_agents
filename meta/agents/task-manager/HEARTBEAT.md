# Heartbeat — Task Manager

## Schedule

- **Frequency**: Every heartbeat cycle (piggybacks on OpenClaw's heartbeat)
- **Trigger**: When OpenClaw processes heartbeat, it checks if task-manager has pending work

## On Each Heartbeat

1. **Verify index consistency**: Does `todo/index.yml` match the actual task files?
2. **Check for stale tasks**: Any task `in_progress` for more than 7 days without a note update?
3. **Check for unblocked tasks**: Any task with `depends_on` where all dependencies are now `done`?
4. **Auto-unblock**: Move newly-unblocked tasks from `blocked` to `open`

## Reporting

- **Normal (nothing to report)**: Silent. Don't message Raphael.
- **Stale task found**: Send Telegram: "📋 TASK-NNN has been in_progress for N days with no updates. Still active?"
- **Task auto-unblocked**: Send Telegram: "📋 TASK-NNN is now unblocked (dependency TASK-MMM completed). Ready to start."
- **Weekly summary** (Mondays): "📋 Weekly: N open, N in progress, N completed this week. Top priority: TASK-NNN."

## Health Check

The task-manager is healthy if:
- `todo/index.yml` exists and is valid YAML
- All task files referenced in index exist
- No orphan task files (files in todo/ not in index)
