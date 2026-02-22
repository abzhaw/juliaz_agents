#!/bin/bash

# Julia's 1-Click Startup Script
# Maintained by Antigravity

echo "🏗️  Starting Julia System..."

# 1. Backend (Docker)
echo "📦 Checking Backend (Docker)..."
cd backend && docker compose up -d
cd ..

# 2. Bridge (PM2)
echo "🔌 Starting Bridge..."
cd bridge
pm2 delete bridge 2>/dev/null
pm2 start npm --name bridge -- run dev
cd ..

# 3. Frontend (PM2)
echo "🖥️  Starting Frontend..."
cd frontend
pm2 delete frontend 2>/dev/null
pm2 start npm --name frontend -- run dev
cd ..

# 4. Orchestrator (PM2)
echo "🧠 Starting Orchestrator..."
cd orchestrator
pm2 delete orchestrator 2>/dev/null
pm2 start npm --name orchestrator -- run dev
cd ..

# 5. OpenClaw Dashboard (Official)
echo "🦞 Opening OpenClaw Dashboard..."
openclaw gateway start --force
openclaw dashboard

# 6. Julia Custom Dashboard (PM2)
echo "📊 Starting Custom Dashboard..."
cd dashboard
pm2 delete custom-dashboard 2>/dev/null
pm2 start npx --name custom-dashboard -- serve -p 3003 . 
cd ..

echo "✅ System initialized! Open http://localhost:3002 for Frontend or http://localhost:3003 for Live Stream."
pm2 list
