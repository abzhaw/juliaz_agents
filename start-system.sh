#!/bin/bash

# Julia Agents — System Auto-Start Script
# Launched automatically at macOS login via LaunchAgent
# Starts backend (Docker), all PM2 services (frontend, bridge, orchestrator, cowork-mcp,
# sentinel, task-manager, health-checker), installs ambient LaunchAgents, starts OpenClaw
# gateway, and runs Sentinel security scan on boot

# NOTE: Do NOT use 'set -e' here — we want the script to continue even if some steps fail

PROJECT_DIR="/Users/raphael/juliaz_agents"
LOG_FILE="$PROJECT_DIR/logs/startup.log"

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"

exec >> "$LOG_FILE" 2>&1
echo ""
echo "========================================"
echo "Julia Agents — Boot Startup"
echo "$(date)"
echo "========================================"

# PATH must include homebrew bin for npm, docker, pm2
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── 0. Wait for login to settle ──────────────────────────────────────────────
echo "[0/9] Waiting 30s for macOS to fully settle after login..."
sleep 30

# ── 1. Launch & wait for Docker to be ready ─────────────────────────────────
echo "[1/9] Launching Docker Desktop and waiting for it to be ready..."
# Kick off Docker Desktop (it auto-quits if already running — safe to call)
open -a Docker 2>/dev/null || true
sleep 10  # give Docker a moment to begin starting before polling
MAX_WAIT=120  # seconds
WAITED=0
DOCKER_OK=false
until docker info &>/dev/null; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "  Docker not ready after ${MAX_WAIT}s — skipping backend startup"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
done

if docker info &>/dev/null; then
    echo "[1/9] Docker ready. Starting backend..."
    cd "$PROJECT_DIR/backend"
    docker compose up -d
    DOCKER_OK=true
    echo "[1/9] Backend (Docker) started."
else
    echo "[1/9] Docker not available — backend skipped."
fi

# ── 2. Clean up any stale PM2 processes ────────────────────────────────────
echo "[2/9] Cleaning existing PM2 processes..."
cd "$PROJECT_DIR"
/opt/homebrew/bin/pm2 delete all 2>/dev/null || true

# Kill rogue processes on PM2-managed ports
for port in 3001 3002 3003; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "   Killing rogue process on port $port (PID $pid)"
        kill "$pid" 2>/dev/null || true
        sleep 1
    fi
done

# ── 3. Start PM2 services ───────────────────────────────────────────────────
echo "[3/9] Starting PM2 services (production)..."
cd "$PROJECT_DIR"
/opt/homebrew/bin/pm2 start ecosystem.config.js
/opt/homebrew/bin/pm2 save

echo ""
echo "Julia Agents PM2 services started!"
echo "   Frontend:       http://localhost:3002"
echo "   Bridge:         http://localhost:3001"
echo "   Cowork MCP:     http://localhost:3003"
echo "   Backend API:    http://localhost:3000"
echo "   Sentinel:       cron 07:00 daily"
echo "   Task Manager:   cron every 6h"
echo "   Health Checker: cron every 15min"
echo ""

# ── 4. Install & load ambient LaunchAgents ─────────────────────────────────
echo "[4/9] Installing ambient LaunchAgents..."
LAUNCHAGENT_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCHAGENT_DIR"

# ADHD Agent — runs every 4 hours
ADHD_PLIST="com.juliaz.adhd-agent.plist"
ADHD_SRC="$PROJECT_DIR/adhd-agent/config/$ADHD_PLIST"
if [ -f "$ADHD_SRC" ]; then
    # Unload old version if exists (ignore errors)
    launchctl unload "$LAUNCHAGENT_DIR/$ADHD_PLIST" 2>/dev/null || true
    cp "$ADHD_SRC" "$LAUNCHAGENT_DIR/$ADHD_PLIST"
    launchctl load "$LAUNCHAGENT_DIR/$ADHD_PLIST"
    echo "[4/9] ADHD Agent LaunchAgent installed and loaded."
else
    echo "[4/9] ADHD Agent plist not found — skipping."
fi

# Start-System — ensures this very script runs on every login
SYSTEM_PLIST="com.juliaz.start-system.plist"
SYSTEM_SRC="$PROJECT_DIR/config/$SYSTEM_PLIST"
if [ -f "$SYSTEM_SRC" ]; then
    if ! launchctl list 2>/dev/null | grep -q "com.juliaz.start-system"; then
        cp "$SYSTEM_SRC" "$LAUNCHAGENT_DIR/$SYSTEM_PLIST"
        launchctl load "$LAUNCHAGENT_DIR/$SYSTEM_PLIST"
        echo "[4/9] Start-System LaunchAgent installed and loaded."
    else
        echo "[4/9] Start-System LaunchAgent already loaded — skipping."
    fi
else
    echo "[4/9] Start-System plist not found — skipping."
fi

# ── 5. Run Sentinel security scan on boot ────────────────────────────────────
echo "[5/9] Running Sentinel boot security scan..."
SENTINEL_SCRIPT="$PROJECT_DIR/security-agent/scripts/daily-report.sh"
if [ -x "$SENTINEL_SCRIPT" ]; then
    # Run in background so it doesn't block Chrome opening
    bash "$SENTINEL_SCRIPT" &
    SENTINEL_PID=$!
    echo "[5/9] Sentinel scan started (PID $SENTINEL_PID) — report will be in security-agent/reports/"
else
    echo "[5/9] Sentinel script not found or not executable — skipping boot scan"
fi

# ── 6. Start OpenClaw gateway ─────────────────────────────────────────────
echo "[6/9] Starting OpenClaw gateway..."
if command -v openclaw &>/dev/null; then
    openclaw gateway start --force 2>/dev/null &
    echo "[6/9] OpenClaw gateway started."
else
    echo "[6/9] openclaw command not found — skipping gateway start."
fi

# ── 7. Run initial health check ─────────────────────────────────────────────
echo "[7/9] Running initial health check (60s delay for services to warm up)..."
(
    sleep 60
    HEALTH_SCRIPT="$PROJECT_DIR/health-checker/scripts/health_check.sh"
    if [ -x "$HEALTH_SCRIPT" ]; then
        bash "$HEALTH_SCRIPT"
    fi
) &
echo "[7/9] Health check scheduled."

# ── 8. Open Chrome with all localhost tabs ──────────────────────────────────
echo "[8/9] Waiting 15s for services to be ready, then opening Chrome..."
sleep 15

open -na "Google Chrome" --args \
    --new-window \
    "http://localhost:3002" \
    "http://localhost:3001/health" \
    "http://localhost:3000" \
    "http://localhost:3003"

echo "[8/9] Chrome opened with all localhost tabs."

# ── 9. Summary ──────────────────────────────────────────────────────────────
echo "[9/9] All systems started."
echo ""
echo "   Frontend:       http://localhost:3002"
echo "   Bridge:         http://localhost:3001"
echo "   Backend API:    http://localhost:3000"
echo "   Cowork MCP:     http://localhost:3003"
echo "   OpenClaw:       ws://127.0.0.1:18789"
echo "   Sentinel:       cron 07:00 daily"
echo "   Task Manager:   cron every 6h"
echo "   Health Checker: cron every 15min"
echo "   ADHD Agent:     LaunchAgent every 4h"
echo ""
echo "$(date) — Startup complete."
