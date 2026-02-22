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

echo "✅ System initialized!"
echo "📡 Open frontend UI at: http://localhost:3002"
echo "To monitor logs: pm2 logs"
echo "To stop all: pm2 stop all"
