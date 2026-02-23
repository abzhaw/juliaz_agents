---
name: log-management
description: Structured logging, log rotation, PM2 logs, aggregation. Use when setting up consistent logging across Julia's services or debugging runtime issues.
---

# Log Management

## Structured Logger Pattern
```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function createLogger(service: string) {
  return {
    log: (level: LogLevel, msg: string, meta?: object) => {
      const entry = {
        ts: new Date().toISOString(),
        service,
        level,
        msg,
        ...meta,
      };
      console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
    },
    info:  (msg: string, meta?: object) => this.log('info', msg, meta),
    warn:  (msg: string, meta?: object) => this.log('warn', msg, meta),
    error: (msg: string, meta?: object) => this.log('error', msg, meta),
  };
}

const log = createLogger('bridge');
log.info('Server started', { port: 3001 });
log.error('Failed to process message', { messageId: '123', err: e.message });
```

## PM2 Log Commands
```bash
pm2 logs                          # tail all services
pm2 logs bridge --lines 100       # last 100 lines for one service
pm2 logs bridge --nostream        # print without tailing
pm2 flush                         # clear all PM2 logs
pm2 logs --err                    # stderr only
```

## Log File Locations
```
~/.pm2/logs/<name>-out.log        # PM2 managed stdout
~/.pm2/logs/<name>-error.log      # PM2 managed stderr
~/juliaz_agents/logs/startup.log  # boot startup log
~/juliaz_agents/logs/launchagent.log  # LaunchAgent output
~/juliaz_agents/adhd-agent/memory/adhd_loop.log
~/juliaz_agents/security-agent/memory/
```

## Log Rotation (PM2 module)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```
