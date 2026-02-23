---
name: agent-self-healing
description: Automated error detection, restart strategies, and self-repair loops for agents. Use when designing or debugging Julia's health-checker, ADHD agent, or any component that needs to monitor and recover from failures.
---

# Agent Self-Healing

## Patterns

### Health Check Loop
```bash
#!/bin/bash
# Check if a service is healthy, restart if not
check_and_heal() {
  local name=$1 port=$2
  if ! curl -sf "http://localhost:$port/health" > /dev/null; then
    echo "[$name] UNHEALTHY — restarting..."
    pm2 restart "$name"
    sleep 5
    curl -sf "http://localhost:$port/health" && echo "[$name] ✅ Recovered" || echo "[$name] ❌ Still down"
  fi
}

check_and_heal frontend 3002
check_and_heal bridge 3001
check_and_heal cowork-mcp 3003
```

### PM2 Restart With Backoff
```js
// ecosystem.config.js
{
  restart_delay: 3000,
  exp_backoff_restart_delay: 100,
  max_restarts: 10  // stop trying after 10 crashes
}
```

### Port Conflict Resolution
```bash
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port 2>/dev/null)
  [ -n "$pid" ] && kill "$pid" && echo "Killed PID $pid on port $port"
}
```

### Self-Healing Agent Checklist
- [ ] Service reachable (HTTP health check)
- [ ] PM2 process in `online` state (not `errored`)
- [ ] No port conflicts (EADDRINUSE)
- [ ] Log file not growing unboundedly
- [ ] API keys still valid (test a lightweight call)

## Julia's Health Checker
- Runs every 15 min via PM2 cron
- Checks ports: 3000, 3001, 3002, 3003
- Checks OpenClaw: `openclaw health`
- Auto-restarts via `pm2 restart <name>`
- Escalates to Telegram if a service fails 3x in a row
