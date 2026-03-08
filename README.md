# Julia's Agent System -- Build Workspace

> **You are here:** This is the workspace for **Antigravity** -- the IDE agent building Julia.
> **Julia** is the multi-agent system being built. Antigravity (the AI in your IDE) is the one building it.

---

## Mental Model

```
Raphael (human)  -->  Antigravity (IDE agent / builder)  -->  Julia (the product being built)
```

- **Antigravity** = the AI in the IDE (Claude Code / Cowork) that builds Julia
- **Julia** = the multi-agent system being built
- **OpenClaw** = communication gateway (Telegram, WhatsApp, etc.)

---

## 3-System Architecture

The repository is organized into three systems:

```
juliaz_agents/
|-- julia/          USER-SYSTEM      The product users interact with
|-- meta/           META-SYSTEM      Development, maintenance, documentation
|-- thesis/         THESIS-SYSTEM    Master's thesis research and writing
```

### julia/ -- User-System (the product)

| Component | Location | Port | Stack | Role |
|-----------|----------|------|-------|------|
| **Frontend** | `julia/frontend/` | 3002 | Next.js 15 + Tailwind + Framer Motion | Dashboard UI with AI chat |
| **Bridge** | `julia/bridge/` | 3001 | Express + MCP (streamable HTTP) | Message hub connecting agents and UI |
| **Backend** | `julia/backend/` | 3000 | Express + Prisma + PostgreSQL (Docker) | REST API for persistence |
| **Orchestrator** | `julia/orchestrator/` | -- | Claude Haiku + GPT-4o fallback | Julia's brain, polls bridge, generates replies |
| **Cowork MCP** | `julia/cowork-mcp/` | 3003 | MCP server wrapping Anthropic API | Claude delegation (6 tools) |
| **OpenClaw** | `julia/openclaw/` | -- | `openclaw` CLI (npm global) | Telegram gateway |

### meta/ -- Meta-System (development and maintenance)

| Component | Location | Schedule | Role |
|-----------|----------|----------|------|
| **ADHD Agent** | `meta/agents/adhd-agent/` | every 4h (LaunchAgent) | System hygiene, structural drift detection |
| **Health Checker** | `meta/agents/health-checker/` | every 15min (PM2 cron) | Service monitoring, auto-healing |
| **Sentinel** | `meta/agents/security-agent/` | daily 07:00 (PM2 cron) | Security scanning, dependency auditing |
| **Docs Agent** | `meta/agents/docs-agent/` | every 12h (PM2 cron) | Documentation drift detection |
| **Task Manager** | `meta/agents/task-manager/` | every 6h (PM2 cron) | Task queue integrity |
| **Architecture Agent** | `meta/agents/architecture-agent/` | every 6h (PM2 cron) | System topology scanning |
| **Documentation** | `meta/docs/` | -- | Agent cards, system overview, guides |

### thesis/ -- Thesis-System (research and academic)

| Component | Location | Role |
|-----------|----------|------|
| **Thesis Agent** | `thesis/agents/thesis-agent/` | Academic writing partner |
| **LaTeX source** | `thesis/latex/` | Thesis document |
| **Research papers** | `thesis/research_papers/` | Source material |
| **Documentation** | `thesis/documentation/` | Project logs |

---

## What Runs Where

| Component | Runtime |
|-----------|---------|
| Backend (PostgreSQL + API) | Docker Compose -- port 3000 |
| Frontend, Bridge, Orchestrator, Cowork MCP | PM2 -- ports 3001-3003 |
| Ambient agents (Sentinel, Health Checker, etc.) | PM2 cron schedules |
| ADHD Agent | macOS LaunchAgent |
| OpenClaw | CLI process |
| Antigravity | IDE (Claude Code) |

---

## Message Flow (Telegram to Julia to Reply)

```
Telegram user sends message
  --> OpenClaw gateway receives it (ws://127.0.0.1:18789)
    --> OpenClaw POSTs to bridge: POST http://localhost:3001/incoming
      --> Bridge stores in queue.json (state: pending)
        --> Orchestrator polls via MCP: telegram_get_pending_messages
          --> Orchestrator generates reply (Claude Haiku, GPT-4o fallback)
            --> Orchestrator calls MCP: telegram_send_reply
              --> OpenClaw polls GET /pending-reply/:chatId
                --> OpenClaw delivers to Telegram
```

---

## Directory Structure

```
juliaz_agents/
|-- julia/                              # USER-SYSTEM
|   |-- frontend/                       #   Dashboard UI (port 3002)
|   |-- backend/                        #   REST API + PostgreSQL (port 3000)
|   |-- bridge/                         #   Message hub MCP (port 3001)
|   |-- orchestrator/                   #   Julia's brain (Claude + GPT-4o)
|   |-- cowork-mcp/                     #   Claude delegation server (port 3003)
|   +-- openclaw/                       #   Telegram gateway
|
|-- meta/                               # META-SYSTEM
|   |-- agents/                         #   Ambient maintenance agents
|   |   |-- adhd-agent/                 #     System hygiene (every 4h)
|   |   |-- health-checker/             #     Service monitoring (every 15min)
|   |   |-- security-agent/             #     Security scanning (daily 07:00)
|   |   |-- docs-agent/                 #     Documentation drift (every 12h)
|   |   |-- task-manager/               #     Task queue integrity (every 6h)
|   |   +-- architecture-agent/         #     Topology scanning (every 6h)
|   |-- docs/                           #   System documentation + agent cards
|   |-- logs/                           #   System logs
|   |-- config/                         #   LaunchAgent plists
|   +-- todo/                           #   Task tracking
|
|-- thesis/                             # THESIS-SYSTEM
|   |-- agents/thesis-agent/            #   Academic writing partner
|   |-- latex/                          #   LaTeX thesis source
|   |-- documentation/                  #   Project logs
|   |-- research_papers/                #   Source PDFs
|   +-- memory/                         #   Session buffers
|
|-- shared-findings/                    # Cross-system communication
|-- .claude/                            # Claude Code skills + config
|-- CLAUDE.md                           # Project instructions
|-- ecosystem.config.js                 # PM2 production config
|-- ecosystem.dev.config.js             # PM2 development config
|-- start-system.sh                     # Boot startup script (9 stages)
+-- .env.secrets                        # API keys (never commit)
```

---

## Getting Started

### Prerequisites
- Node.js 18+, npm, Docker Desktop
- `npm i -g openclaw pm2`

### Quick Start

```bash
# 1. Backend (Docker -- must be first)
cd julia/backend && docker compose up -d

# 2. All PM2 services
pm2 start ecosystem.dev.config.js

# 3. OpenClaw gateway
openclaw gateway start --force
```

Or use the auto-start script: `./start-system.sh` (runs on macOS login via LaunchAgent).

### Ports

```
3000  Backend REST API (Docker)
3001  Bridge MCP Server
3002  Frontend Dashboard
3003  Cowork MCP (Claude delegation)
18789 OpenClaw WebSocket gateway
5432  PostgreSQL (Docker, internal)
```

---

## Process Supervision

All services are managed via PM2. Two configs are provided:

| Config | Command | Use case |
|--------|---------|----------|
| `ecosystem.dev.config.js` | `pm2 start ecosystem.dev.config.js` | Development (`npm run dev`) |
| `ecosystem.config.js` | `pm2 start ecosystem.config.js` | Production (`npm run start`) |

```bash
pm2 list          # Status of all services
pm2 logs          # Tail all logs
pm2 restart all   # Restart everything
pm2 stop all      # Stop everything
```

---

## For AI Agents Reading This

### If you are Antigravity (the IDE agent):
- You are the **builder**. Julia is what you build.
- Your job: write, debug, configure, and ship all Julia components.
- For communication tasks, configure/invoke OpenClaw -- don't do it yourself.

### If you are an OpenClaw sub-agent:
- Your scope is communication and channel management only.
- Use the `julia-relay` skill to forward messages to the bridge.
- Your workspace is `julia/openclaw/`.

---

## Integration Rules

1. **Bridge must be running** for OpenClaw <-> orchestration to work (port 3001)
2. **Backend stays in Docker** -- it's isolated by design
3. **Never commit `.env.secrets`** -- it contains live API keys
4. **Tests after backend changes**: `cd julia/backend && npm test`

---

*Last updated: 2026-03-08*
