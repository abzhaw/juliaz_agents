---
name: system-monitoring
description: Process monitoring, disk/memory alerts, observability for Julia's macOS server. Use when checking system health or adding monitoring to any Julia component.
---

# System Monitoring

## Quick Health Snapshot (bash)
```bash
#!/bin/bash
echo "=== Julia System Health ==="
echo "Time: $(date)"
echo ""

# PM2 status
echo "--- PM2 Services ---"
pm2 jlist 2>/dev/null | jq -r '.[] | "\(.name): \(.pm2_env.status) (↺ \(.pm2_env.restart_time))"'

# Port reachability
echo ""
echo "--- Port Health ---"
for port in 3000 3001 3002 3003; do
  if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
    echo "  :$port ✅"
  else
    echo "  :$port ❌"
  fi
done

# Disk
echo ""
echo "--- Disk ---"
df -h /Users/raphael | tail -1 | awk '{print "  Used: "$3"/"$2" ("$5")"}'

# Memory
echo ""
echo "--- Memory ---"
vm_stat | awk '/Pages free/ {free=$3} /Pages active/ {act=$3} END {
  print "  Free: " int(free*4096/1048576) "MB, Active: " int(act*4096/1048576) "MB"
}'
```

## PM2 JSON Status Parsing
```ts
import { execSync } from 'child_process';
interface Pm2App { name: string; pm2_env: { status: string; restart_time: number } }

function getPm2Status(): Pm2App[] {
  const output = execSync('pm2 jlist', { encoding: 'utf-8' });
  return JSON.parse(output);
}

function isHealthy(app: Pm2App): boolean {
  return app.pm2_env.status === 'online' && app.pm2_env.restart_time < 5;
}
```

## Alert Thresholds for Julia
| Metric | Warning | Critical |
|--------|---------|---------|
| PM2 restarts | > 3 | > 10 |
| Disk usage | > 70% | > 90% |
| Service down | Any | - |
| Response time | > 2s | > 10s |
