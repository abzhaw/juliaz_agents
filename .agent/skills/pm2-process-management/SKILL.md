---
name: pm2-process-management
description: PM2 config, ecosystem files, restart strategies, log management, cron jobs. Use when configuring Julia's services, debugging crashes, or adding new managed processes.
---

# PM2 Process Management

## Ecosystem Config (key options)
```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'service-name',
    cwd: './service-dir',
    script: 'npm',
    args: 'run start',
    // Restart strategy
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    // Environment
    env: { NODE_ENV: 'production' },
    env_development: { NODE_ENV: 'development' },
    // Cron (for scheduled agents)
    cron_restart: '0 7 * * *',   // restart daily at 7am
    autorestart: false,           // don't auto-restart on exit (for cron jobs)
  }]
};
```

## Essential Commands
```bash
pm2 start ecosystem.config.js    # Start all apps
pm2 restart <name>               # Restart one app
pm2 stop <name>                  # Stop (don't delete)
pm2 delete all                   # Remove all app entries
pm2 status                       # Overview table
pm2 logs <name> --lines 50       # Tail logs
pm2 logs <name> --nostream       # Print last N lines and exit
pm2 save                         # Persist current list to dump.pm2
pm2 resurrect                    # Restore from dump.pm2
pm2 flush                        # Clear old logs
```

## Cron Jobs in PM2 (for agents)
```js
{
  name: 'health-checker',
  script: './scripts/health_check.sh',
  cron_restart: '*/15 * * * *',  // every 15 minutes
  autorestart: false,
  watch: false,
}
```

## Log Files
```
~/.pm2/logs/<name>-out.log   ← stdout
~/.pm2/logs/<name>-error.log ← stderr
```

## Julia's PM2 Services
| Name | Port | Type |
|------|------|------|
| `frontend` | 3002 | Always-on |
| `bridge` | 3001 | Always-on |
| `orchestrator` | — | Always-on loop |
| `cowork-mcp` | 3003 | Always-on |
| `backend-docker` | — | docker compose up |
