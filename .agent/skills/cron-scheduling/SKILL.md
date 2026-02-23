---
name: cron-scheduling
description: Cron expression design, PM2 cron, LaunchAgent intervals, and scheduling agents reliably. Use when setting up Julia's scheduled agents like ADHD agent, security sentinel, or task manager.
---

# Cron Scheduling

## Cron Expression Syntax
```
┌───── minute (0-59)
│ ┌───── hour (0-23)
│ │ ┌───── day of month (1-31)
│ │ │ ┌───── month (1-12)
│ │ │ │ ┌───── day of week (0-6, 0=Sunday)
│ │ │ │ │
* * * * *
```

## Common Expressions
```
*/15 * * * *     Every 15 minutes
0 * * * *        Every hour on the hour
0 7 * * *        Daily at 7:00 AM
0 7 * * 1        Every Monday at 7:00 AM
0 */6 * * *      Every 6 hours
0 0 * * *        Daily at midnight
*/5 * * * *      Every 5 minutes
```

## PM2 Cron Jobs
```js
// ecosystem.config.js
{
  name: 'security-scanner',
  script: './security-agent/scripts/daily-report.sh',
  cron_restart: '0 7 * * *',    // 7 AM daily
  autorestart: false,            // don't restart on normal exit
  watch: false,
}
```

## LaunchAgent Interval (for non-cron scheduling)
```xml
<!-- Run every 6 hours (21600 seconds) -->
<key>StartInterval</key>
<integer>21600</integer>
<key>RunAtLoad</key>
<false/>
```

## Julia's Agent Schedule
| Agent | Schedule | Method |
|-------|----------|--------|
| Health Checker | Every 15 min | PM2 cron |
| Task Manager | Every 6h | PM2 cron |
| Security Sentinel | Daily 07:00 | PM2 cron |
| ADHD Agent | Every 6h | LaunchAgent StartInterval |
| Startup | At login | LaunchAgent RunAtLoad |
