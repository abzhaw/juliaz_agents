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

# 5. Cowork MCP — Claude as a multimodal sub-agent (port 3003)
echo "🤖 Starting Cowork MCP..."
cd cowork-mcp
pm2 delete cowork-mcp 2>/dev/null
pm2 start npm --name cowork-mcp -- run dev
cd ..

# 6. OpenClaw Gateway
echo "🦞 Opening OpenClaw Gateway..."
openclaw gateway start --force

echo "✅ System initialized!"
echo "   Frontend:   http://localhost:3002"
echo "   Bridge MCP: http://localhost:3001/mcp"
echo "   Cowork MCP: http://localhost:3003/mcp"
pm2 list
