---
name: juliaz-devops
description: "Service management, process supervision, and operational tasks for the juliaz_agents multi-agent system. Trigger whenever Raphael asks to start, stop, restart, or check the status of any service — PM2, Docker, bridge, orchestrator, OpenClaw, cowork-mcp, frontend, or backend. Also trigger for: environment variable management, port conflicts, log tailing, deployment, health checks, 'is Julia running', 'start everything', 'check status', 'why is X down', pm2, docker compose, or any operational/infrastructure task. If the user mentions starting services, checking health, or managing processes — use this skill."
---

# juliaz-devops — Service Management & Operations

> Operational knowledge for running, monitoring, and troubleshooting the juliaz_agents infrastructure.

## Service Map

| Service | Manager | Port | Start Command | Health Check |
|---------|---------|------|---------------|-------------|
| Backend API | Docker Compose | 3000 | `cd backend && docker compose up -d` | `curl http://localhost:3000/health` |
| Bridge | PM2 | 3001 | `pm2 start ecosystem.dev.config.js --only bridge` | `curl http://localhost:3001/health` |
| Frontend | PM2 | 3002 | `pm2 start ecosystem.dev.config.js --only frontend` | `curl http://localhost:3002` |
| Cowork MCP | PM2 | 3003 | `pm2 start ecosystem.dev.config.js --only cowork-mcp` | `curl http://localhost:3003/health` |
| Orchestrator | PM2 | — | `pm2 start ecosystem.dev.config.js --only orchestrator` | Check PM2 status |
| OpenClaw | CLI | 18789 (ws) | `openclaw gateway start --force` | `openclaw health` |

## Start Everything (Development)

```bash
# 1. Backend (Docker — must be first, other services depend on DB)
cd backend && docker compose up -d

# 2. All PM2 services (bridge, frontend, cowork-mcp, orchestrator)
pm2 start ecosystem.dev.config.js

# 3. OpenClaw gateway (separate because it's a CLI tool)
openclaw gateway start --force
```

Or use the convenience script:
```bash
./start-devops.sh
```

## Stop Everything

```bash
pm2 stop all
cd backend && docker compose down
openclaw gateway stop  # if applicable
```

## PM2 Operations

```bash
# Status of all services
pm2 list

# Tail all logs
pm2 logs

# Tail specific service
pm2 logs bridge
pm2 logs orchestrator

# Restart a specific service
pm2 restart bridge
pm2 restart orchestrator

# Restart all
pm2 restart all

# Delete all (clean slate)
pm2 delete all

# Start production config
pm2 start ecosystem.config.js

# Start development config
pm2 start ecosystem.dev.config.js
```

### PM2 Config Details

Both `ecosystem.config.js` and `ecosystem.dev.config.js` include:
- Auto-restart with exponential backoff
- 10-restart cap before giving up
- Environment variable injection from `.env.secrets`
- `cwd` set to each service's directory

Key difference: dev config uses `npm run dev` (with watch/hot reload), production uses `npm run start`.

## Docker Operations (Backend Only)

```bash
# Start
cd backend && docker compose up -d

# Check status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View logs
docker compose -f backend/docker-compose.yml logs -f

# Rebuild after schema changes
cd backend && docker compose down && docker compose up -d --build

# Reset database (destructive!)
cd backend && docker compose down -v && docker compose up -d
# Then: npx prisma migrate deploy (or npx prisma db push)
```

## Port Map

```
3000 → Backend REST API (Docker)
3001 → Bridge MCP Server
3002 → Frontend Next.js Dashboard
3003 → Cowork MCP (Claude delegation)
18789 → OpenClaw WebSocket gateway
5432 → PostgreSQL (Docker, internal)
```

To check what's using a port:
```bash
lsof -i :3000 -i :3001 -i :3002 -i :3003 -P -n
```

## Environment Variables

Template: `.env.example`
Live secrets: `.env.secrets` (NEVER commit this)

Key variables:
| Variable | Used By | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | orchestrator, cowork-mcp | Claude API access |
| `OPENAI_API_KEY` | orchestrator, frontend | GPT-4o fallback + frontend chat |
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `LOB_API_KEY` | orchestrator | Physical letter sending |
| `CLAUDE_MODEL` | cowork-mcp | Override default model (defaults to claude-haiku-4-5-20251001) |
| `DEFAULT_MODEL` | orchestrator | Override orchestrator model |
| `POLL_INTERVAL_MS` | orchestrator | Bridge polling interval (default 5000) |

## Health Check Commands

Quick system-wide health check:
```bash
echo "=== PM2 ===" && pm2 list 2>&1
echo "=== Docker ===" && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "=== Ports ===" && lsof -i :3000 -i :3001 -i :3002 -i :3003 -P -n
echo "=== Bridge ===" && curl -s http://localhost:3001/health | python3 -m json.tool
echo "=== Backend ===" && curl -s http://localhost:3000/health
echo "=== Cowork ===" && curl -s http://localhost:3003/health
echo "=== OpenClaw ===" && openclaw health 2>&1
```

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Bridge not responding | PM2 process crashed | `pm2 restart bridge` |
| "EADDRINUSE" on startup | Port already in use | `lsof -i :<port>` then `kill <PID>` |
| Orchestrator not replying | Bridge is down, or API key expired | Check bridge health first, then check `.env.secrets` |
| Cowork MCP 500 errors | Missing ANTHROPIC_API_KEY | Verify `.env.secrets` has valid key |
| Docker containers gone | Docker Desktop restarted | `cd backend && docker compose up -d` |
| OpenClaw can't connect | Gateway not started | `openclaw gateway start --force` |
| Frontend build fails | Missing deps or TS errors | `cd frontend && npm install && npx next build` |
| PM2 shows "errored" | Check logs | `pm2 logs <service-name> --lines 50` |
| Database connection refused | PostgreSQL container down | `docker compose -f backend/docker-compose.yml up -d` |
| Rate limit errors (429) | Too many API calls | Orchestrator has built-in backoff; wait or increase `POLL_INTERVAL_MS` |

## Build Commands

```bash
# Backend
cd backend && npm run build

# Bridge
cd bridge && npm run build

# Frontend
cd frontend && npx next build

# Cowork MCP
cd cowork-mcp && npm run build

# Orchestrator
cd orchestrator && npm run build

# TypeScript check (all)
npx tsc --noEmit  # from each service directory
```

## Testing

```bash
# Backend (only component with tests configured)
cd backend && npm test

# Frontend lint
cd frontend && npx next lint
```

## Logs Location

PM2 logs are stored at `~/.pm2/logs/`:
- `bridge-out.log`, `bridge-error.log`
- `orchestrator-out.log`, `orchestrator-error.log`
- `frontend-out.log`, `frontend-error.log`
- `cowork-mcp-out.log`, `cowork-mcp-error.log`

## OpenClaw Operations

```bash
# Check status
openclaw status

# Start gateway
openclaw gateway start --force

# View dashboard
openclaw dashboard

# Send a task to OpenClaw's agent
openclaw agent --message "Send a summary to +1234567890 on WhatsApp" --thinking high

# Tail events
openclaw logs

# Health check
openclaw health
```
