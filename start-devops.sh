#!/bin/bash

# DevOps 1-Click Startup Script for Julia Agents
# Starts all services using PM2 logic (Frontend, Bridge, Orchestrator, Backend)
# Run with `./start-devops.sh` or `./start-devops.sh prod`

ENV=${1:-dev}

echo "🚀 Starting Julia System via PM2 ($ENV mode)..."

# Ensure global/local pm2 is present
if ! command -v pm2 &> /dev/null
then
    echo "PM2 not found. Installing locally..."
    npm install pm2 -g
fi

# Start backend via Docker (PostgreSQL + API on port 3000)
echo "🐳 Starting backend via Docker..."
(cd backend && docker compose up -d)

# Stop existing PM2 processes
echo "🧹 Cleaning up existing PM2 processes..."
pm2 delete all 2>/dev/null

# Kill any rogue processes on PM2-managed ports (3001, 3002, 3003)
for port in 3001 3002 3003; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "   Killing rogue process on port $port (PID $pid)"
        kill $pid 2>/dev/null
        sleep 1
    fi
done

if [ "$ENV" = "prod" ]; then
    echo "📦 Starting PROD configuration..."
    pm2 start ecosystem.config.js
else
    echo "🛠️  Starting DEV configuration..."
    pm2 start ecosystem.dev.config.js
fi

pm2 save

# Install LaunchAgents (ADHD Agent + start-system)
echo "📋 Installing LaunchAgents..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHAGENT_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCHAGENT_DIR" 2>/dev/null || true

# ADHD Agent
ADHD_SRC="$SCRIPT_DIR/adhd-agent/config/com.juliaz.adhd-agent.plist"
if [ -f "$ADHD_SRC" ]; then
    launchctl unload "$LAUNCHAGENT_DIR/com.juliaz.adhd-agent.plist" 2>/dev/null || true
    cp "$ADHD_SRC" "$LAUNCHAGENT_DIR/com.juliaz.adhd-agent.plist"
    launchctl load "$LAUNCHAGENT_DIR/com.juliaz.adhd-agent.plist" 2>/dev/null || true
    echo "   ADHD Agent LaunchAgent installed."
fi

# Start-System (boot trigger)
SYSTEM_SRC="$SCRIPT_DIR/config/com.juliaz.start-system.plist"
if [ -f "$SYSTEM_SRC" ]; then
    if ! launchctl list 2>/dev/null | grep -q "com.juliaz.start-system"; then
        cp "$SYSTEM_SRC" "$LAUNCHAGENT_DIR/com.juliaz.start-system.plist"
        launchctl load "$LAUNCHAGENT_DIR/com.juliaz.start-system.plist" 2>/dev/null || true
        echo "   Start-System LaunchAgent installed."
    fi
fi

# Start OpenClaw gateway if available
if command -v openclaw &>/dev/null; then
    echo "🦞 Starting OpenClaw gateway..."
    openclaw gateway start --force 2>/dev/null &
fi

echo "✅ System initialized!"
echo "📡 Open frontend UI at: http://localhost:3002"
echo "To monitor logs: pm2 logs"
echo "To stop all: pm2 stop all"
