# 🏗️ Julia's Agent System — Build Workspace

> **You are here:** This is the workspace for **Antigravity** — the IDE agent building Julia.  
> **Julia** is the multi-agent system being built. Antigravity (the AI in your IDE) is the one building it.

---

## Mental Model

```
Antigravity  =  the builder (IDE agent — that's me, the AI in your editor)
Julia        =  the product being built (a multi-agent platform)

Together, this workspace contains both what is being built (Julia)
and the AI assistant doing the building (Antigravity).
```

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The 4 Components](#the-4-components)
3. [What Runs in Docker](#what-runs-in-docker)
4. [What Stays on the Mac](#what-stays-on-the-mac)
5. [Invocation Flow](#invocation-flow)
6. [Backend API — The Product](#backend-api--the-product)
7. [Directory Structure](#directory-structure)
8. [Getting Started](#getting-started)
9. [For AI Agents Reading This](#for-ai-agents-reading-this)
10. [Integration Rules](#integration-rules)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         DEVELOPER (Raphael)                          │
│              gives goals · reviews outputs · approves actions        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│              ANTIGRAVITY — IDE Agent (the builder)                   │
│                                                                      │
│  Lives:     Inside this IDE (not in any container)                   │
│  Skills:    .agent/skills/  (300+ SKILL.md files)                    │
│  Role:      Writes, debugs, configures, and ships Julia              │
│                                                                      │
└───────────┬──────────────────────────────────────────────────────────┘
            │ builds and manages
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                JULIA — The Multi-Agent System (the product)          │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  FRONTEND — Command Center Dashboard      [NEXT.JS]         │   │
│   │  Location:   ./frontend/                                    │   │
│   │  Port:       3002                                           │   │
│   │  Stack:      Next.js 15 + Tailwind + Framer Motion          │   │
│   └──────────────────────┬──────────────────────────────────────┘   │
│                           │ interacts with                           │
│   ┌──────────────────────▼──────────────────────────────────────┐   │
│   │  BRIDGE — MCP Glue Server                                   │   │
│   │  Location:   ./bridge/                                      │   │
│   │  Port:       3001                                           │   │
│   │  Role:       connects Agents ↔ UI                           │   │
│   └──────────────────────┬──────────────────────────────────────┘   │
│                           │ and                                      │
│   ┌──────────────────────▼──────────────────────────────────────┐   │
│   │  BACKEND — REST API Product           [DOCKER]              │   │
│   │  Location:   ./backend/                                     │   │
│   │  Port:       3000                                           │   │
│   │  Role:       Persistence (Tasks, Logs, System State)        │   │
│   └──────────────────────┬──────────────────────────────────────┘   │
│                           │ updated by                               │
│   ┌──────────────────────▼──────────────────────────────────────┐   │
│   │  ORCHESTRATOR — Agent Intelligence                          │   │
│   │  Location:   ./orchestrator/                                │   │
│   │  Role:       Thinks, Polls Bridge, Writes Backend Logs      │   │
│   └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## The 5 Components

| Component | What it is | Where it runs |
|---|---|---|
| **Frontend (`frontend/`)** | Next-Gen Next.js 15 Dashboard | MacBook — port 3002 |
| **Bridge (`bridge/`)** | MCP glue server connecting Agents ↔ UI | MacBook — port 3001 |
| **Backend (`backend/`)** | REST API with Postgres persistence | Docker Compose — port 3000 |
| **Orchestrator** | Julia's primary "brain" (Loop + AI) | MacBook — independent process |
| **OpenClaw** | Communication gateway (Telgram, etc.) | MacBook — local CLI |

---

## What Runs in Docker

**Only `backend/`** — a REST API built with Express + PostgreSQL via Prisma.  
This is the *application being built*, not the agent infrastructure.

```bash
cd backend && docker compose up -d
# Starts:
#   API server  → http://localhost:3000
#   PostgreSQL  → localhost:5432
```

---

## What Stays on the Mac (No Docker)

The agent infrastructure runs natively:

- **Antigravity** — lives inside the IDE; cannot be containerized
- **OpenClaw** — needs local CLI access, certs, and WebSocket; must run native
- **Bridge** — ~200-line Node.js server; no reason to containerize

---

## Invocation Flow

### OpenClaw → Bridge → Orchestration (inbound message)

```
Telegram user sends a message
    └── OpenClaw gateway receives it (ws://127.0.0.1:18789)
        └── OpenClaw uses julia-relay skill:
            POST http://localhost:3001/incoming  { chatId, text, ... }
                └── Bridge stores message in queue
                    └── Orchestration reads via MCP tool: telegram_get_pending_messages
                        └── Processes, then calls MCP tool: telegram_send_reply
                            └── Bridge stores reply
                                └── OpenClaw polls GET /pending-reply/:chatId
                                    └── Delivers reply to Telegram user
```

### OpenClaw CLI Reference

```bash
# Check gateway health
openclaw health

# Start gateway
openclaw gateway start

# Send a task to OpenClaw's agent
openclaw agent --message "Send a summary to +1234567890 on WhatsApp" --thinking high

# Tail events
openclaw logs
```

---

## Backend API — The Product

**Location:** `./backend/`

| Tech | Role |
|---|---|
| Node.js + Express + TypeScript | HTTP server |
| Prisma ORM | Database access |
| PostgreSQL 15 | Data store |
| Docker Compose | Container orchestration |
| Vitest | Tests |

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/tasks` | List tasks |
| `POST` | `/tasks` | Create task `{ title }` |
| `PATCH` | `/tasks/:id` | Update task `{ title?, completed? }` |
| `DELETE` | `/tasks/:id` | Delete task |

---

## Directory Structure

```
juliaz_agents/
│
├── README.md                          ← You are here
├── .env.secrets                       ← API keys (never commit)
│
├── backend/                           ← [DOCKER] REST API being built
│   ├── src/index.ts                   ← Express entry point
│   ├── prisma/schema.prisma           ← DB schema
│   ├── prisma/migrations/
│   ├── tests/
│   ├── docker-compose.yml
│   └── EXPORT.md                      ← Deployment guide
│
├── bridge/                            ← MCP bridge (local, port 3001)
│   ├── src/index.ts                   ← Express + MCP server
│   ├── data/queue.json                ← Message queue (persisted)
│   └── README.md
│
├── openclaw/                          ← OpenClaw agent workspace
│   ├── AGENTS.md                      ← Agent rules and identity
│   ├── SOUL.md                        ← Personality and values
│   ├── HEURISTICS.md                  ← Self-learned rules
│   ├── skills/
│   │   ├── julia-relay/               ← How OpenClaw forwards to bridge
│   │   ├── openclaw-self-manage/      ← Health check + restart
│   │   └── openclaw-troubleshoot/     ← Diagnostic decision tree
│   └── memory/
│
├── docs/                              ← Plain-language documentation
│   ├── agent_system_overview.md       ← Full non-technical guide
│   └── agent_cards/                   ← One-page card per component
│       ├── julia.md
│       ├── openclaw.md
│       ├── thesis_agent.md
│       └── docs_agent.md
│
├── thesis/                            ← Thesis agent workspace
│   ├── research_papers/               ← Drop PDFs here (read-only)
│   ├── drafts/                        ← Agent-written sections
│   └── documentation/
│
└── .agent/
    └── skills/                        ← Antigravity's skill library (300+)
```

---

## Getting Started

### Prerequisites
- Node.js 18+, npm, Docker
- `npm i -g openclaw`

### 1. Start the Backend (Dockerized REST API)
```bash
cd backend && docker compose up -d
```

### 2. Start the Bridge (MCP glue server)
```bash
cd bridge && npm run dev
# Or for persistent background: pm2 start npm --name bridge -- run dev
```

### 3. Start OpenClaw (Communication Layer)
```bash
openclaw config set gateway.mode local
openclaw onboard        # first time only
openclaw gateway start
openclaw health
```

### 4. Antigravity (IDE Agent)
Antigravity is active automatically when this workspace is open in your IDE.

---

## For AI Agents Reading This

### If you are Antigravity (the IDE agent):
- You are the **builder**. Julia is what you build.
- Your job: write, debug, configure, and ship all Julia components.
- For communication tasks, configure/invoke OpenClaw — don't do it yourself.
- When something is broken, diagnose it. When something needs building, build it.

### If you are an OpenClaw sub-agent:
- Your scope is communication and channel management only.
- Use the `julia-relay` skill to forward messages to the bridge.
- Do not write to `backend/` or `.agent/skills/`.
- Your workspace is `./openclaw/`.

---

## Integration Rules

1. **Bridge must be running** for OpenClaw ↔ orchestration to work (`port 3001`)
2. **OpenClaw stays native** — never containerize it
3. **Backend stays in Docker** — it's isolated by design
4. **Never commit `.env.secrets`** — it contains live API keys
5. **Tests after every backend change**: `cd backend && npm test`
6. **Never modify `.agent/skills/`** without explicit user instruction

---

## Current Known Issues

| Issue | Fix |
|---|---|
| Bridge is stopped | `cd bridge && npm run dev` |
| Julia has no MCP tools | Add bridge to Antigravity's MCP config (`http://localhost:3001/mcp`) |

---

*Last updated: 2026-02-21 · Maintained by Antigravity*
