# The Julia System — A Plain-Language Guide

> **Who this is for**: Anyone who wants to understand this project without needing to be a software developer.
> **Maintained by**: The Docs Agent — updated whenever the system changes.
> **Last updated**: 2026-03-08 (Update 7 — Naming Standardization)

---

## What is this project?

This project is called **Julia** (`juliaz_agents`). It has two layers:

1. **Antigravity** — the AI assistant embedded in the developer's code editor, responsible for *building* Julia
2. **Julia** — the multi-agent system being built, made up of several cooperating components

Think of it like a construction project:
- **Antigravity** is the architect and construction crew
- **Julia** is the building being constructed

Julia is a **multi-model** system: Julia-Orchestrator's primary brain runs on Claude Haiku (Anthropic), with GPT-4o (OpenAI) as fallback, and she delegates complex tasks to Claude Sonnet via the Cowork-MCP server. This makes her model-agnostic — she routes work to whichever AI is best suited.

---

## Naming Convention

**Julia** = the whole multi-agent system. Individual components are named clearly:

| Name | What it is |
|---|---|
| **Julia** | The full system — all components working together |
| **Julia-Web** | The web dashboard interface (what users see in the browser) |
| **Julia-Telegram** | The Telegram experience (what users see in Telegram) |
| **Julia-Orchestrator** | The central brain — processes messages from all channels |
| **Julia-Bridge** | The central message hub connecting all components |
| **OpenClaw** | The Telegram gateway — connects Julia to Telegram |
| **Cowork-MCP** | Claude delegation server — Julia's second brain |
| **Backend** | REST API + PostgreSQL for persistence |

Sub-agents (Sentinel, Schreiber, Health Checker, etc.) keep their own distinct names.

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
    ├──▶  Julia-Orchestrator  ───  The Brain (Claude Haiku + GPT-4o fallback)
    │         Processes messages from all channels, delegates, decides
    │
    ├──▶  Cowork-MCP  ───────────  The Second Brain (Claude Sonnet)
    │         Complex reasoning, code review, writing — port 3003
    │
    ├──▶  OpenClaw  ─────────────  The Telegram Gateway
    │         Connects Julia to Telegram users
    │
    ├──▶  Julia-Bridge  ─────────  The Message Hub (MCP server — port 3001)
    │         Central hub connecting Julia-Web, Julia-Orchestrator, OpenClaw
    │
    ├──▶  Backend API  ──────────  The Application (port 3000)
    │         REST API + PostgreSQL, runs in Docker
    │
    └──▶  Julia-Web  ────────────  The Web Dashboard (port 3002)
              Web interface with its own AI, delegates to Julia-Orchestrator
```

---

## How Messages Flow

### Telegram (Julia-Telegram experience)

```
1. You send a Telegram message
2. OpenClaw receives it on its gateway (ws://127.0.0.1:18789)
3. OpenClaw uses the julia-relay skill:
      → POST http://localhost:3001/incoming
4. Julia-Bridge stores the message in its queue
5. Julia-Orchestrator polls via MCP: telegram_get_pending_messages
6. Julia-Orchestrator processes with Claude Haiku (tool-calling loop)
7. If complex → delegates to Cowork-MCP (Claude Sonnet)
8. Julia-Orchestrator calls MCP: telegram_send_reply
9. Julia-Bridge stores the reply
10. OpenClaw polls GET /pending-reply/:chatId → gets the reply
11. OpenClaw sends the reply back to you on Telegram
```

### Web Dashboard (Julia-Web experience)

```
1. You type a message in the web dashboard
2. Julia-Web processes it directly (has its own AI: GPT-4o / Claude Sonnet)
3. If Julia-Web needs orchestrator capabilities (email, Telegram, etc.):
      → Routes via Julia-Bridge to Julia-Orchestrator
4. Julia-Orchestrator processes and replies back through Julia-Bridge
5. Julia-Web displays the result
```

Julia-Web handles most conversations itself. It only routes to Julia-Orchestrator for things it can't do directly (sending emails, Telegram messages, etc.).

---

## The Components, One by One

### 🧠 Julia-Orchestrator — The Brain

Julia-Orchestrator (`./orchestrator/`) is Julia's central intelligence. It polls the Julia-Bridge for messages from all channels, decides how to handle them, calls tools, delegates to sub-agents, and sends replies back. It runs Claude Haiku as its primary AI (with GPT-4o fallback) and can delegate to Claude Sonnet via Cowork-MCP.

**What Julia-Orchestrator does:**
- Receives and processes all incoming messages from all channels
- Decides whether a message is a user conversation or a system-dev request
- Calls MCP tools on the Julia-Bridge and Cowork-MCP
- Manages per-contact conversation memory
- Activates special modes (Wish Companion) when appropriate

**What Julia-Orchestrator is NOT:**
- It is not the communication layer — OpenClaw handles Telegram
- It does not run persistently in Docker — it runs via PM2

---

### 🤖 Cowork-MCP — The Second Brain (Claude Sonnet)

The Cowork-MCP server (`./cowork-mcp/`, port 3003) wraps the Anthropic Claude API as MCP tools. This gives Julia a second AI brain for tasks where Claude excels: complex reasoning, code review, long-form writing, multimodal analysis.

**Available tools:** `claude_task`, `claude_multimodal_task`, `claude_code_review`, `claude_summarize`, `claude_brainstorm`, `cowork_status`

**Analogy**: If Julia-Orchestrator (Claude Haiku) is the general-purpose thinker, Cowork-MCP (Claude Sonnet) is the specialist consultant called in for specific expertise.

---

### 🔧 Antigravity — The Builder

Antigravity is the AI agent living inside the developer's code editor (IDE). It is *not* Julia — it is the tool used to build Julia. When the developer opens this workspace, Antigravity is active and ready to write code, debug problems, and configure systems.

**What Antigravity does:**
- Writes and debugs code across all Julia components
- Configures the Julia-Bridge, OpenClaw, and backend
- Keeps the architecture clean and the components clearly separated
- Diagnoses problems and fixes them

**What Antigravity is NOT:**
- Antigravity is not Julia
- Antigravity is not a communication agent
- Antigravity does not send Telegram or WhatsApp messages

---

### 📡 OpenClaw — The Telegram Gateway

OpenClaw is Julia's **Telegram gateway**. It connects Julia to Telegram users — receiving messages from Telegram, forwarding them to the Julia-Bridge, and delivering Julia-Orchestrator's replies back to users.

**Analogy**: OpenClaw is like a telephone switchboard operator. Calls come in, the operator routes them. Calls go out, the operator places them.

**What OpenClaw can do:**
- Receive messages from Telegram
- Forward messages to the Julia-Bridge for processing
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
- Telegram is connected
- Runs natively on the Mac (as a persistent **LaunchAgent**)
- **Always Running**: This component must be active for the entire agentic system to function. If stopped, use `openclaw gateway start --force`.
- **Official Dashboard**: Accessible via `openclaw dashboard` (official UI for channel management and agent logs).
- Security: only approved users can talk to the bot

---

### 🔌 Julia-Bridge — The Message Hub

The Julia-Bridge is a small Node.js server (`./bridge/`, port 3001) that serves as the central message hub connecting all components — Julia-Web, Julia-Orchestrator, and OpenClaw. It exposes:
- A **REST API** that OpenClaw and Julia-Web post messages to (`POST /incoming`)
- An **MCP endpoint** that Julia-Orchestrator calls tools on (`/mcp`)
- A **polling endpoint** that OpenClaw checks for replies (`GET /pending-reply/:chatId`)

**Analogy**: The Julia-Bridge is like a shared whiteboard. OpenClaw and Julia-Web write incoming messages on the whiteboard. Julia-Orchestrator picks them up, processes them, and writes replies back. OpenClaw then reads the replies and delivers them.

**What the Julia-Bridge does:**
- Buffers messages between all components and Julia-Orchestrator
- Exposes MCP tools: `telegram_get_pending_messages`, `telegram_send_reply`, `telegram_bridge_status`
- Persists the message queue to disk (`data/queue.json`)

---

### 🖥️ Backend API — The Application

The backend (`./backend/`) is a REST API with PostgreSQL for persistence — storing tasks, memories, letters, logs, and usage data. It runs in Docker.

**Technology:** Node.js + Express + TypeScript, PostgreSQL, Prisma, Docker Compose

**What it does:** Create, list, update, and delete tasks. Store memories. Track API usage. Expose a `/health` endpoint.

**How to start it:**
```bash
cd backend && docker compose up -d
```

---

### 🌐 Julia-Web — The Web Dashboard

Julia-Web (`./frontend/`, port 3002) is a web application serving as Julia's browser-based interface. It has its own AI brain (GPT-4o / Claude Sonnet) and handles most conversations directly. For tasks requiring orchestrator capabilities, it delegates to Julia-Orchestrator via the Julia-Bridge.

**Technology:** Vite + React + Tailwind CSS + Framer Motion

---

## The Ambient Agents

In addition to the core components above, Julia has five **ambient agents** — autonomous background processes that keep the system healthy, secure, and organized without manual intervention.

> **Trigger Mechanics (Silent-Unless-Actionable):**
> It might feel like there are only two agents active because ambient agents are designed to be **invisible when the system is healthy**. They run strictly on their schedules (every 15 mins to 12 hours) but will *abort* sending any Telegram messages unless they detect a specific anomaly, issue, or structural drift. If you don't hear from them, they are working and the system is clean.

### 🔐 Sentinel — The Security Scanner

Sentinel (`security-agent/`) is Julia's immune system. It runs every morning at 07:00 and once at boot, scanning the entire system for security issues: open ports, leaked credentials, npm vulnerabilities, Docker misconfigurations, suspicious network connections, and more.

It produces a daily Markdown report and sends a Telegram summary to Raphael. Sentinel is self-learning — it tracks what changed between scans, suppresses known-accepted findings, and improves its heuristics over time.

**Schedule**: PM2 cron daily at 07:00 + boot scan via `start-system.sh`
**10 scanning skills**: port scan, network audit, credential audit, dependency audit, process audit, log analysis, Docker security, API security, OpenClaw security, self-learning
**Trigger**: Sends a summary report daily. Only alerts immediately if it finds critical newly exposed ports, secrets, or CVEs that weren't there yesterday.

### ⚙️ Health Checker — The Watchdog

The Health Checker (`health-checker/`) runs every 15 minutes and verifies that every service, ambient agent, and scheduled process is alive. If a PM2 process is simply stopped, it auto-restarts it. If something is errored or down, it alerts Raphael via Telegram.

**Schedule**: PM2 cron every 15 minutes
**Trigger**: Completely silent unless a service explicitly returns an error, crashes (HTTP 500/404), or PM2 unexpectedly reports a process as `errored` or `stopped`.

### 📋 Task Manager — The Project Keeper

The Task Manager (`task-manager/`) monitors the shared TODO queue (`todo/`) for integrity issues: stale tasks, circular dependencies, tasks blocked by resolved dependencies. It produces weekly summaries on Mondays.

**Schedule**: PM2 cron every 6 hours
**Trigger**: Completely silent unless it detects an abandoned task (`in_progress` > 7 days) or a task that was unblocked because its dependencies finished. Sends a summary on Mondays.

### 🧹 ADHD Agent — The Hygiene Scanner

The ADHD Agent (`adhd-agent/`) scans for structural drift: duplicate skills, orphaned agents, dead files, overlapping triggers. It proposes fixes via Telegram and waits for approval before acting.

**Schedule**: macOS LaunchAgent every 4 hours
**Trigger**: Completely silent unless it finds duplicate skills, dead files, overlapping routing logic, or unowned agent folders. Proposals require your YES/NO/LATER approval.

### 📖 Docs Agent — The Drift Detector

The Docs Agent (`docs-agent/`) runs every 12 hours and compares the actual system state against what the documentation claims. It checks agent cards, PM2 configs, port mappings, startup step counts, identity file completeness, and undocumented git commits. When drift is found, it alerts Raphael via Telegram with specific fix suggestions. Now includes incident awareness (skips known-down services) and drift memory (only alerts on new drift).

**Schedule**: PM2 cron every 12 hours
**Trigger**: Completely silent unless the system configuration diverges from the `docs/` folder (e.g., you added an agent or changed a port but forgot to update the documentation).

### 🏗️ Architecture Agent — The Cartographer

The Architecture Agent (`architecture-agent/`) scans the actual running system every 6 hours to build a ground-truth topology map. It collects data from PM2 processes, Docker containers, listening ports, agent directories, and skill folders, then generates `architectureGraph.json` — the data file that powers the frontend's interactive neural map at `/architecture`.

It diffs each scan against the previous one and alerts on structural changes: new nodes, removed services, health transitions. It also writes topology metadata to `shared-findings/` so other agents can detect architectural drift.

**Schedule**: PM2 cron every 6 hours
**Trigger**: Completely silent unless the system's topology has structurally changed (new agent added, service removed, health status changed).

---

## The Agents

Julia's system includes multiple cooperating agents, each with a distinct role:

| Agent | Role | Status |
|---|---|---|
| **Antigravity** | IDE builder — writes code, ships Julia | ✅ Active |
| **Julia-Orchestrator** | Central brain — conversation, tool-calling, delegation | ✅ Active |
| **OpenClaw** | Telegram gateway — message routing | ✅ Active |
| **Cowork-MCP** | Claude sub-agent — complex reasoning via MCP | ✅ Active |
| **Docs Agent** | Documentation drift detector — alerts when docs diverge from reality | ✅ Autonomous (PM2 cron, 12h) |
| **ADHD Agent** | System hygiene — scans for structural drift | ✅ Autonomous (LaunchAgent, 4h) |
| **Sentinel** | Daily security scanning + self-learning | ✅ Autonomous (PM2 cron, 07:00) |
| **Task Manager** | Project management — TODO queue integrity | ✅ Autonomous (PM2 cron, 6h) |
| **Health Checker** | System watchdog — monitors all services, self-heals, escalates intelligently | ✅ Autonomous (PM2 cron, 15min) |
| **Architecture Agent** | System cartographer — scans topology, generates neural map data | ✅ Autonomous (PM2 cron, 6h) |
| **Schreiber** | Research/writing — master's thesis support | 🟡 Manual (on-demand) |
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
| Julia-Orchestrator | `orchestrator/` | — | ❌ No — PM2 managed |
| OpenClaw | Mac, local CLI | 18789 (WS) | ❌ No — persistent LaunchAgent |
| Julia-Bridge | `bridge/` | 3001 | ❌ No — tiny local server |
| Cowork-MCP | `cowork-mcp/` | 3003 | ❌ No — local MCP server |
| Backend API | `backend/` | 3000 | ✅ Yes — API + PostgreSQL |
| Julia-Web | `frontend/` | 3002 | ❌ No — Vite dev server |

---

## Current Known Issues

| Issue | Status | Fix |
|---|---|---|
| No known critical issues | ✅ Clear | Monitored by Health Checker every 15min |

---

## Glossary

| Term | Plain-language explanation |
|---|---|
| **Julia** | The full multi-agent system — all components working together |
| **Julia-Web** | The web dashboard interface — what users see in the browser |
| **Julia-Telegram** | The Telegram experience — what users see in Telegram |
| **Julia-Orchestrator** | Julia's central brain — processes messages from all channels, makes decisions |
| **Julia-Bridge** | The central message hub connecting all components |
| **OpenClaw** | The Telegram gateway — connects Julia to Telegram users |
| **Cowork-MCP** | The server that wraps Claude Sonnet as a set of MCP tools |
| **Antigravity** | The IDE AI that builds Julia — not the same thing as Julia |
| **Multi-model** | Using more than one AI model (Claude Haiku + GPT-4o + Claude Sonnet) for different strengths |
| **Skill** | A document that teaches an agent how to do a specific task |
| **MCP** | Model Context Protocol — a standard way for AI tools to expose capabilities |
| **API** | A service that software programs can talk to |
| **Docker** | A tool that packages software so it runs consistently on any machine |
| **PostgreSQL** | A database for storing structured data |
| **WebSocket** | A way for two programs to stay connected and talk in real time |
| **Gateway** | OpenClaw's central hub that routes all Telegram messages |
| **PM2** | A process manager that keeps Node.js services running and restarts them on crash |

---

*This document is maintained by the Docs Agent (now automated) and updated when the system changes. Last updated: 2026-03-08 (Update 7 — Naming Standardization).*
