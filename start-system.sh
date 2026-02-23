#!/bin/bash

# Julia Agents — System Auto-Start Script
# Launched automatically at macOS login via LaunchAgent
# Starts backend (Docker) and all PM2 services (frontend, bridge, orchestrator, cowork-mcp)

set -e

PROJECT_DIR="/Users/raphael/Documents/Devs/juliaz_agents"
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

# ── 1. Wait for Docker to be ready ──────────────────────────────────────────
echo "[1/3] Waiting for Docker Desktop to be ready..."
MAX_WAIT=120  # seconds
WAITED=0
until docker info &>/dev/null; do
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "❌ Docker not ready after ${MAX_WAIT}s — skipping backend startup"
        break
    fi
    sleep 5
    WAITED=$((WAITED + 5))
done

if docker info &>/dev/null; then
    echo "[1/3] ✅ Docker ready. Starting backend..."
    cd "$PROJECT_DIR/backend"
    docker compose up -d
    echo "[1/3] ✅ Backend (Docker) started."
else
    echo "[1/3] ⚠️  Docker not available — backend skipped."
fi

# ── 2. Clean up any stale PM2 processes ────────────────────────────────────
echo "[2/3] Cleaning existing PM2 processes..."
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
echo "[3/3] Starting PM2 services (production)..."
cd "$PROJECT_DIR"
/opt/homebrew/bin/pm2 start ecosystem.config.js
/opt/homebrew/bin/pm2 save

echo ""
echo "✅ Julia Agents system started successfully!"
echo "   Frontend:    http://localhost:3002"
echo "   Bridge:      http://localhost:3001"
echo "   Cowork MCP:  http://localhost:3003"
echo "   Backend API: http://localhost:3000"
echo ""
