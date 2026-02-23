# The Julia System — A Plain-Language Guide

> **Who this is for**: Anyone who wants to understand this project without needing to be a software developer.
> **Maintained by**: The Docs Agent — updated whenever the system changes.
> **Last updated**: 2026-02-23 (Update 4 — Sentinel wired into PM2 + boot)

---

## What is this project?

This project is called **Julia's Agent System** (`juliaz_agents`). It has two layers:

1. **Antigravity** — the AI assistant embedded in the developer's code editor, responsible for *building* Julia
2. **Julia** — the multi-model agent platform being built, made up of several cooperating components

Think of it like a construction project:
- **Antigravity** is the architect and construction crew
- **Julia** is the building being constructed

Julia is a **multi-model** system: her primary brain runs on GPT-4o (OpenAI), and she delegates complex tasks to Claude (Anthropic) via the Cowork MCP server. This makes her model-agnostic — she routes work to whichever AI is best suited.

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
    ├──▶  Orchestrator  ───────────  The Brain (GPT-4o + tool calling)
    │         Processes messages, delegates, decides
    │
    ├──▶  Cowork MCP  ─────────────  The Second Brain (Claude)
    │         Complex reasoning, code review, writing — port 3003
    │
    ├──▶  OpenClawJulia  ──────────  The Messenger
    │         Telegram, WhatsApp, Slack, Discord
    │
    ├──▶  Bridge  ─────────────────  The Glue (MCP server — port 3001)
    │         Message queue connecting OpenClaw ↔ Orchestrator
    │
    ├──▶  Backend API  ────────────  The Application (port 3000)
    │         REST API + PostgreSQL, runs in Docker
    │
    └──▶  Frontend  ───────────────  The Dashboard (port 3002)
              Next.js 15 user interface
```

---

## The Chatbot Interface

Users interact with Julia primarily through **Telegram** (and eventually WhatsApp, Slack, Discord). When you send Julia a message, this is what happens behind the scenes:

```
1. You send a Telegram message
2. OpenClaw receives it on its gateway (ws://127.0.0.1:18789)
3. OpenClaw uses the julia-relay skill:
      → POST http://localhost:3001/incoming
4. Bridge stores the message in its queue
5. Orchestrator polls via MCP: telegram_get_pending_messages
6. Orchestrator processes with GPT-4o (tool-calling loop)
7. If complex → delegates to Cowork MCP (Claude via POST localhost:3003/task)
8. Orchestrator calls MCP: telegram_send_reply
9. Bridge stores the reply
10. OpenClaw polls GET /pending-reply/:chatId → gets the reply
11. OpenClaw sends the reply back to you on Telegram
```

The chatbot IS Julia. Every skill, every MCP tool, every sub-agent — Julia can use all of them when responding to your messages. See `SKILLS_OVERVIEW.md` and `MCP_OVERVIEW.md` for the full list.

---

## The Components, One by One

### 🧠 Orchestrator — The Brain

The orchestrator (`./orchestrator/`) is Julia's central intelligence. It receives messages from the bridge, decides how to handle them, calls tools, delegates to sub-agents, and sends replies back. It runs GPT-4o as its primary AI and can delegate to Claude via the Cowork MCP.

**What the orchestrator does:**
- Receives and processes all incoming messages
- Decides whether a message is a user conversation or a system-dev request
- Calls MCP tools on the bridge and Cowork MCP
- Manages per-contact conversation memory
- Activates special modes (Wish Companion) when appropriate

**What the orchestrator is NOT:**
- It is not the communication layer — OpenClaw handles that
- It does not run persistently in Docker — it runs via PM2

---

### 🤖 Cowork MCP — The Second Brain (Claude)

The Cowork MCP server (`./cowork-mcp/`, port 3003) wraps the Anthropic Claude API as MCP tools. This gives Julia a second AI brain for tasks where Claude excels: complex reasoning, code review, long-form writing, multimodal analysis.

**Available tools:** `claude_task`, `claude_multimodal_task`, `claude_code_review`, `claude_summarize`, `claude_brainstorm`, `cowork_status`

**Analogy**: If the orchestrator (GPT-4o) is the general-purpose thinker, Cowork MCP (Claude) is the specialist consultant called in for specific expertise.

---

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

### 📡 OpenClawJulia — The Messenger

OpenClaw (now upgraded to **OpenClawJulia**) is Julia's **communication layer**. It connects Julia to external messaging apps — Telegram, WhatsApp, Slack, Discord. In this updated role, it also acts as an extension of Julia herself, capable of managing tools like code execution, terminal access (`tmux`), and knowledge retrieval.

**Analogy**: OpenClaw is like a telephone switchboard operator. Calls come in, the operator routes them. Calls go out, the operator places them.

**What OpenClawJulia can do:**
- Receive messages from Telegram (and other apps)
- Forward messages to the bridge for processing
- Deliver replies back to users
- **Run code** and manage terminal sessions via `tmux`
- **Access Notion** and other external knowledge bases
- **Query the Oracle** for architectural/domain knowledge
- **Send emails** via 1Password CLI integration
- **Self-manage** and troubleshoot its own gateway problems
- Remember past conversations per contact

**What OpenClaw cannot do:**
- Make decisions or generate intelligent replies on its own — it relays and routes
- Write code, modify the backend, or change the system

**Current setup:**
- Telegram is connected ✅
- Runs natively on the Mac (as a persistent **LaunchAgent**)
- **Always Running**: This component must be active for the entire agentic system to function. If stopped, use `openclaw gateway start --force`.
- **Official Dashboard**: Accessible via `openclaw dashboard` (official UI for channel management and agent logs).
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

---

### 🖥️ Backend API — The Application

The backend (`./backend/`) is a REST API for task management. This is the *application Julia is building* — the deliverable product. It runs in Docker and is fully separate from the agent infrastructure.

**Technology:** Node.js + Express + TypeScript, PostgreSQL, Prisma, Docker Compose

**What it does:** Create, list, update, and delete tasks. Expose a `/health` endpoint.

**How to start it:**
```bash
cd backend && docker compose up -d
```

---

### 🌐 Frontend — The Dashboard

The frontend (`./frontend/`, port 3002) is a Next.js 15 web application serving as Julia's user-facing command center.

**Technology:** Next.js 15 + Tailwind CSS + Framer Motion

---

## The Ambient Agents

In addition to the core components above, Julia has four **ambient agents** — autonomous background processes that keep the system healthy, secure, and organized without manual intervention.

### 🔐 Sentinel — The Security Scanner

Sentinel (`security-agent/`) is Julia's immune system. It runs every morning at 07:00 and once at boot, scanning the entire system for security issues: open ports, leaked credentials, npm vulnerabilities, Docker misconfigurations, suspicious network connections, and more.

It produces a daily Markdown report and sends a Telegram summary to Raphael. Sentinel is self-learning — it tracks what changed between scans, suppresses known-accepted findings, and improves its heuristics over time.

**Schedule**: PM2 cron daily at 07:00 + boot scan via `start-system.sh`
**10 scanning skills**: port scan, network audit, credential audit, dependency audit, process audit, log analysis, Docker security, API security, OpenClaw security, self-learning

### ⚙️ Health Checker — The Watchdog

The Health Checker (`health-checker/`) runs every 15 minutes and verifies that every service, ambient agent, and scheduled process is alive. If a PM2 process is simply stopped, it auto-restarts it. If something is errored or down, it alerts Raphael via Telegram.

**Schedule**: PM2 cron every 15 minutes

### 📋 Task Manager — The Project Keeper

The Task Manager (`task-manager/`) monitors the shared TODO queue (`todo/`) for integrity issues: stale tasks, circular dependencies, tasks blocked by resolved dependencies. It produces weekly summaries on Mondays.

**Schedule**: PM2 cron every 6 hours

### 🧹 ADHD Agent — The Hygiene Scanner

The ADHD Agent (`adhd-agent/`) scans for structural drift: duplicate skills, orphaned agents, dead files, overlapping triggers. It proposes fixes via Telegram and waits for approval before acting.

**Schedule**: macOS LaunchAgent every 4 hours

---

## The Agents

Julia's system includes multiple cooperating agents, each with a distinct role:

| Agent | Role | Status |
|---|---|---|
| **Antigravity** | IDE builder — writes code, ships Julia | ✅ Active |
| **Julia (Orchestrator)** | Primary brain — conversation, tool-calling, delegation | ✅ Active |
| **OpenClawJulia** | Communication gateway — Telegram routing | ✅ Active |
| **Cowork Claude** | Claude sub-agent — complex reasoning via MCP | ✅ Active |
| **Docs Agent** | System documentation — keeps docs/ updated | ✅ Active |
| **ADHD Agent** | System hygiene — scans for structural drift | ✅ Autonomous (LaunchAgent, 4h) |
| **Sentinel (Security)** | Daily security scanning + self-learning | ✅ Autonomous (PM2 cron, 07:00) |
| **Task Manager** | Project management — TODO queue integrity | ✅ Autonomous (PM2 cron, 6h) |
| **Health Checker** | System watchdog — monitors all services | ✅ Autonomous (PM2 cron, 15min) |
| **Thesis Agent (Schreiber)** | Research/writing — master's thesis support | 🟡 Manual (on-demand) |
| **Julia Medium** | Ambient researcher — article drafting | 🟡 Manual (on-demand) |
| **Wish Companion** | Special mode — end-of-life wish fulfillment | ✅ Embedded in Julia |

For the full skill and tool inventory, see:
- `SKILLS_OVERVIEW.md` — every skill Julia can use
- `MCP_OVERVIEW.md` — every MCP server and its tools

---

## What Runs Where

| Component | Location | Port | Runs in Docker? |
|---|---|---|---|
| Antigravity | Inside the IDE | — | ❌ No — lives in the editor |
| Orchestrator | `orchestrator/` | — | ❌ No — PM2 managed |
| OpenClaw | Mac, local CLI | 18789 (WS) | ❌ No — persistent LaunchAgent |
| Bridge | `bridge/` | 3001 | ❌ No — tiny local server |
| Cowork MCP | `cowork-mcp/` | 3003 | ❌ No — local MCP server |
| Backend API | `backend/` | 3000 | ✅ Yes — API + PostgreSQL |
| Frontend | `frontend/` | 3002 | ❌ No — Next.js dev server |

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
| **Julia** | The multi-model agent system being built — the product |
| **Orchestrator** | Julia's brain — receives messages, decides what to do, calls tools |
| **Multi-model** | Using more than one AI model (GPT-4o + Claude) for different strengths |
| **Skill** | A document that teaches an agent how to do a specific task |
| **MCP** | Model Context Protocol — a standard way for AI tools to expose capabilities |
| **Bridge** | The small server connecting OpenClaw to the rest of Julia |
| **Cowork MCP** | The server that wraps Claude as a set of MCP tools |
| **API** | A service that software programs can talk to |
| **Docker** | A tool that packages software so it runs consistently on any machine |
| **PostgreSQL** | A database for storing structured data |
| **WebSocket** | A way for two programs to stay connected and talk in real time |
| **Gateway** | OpenClaw's central hub that routes all channel messages |
| **PM2** | A process manager that keeps Node.js services running and restarts them on crash |

---

*This document is maintained by the Docs Agent and updated when the system changes. Last updated: 2026-02-23 (Update 4).*
