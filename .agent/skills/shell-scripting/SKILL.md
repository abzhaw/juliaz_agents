---
name: shell-scripting
description: Bash best practices, startup scripts, error handling in shell. Use when writing or debugging Julia's startup scripts, agent loop scripts, or any shell automation.
---

# Shell Scripting

## Startup Script Template
```bash
#!/bin/bash
# Description: What this script does
# Author: Antigravity | Date: 2026

# DO NOT use 'set -e' in startup scripts — it causes silent aborts on benign errors
# Use explicit error handling instead

PROJECT_DIR="/Users/raphael/juliaz_agents"
LOG_FILE="$PROJECT_DIR/logs/my-script.log"

mkdir -p "$(dirname "$LOG_FILE")"
exec >> "$LOG_FILE" 2>&1  # redirect all output to log

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log "=== Script started ==="

# PATH for homebrew tools
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:$PATH"
```

## Safe Error Handling (without set -e)
```bash
# Check return codes explicitly
if ! command_that_might_fail; then
    log "❌ Command failed — continuing anyway"
fi

# Or use || true to suppress errors
risky_command || true

# For critical failures only:
critical_command || { log "FATAL: critical_command failed"; exit 1; }
```

## Common Patterns
```bash
# Kill process on port
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port 2>/dev/null)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null && echo "Killed PID $pid on :$port"
}

# Wait for a service to be ready
wait_for_service() {
  local url=$1 max=${2:-60} waited=0
  until curl -sf "$url" > /dev/null; do
    [ $waited -ge $max ] && echo "Timeout waiting for $url" && return 1
    sleep 5; waited=$((waited + 5))
  done
  echo "✅ $url ready after ${waited}s"
}

# Check if PM2 app is running
pm2_running() { pm2 list | grep -q "$1.*online"; }
```

## Shell Scripting Rules for Julia
- Always log with timestamps
- Never hardcode credentials — source from `.env.secrets`
- Use `sleep 30` at boot scripts to let macOS settle
- Always make scripts executable: `chmod +x script.sh`
- Test scripts manually before adding to LaunchAgent
