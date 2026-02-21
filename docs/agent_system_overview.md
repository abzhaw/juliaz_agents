# The Julia System — A Plain-Language Guide

> **Who this is for**: Anyone who wants to understand this project without needing to be a software developer.  
> **Maintained by**: The Docs Agent — updated whenever the system changes.  
> **Last updated**: 2026-02-21

---

## What is this project?

This project is called **Julia's Agent System** (`juliaz_agents`). It has two layers:

1. **Antigravity** — the AI assistant embedded in the developer's code editor, responsible for *building* Julia
2. **Julia** — the multi-agent platform being built, made up of several cooperating components

Think of it like a construction project:
- **Antigravity** is the architect and construction crew
- **Julia** is the building being constructed

---

## The Big Picture

```
Developer (Raphael)
    │
    │  gives goals and instructions
    ▼
Antigravity  ─────────────────────  The Builder (lives in the IDE)
    │                               Writes code, configures systems,
    │                               diagnoses problems, ships Julia
    │
    │  builds and manages ↓
    ▼
Julia (the product being built)
    │
    ├──▶  OpenClaw  ─────────────── The Messenger
    │         Telegram, WhatsApp, Slack, Discord
    │
    ├──▶  Bridge  ──────────────── The Glue
    │         MCP server connecting OpenClaw to the rest
    │
    └──▶  Backend API  ───────────  The Application
               REST API running in Docker
```

---

## The Components, One by One

### 🔧 Antigravity — The Builder

Antigravity is the AI agent living inside the developer's code editor (IDE). It is *not* Julia — it is the tool used to build Julia. When the developer opens this workspace, Antigravity is active and ready to write code, debug problems, and configure systems.

**What Antigravity does:**
- Writes and debugs code across all Julia components
- Configures the bridge, OpenClaw, and backend
- Keeps the architecture clean and the components clearly separated
- Diagnoses problems and fixes them

**What Antigravity is NOT:**
- Antigravity is not Julia
- Antigravity is not a communication agent
- Antigravity does not send Telegram or WhatsApp messages

---

### 📡 OpenClaw — The Messenger

OpenClaw is Julia's **communication layer**. It connects Julia to external messaging apps — Telegram, WhatsApp, Slack, Discord. When you send a message via Telegram, OpenClaw receives it first, then forwards it through the bridge so the system can respond.

**Analogy**: OpenClaw is like a telephone switchboard operator. Calls come in, the operator routes them. Calls go out, the operator places them.

**What OpenClaw can do:**
- Receive messages from Telegram (and other apps)
- Forward messages to the bridge for processing
- Deliver replies back to users
- Remember past conversations per contact
- Check its own health and log activity

**What OpenClaw cannot do:**
- Make decisions or generate intelligent replies on its own — it relays and routes
- Write code, modify the backend, or change the system

**Current setup:**
- Telegram is connected ✅
- Runs natively on the Mac (not in Docker)
- Security: only approved users can talk to the bot

---

### 🔌 Bridge — The Glue (MCP Server)

The bridge is a small Node.js server (`./bridge/`, port 3001) that connects OpenClaw to the orchestration layer. It exposes:
- A **REST API** that OpenClaw posts messages to (`POST /incoming`)
- An **MCP endpoint** that the orchestration layer can call tools on (`/mcp`)
- A **polling endpoint** that OpenClaw checks for replies (`GET /pending-reply/:chatId`)

**Analogy**: The bridge is like a shared whiteboard. OpenClaw writes incoming messages on the whiteboard. The orchestration picks them up, processes them, and writes replies back. OpenClaw then reads the replies and delivers them.

**What the bridge does:**
- Buffers messages between OpenClaw and the processing layer
- Exposes MCP tools: `telegram_get_pending_messages`, `telegram_send_reply`, `telegram_bridge_status`
- Persists the message queue to disk (`data/queue.json`)

**Current state:**
- ⚠️ The bridge is currently **stopped** — it needs to be started

---

### 🖥️ Backend API — The Application

The backend (`./backend/`) is a REST API for task management. This is the *application Julia is building* — the deliverable product. It runs in Docker and is fully separate from the agent infrastructure.

**Technology:**
- Node.js + Express + TypeScript — the HTTP server
- PostgreSQL — the database
- Prisma — database access layer
- Docker Compose — container orchestration

**What it does:**
- Create, list, update, and delete tasks
- Expose a `/health` endpoint

**How to start it:**
```bash
cd backend && docker compose up -d
```

---

## What Runs Where

| Component | Location | Runs in Docker? |
|---|---|---|
| Antigravity | Inside the IDE | ❌ No — lives in the editor |
| OpenClaw | Mac, local CLI | ❌ No — must run native |
| Bridge | Mac, port 3001 | ❌ No — tiny local server |
| Backend API | Docker | ✅ Yes — API + PostgreSQL |

---

## How a Message Flows Through the System

```
1. You send a Telegram message
2. OpenClaw receives it on its gateway
3. OpenClaw uses the julia-relay skill:
      → POST http://localhost:3001/incoming
4. Bridge stores the message in its queue
5. Orchestration calls MCP tool: telegram_get_pending_messages
6. Orchestration processes the message and replies via:
      → MCP tool: telegram_send_reply
7. Bridge stores the reply
8. OpenClaw polls GET /pending-reply/:chatId → gets the reply
9. OpenClaw sends the reply back to you on Telegram
```

---

## Current Known Issues

| Issue | Status | Fix |
|---|---|---|
| Bridge is stopped | ⚠️ Active | `cd bridge && npm run dev` |
| MCP tools not registered | ⚠️ Active | Add bridge URL to Antigravity MCP config |

---

## Glossary

| Term | Plain-language explanation |
|---|---|
| **Agent** | An AI assistant with a specific job and set of abilities |
| **Antigravity** | The IDE AI that builds Julia — not the same thing as Julia |
| **Julia** | The multi-agent system being built — the product |
| **Skill** | A document that teaches an agent how to do a specific task |
| **MCP** | Model Context Protocol — a standard way for AI tools to expose capabilities |
| **Bridge** | The small server connecting OpenClaw to the rest of Julia |
| **API** | A service that software programs can talk to |
| **Docker** | A tool that packages software so it runs consistently on any machine |
| **PostgreSQL** | A database for storing structured data |
| **WebSocket** | A way for two programs to stay connected and talk in real time |
| **Gateway** | OpenClaw's central hub that routes all channel messages |

---

*This document is maintained by the Docs Agent and updated when the system changes. Last updated: 2026-02-21.*
