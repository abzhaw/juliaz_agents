# 🧠 Julia — Agentic System

> **Julia** is the primary orchestrating agent. She receives goals, coordinates a network of specialised sub-agents, and maintains high-level context and decision-making. One of her core sub-agents is **OpenClaw**, her communication and channel layer.

---

## Mental Model

```
Julia  =  the brain and orchestrator
OpenClaw  =  the voice, ears, and communication layer

Together they form a single coherent agentic system.
```

---Test---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Julia — Primary Agent](#julia--primary-agent)
3. [OpenClaw — Communication Sub-Agent](#openclaw--communication-sub-agent)
4. [Invocation Flow](#invocation-flow)
5. [Backend API — The Product](#backend-api--the-product)
6. [Directory Structure](#directory-structure)
7. [Getting Started](#getting-started)
8. [For AI Agents Reading This](#for-ai-agents-reading-this)
9. [Integration Rules](#integration-rules)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         HUMAN / USER                                 │
│              sets goals · approves sensitive actions                 │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ instructs
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  JULIA — Primary Orchestrating Agent                 │
│                                                                      │
│  Built on:  Antigravity (Google's agentic CLI framework)             │
│  Skills:    .agent/skills/  (300+ SKILL.md files)                    │
│                                                                      │
│  Responsibilities:                                                   │
│  • Receives high-level goals from the user                           │
│  • Breaks goals into scoped tasks                                    │
│  • Decides which sub-agent handles each task                         │
│  • Maintains context, memory, and orchestration state               │
│  • Builds and manages the backend API (./backend/)                   │
│                                                                      │
└───────────┬──────────────────────────────────────────────────────────┘
            │
            │  Does this task need communication / channels?
            │  YES → invoke OpenClaw
            │
            │  openclaw agent --message "[scoped task]" --thinking high
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│               OPENCLAW — Communication & Channel Sub-Agent           │
│                                                                      │
│  Workspace:  ./openclaw/                                             │
│  CLI:        openclaw  (npm global, v2026.2.19-2)                    │
│  Gateway:    ws://127.0.0.1:18789                                    │
│                                                                      │
│  Owns:                                                               │
│  • WhatsApp · Telegram · Slack · Discord · WebChat integrations      │
│  • Its own gateway, agents, skills, and memory                       │
│  • Inbound event stream (user messages arriving on any channel)      │
│                                                                      │
│  Julia sees only:  inputs (task string)  +  outputs (result/events)  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
            │
            │  Returns result via stdout or WebSocket event
            ▼
       Julia continues orchestration with the result
```

---

## Julia — Primary Agent

**Framework:** Antigravity (Google's agentic CLI)  
**Skills:** `.agent/skills/` — 300+ domain-specific SKILL.md files  
**Artifacts / Plans:** `~/.gemini/antigravity/brain/<conversation-id>/`

Julia is the **conductor**. She never sends messages or manages channels directly — that is OpenClaw's job. Julia's concerns are:

- Understanding and decomposing goals
- Deciding the right sub-agent for each task
- Building and maintaining the backend API (`./backend/`)
- Passing clean, scoped instructions to sub-agents
- Synthesising results back into coherent decisions

### Key Skills Julia Uses

| Skill | Purpose |
|---|---|
| `openclaw-invoke` | How and when to call OpenClaw; invocation syntax |
| `backend-dev-guidelines` | Node/Express/TypeScript conventions |
| `prisma-expert` | DB schema and migrations |
| `docker-expert` | Container management |
| `ai-agents-architect` | Multi-agent orchestration patterns |
| `api-design-principles` | REST API design |

---

## OpenClaw — Communication Sub-Agent

**Workspace:** `./openclaw/`  
**CLI:** `openclaw` (npm global)  
**Gateway:** `ws://127.0.0.1:18789`  
**Docs:** https://docs.openclaw.ai/cli

OpenClaw is Julia's **voice and ears**. It owns everything communication-related:

| Capability | Detail |
|---|---|
| **Channels** | WhatsApp, Telegram, Slack, Discord, WebChat |
| **Inbound events** | Listens for messages arriving on any channel → triggers Julia |
| **Outbound messaging** | Sends replies and notifications on Julia's behalf |
| **Memory** | Persistent memory per conversation / contact |
| **Own agents & skills** | OpenClaw manages these internally; Julia doesn't need to know |
| **Scheduler** | Cron-based task triggering |

### Starting OpenClaw

```bash
# First-time setup
openclaw config set gateway.mode local
openclaw onboard          # interactive pairing wizard

# Standard start
openclaw gateway start
openclaw health           # → OK means ready
```

### OpenClaw CLI Reference (from Julia's perspective)

```bash
# Julia sends a task to OpenClaw
openclaw agent --message "Send a WhatsApp summary to +1234567890" --thinking high

# Julia checks gateway health before delegating
openclaw health

# Julia tails events (use when listening for inbound triggers)
openclaw logs

# Channel management
openclaw channels --help

# Memory queries
openclaw memory --help
```

---

## Invocation Flow

```
1. User gives Julia a goal
       e.g. "Send a daily summary to the team on WhatsApp at 9am"

2. Julia decomposes the goal:
       Task A: Build/fetch the summary content         → Julia handles
       Task B: Send it over WhatsApp at 9am            → OpenClaw handles

3. Julia invokes OpenClaw for Task B:
       openclaw agent \
         --message "Schedule a daily WhatsApp message to group XYZ at 09:00 with: [summary]" \
         --thinking high

4. OpenClaw executes:
       → Uses its own skills and gateway internals
       → Sends the message via its WhatsApp channel integration
       → Returns success/failure to Julia via stdout

5. Julia receives the result and continues orchestration.
```

### Inbound Event Flow (OpenClaw → Julia)

```
User sends a WhatsApp message
    └── OpenClaw gateway receives it
        └── Emits event on ws://127.0.0.1:18789
            └── Julia (listening on WebSocket) receives the event
                └── Julia decides how to respond / what task to trigger
                    └── Julia may invoke OpenClaw again to reply
```

---

## Backend API — The Product

**Location:** `./backend/`

The primary software artifact Julia is building. A REST API for task management.

| Tech | Role |
|---|---|
| Node.js + Express + TypeScript | HTTP server |
| Prisma ORM | Database access |
| PostgreSQL 15 | Data store |
| Docker Compose | Orchestration |
| Vitest | Tests |

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/tasks` | List tasks |
| `POST` | `/tasks` | Create task `{ title }` |
| `PATCH` | `/tasks/:id` | Update task `{ title?, completed? }` |
| `DELETE` | `/tasks/:id` | Delete task |

### Running

```bash
cd backend
docker compose up -d     # starts DB + API on port 3000
npm test                 # run test suite
```

---

## Directory Structure

```
juliaz_agents/
│
├── README.md                          ← You are here
├── .env.secrets                       ← API keys (never commit)
│
├── backend/                           ← Product Julia is building
│   ├── src/index.ts                   ← Express entry point
│   ├── prisma/schema.prisma           ← DB schema
│   ├── prisma/migrations/
│   ├── tests/
│   ├── docs/plans/                    ← Julia's design plans
│   ├── docker-compose.yml
│   └── EXPORT.md                      ← Deployment guide
│
├── openclaw/                          ← OpenClaw agent workspace
│   ├── config.yaml                    ← Access control rules
│   ├── MEMORY.md                      ← Agent context
│   └── sessions/                      ← Session logs
│
├── thesis/                            ← Master thesis agent workspace
│   ├── config.yaml                    ← Access control (read-only research_papers/)
│   ├── MEMORY.md                      ← Thesis agent identity & rules
│   ├── research_papers/               ← Drop PDFs / notes here (agent reads only)
│   ├── drafts/                        ← Agent-written sections (human reviews)
│   └── documentation/
│       └── project_log.md             ← Running log of everything built
│
└── .agent/
    └── skills/                        ← Julia's skill library (300+)
        ├── openclaw-gateway/          ← How Julia invokes OpenClaw
        ├── thesis-research/           ← Summarise papers from research_papers/
        ├── thesis-writer/             ← Draft thesis sections to drafts/
        ├── thesis-log/                ← Append entries to project_log.md
        └── ...
```

---

## Getting Started

### Prerequisites
- Node.js 18+, npm, Docker
- `npm i -g openclaw`

### 1. Start the Backend (Product API)
```bash
cd backend && docker compose up -d
```

### 2. Start OpenClaw (Communication Layer)
```bash
openclaw config set gateway.mode local
openclaw onboard        # first time only
openclaw gateway start
openclaw health
```

### 3. Julia is the AI agent in the IDE
Julia (running as Antigravity) is active when you open this workspace in your IDE. She reads skills from `.agent/skills/` automatically.

---

## For AI Agents Reading This

### If you are Julia:
- You are the orchestrator. You own coding tasks and goal decomposition.
- For **any communication task** (sending/receiving messages on any channel): delegate to OpenClaw.
- Invoke OpenClaw with: `openclaw agent --message "[scoped instruction]" --thinking high`
- Never vague-dump a high-level goal to OpenClaw — pass specific, scoped tasks.
- Listen on `ws://127.0.0.1:18789` to receive inbound events from OpenClaw.
- Check the `openclaw-gateway` skill before every OpenClaw invocation.

### If you are OpenClaw (or an OpenClaw sub-agent):
- You handle communication and channel management. That is your entire scope.
- You receive scoped task strings from Julia and return results via stdout/WebSocket.
- Do not attempt to write to `backend/` or modify `.agent/skills/`.
- Your configuration and workspace is `./openclaw/`.

---

## Integration Rules

1. **Julia never bypasses OpenClaw for communication tasks** — OpenClaw owns that layer.
2. **Julia passes scoped instructions to OpenClaw** — not vague high-level goals.
3. **OpenClaw's internals are opaque to Julia** — Julia only sees inputs and outputs.
4. **The WebSocket is the event bus** — Julia listens on `ws://127.0.0.1:18789` for inbound triggers.
5. **Never commit `.env.secrets`** — it contains live API keys.
6. **Never modify `.agent/skills/`** without explicit user instruction.
7. **Always run tests after backend changes**: `cd backend && npm test`

---

*Last updated: 2026-02-21 · Julia — Agentic System (juliaz_agents)*
