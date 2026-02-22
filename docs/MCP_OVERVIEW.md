# Julia System — MCP Servers & Tools Overview

> **What this document covers**: Every MCP (Model Context Protocol) server in the Julia system, its tools, endpoints, and how they connect.
> **Maintained by**: The Docs Agent
> **Last updated**: 2026-02-22

---

## What is MCP?

MCP (Model Context Protocol) is a standard that lets AI agents expose capabilities as callable **tools**. Instead of hard-coding integrations, agents discover and call tools through a shared protocol. In Julia's system, MCP is the glue between components — it's how the orchestrator talks to the bridge, how Claude gets delegated tasks, and how agents share capabilities.

---

## MCP Server Inventory

Julia's system runs **2 MCP servers** and **1 gateway** (which functions like an MCP but uses WebSocket):

| Server | Port | Protocol | Purpose |
|---|---|---|---|
| **Bridge** | 3001 | Streamable HTTP + STDIO | Message queue between OpenClaw ↔ Orchestrator |
| **Cowork MCP** | 3003 | Streamable HTTP | Claude API wrapped as MCP tools |
| **OpenClaw Gateway** | 18789 | WebSocket | Channel message routing (Telegram, etc.) |

```
                        ┌─────────────────┐
                        │   Orchestrator   │
                        │    (GPT-4o)      │
                        └───────┬──────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
            ┌──────────┐ ┌──────────┐ ┌──────────────┐
            │  Bridge   │ │  Cowork  │ │   OpenClaw   │
            │  MCP      │ │  MCP     │ │   Gateway    │
            │ :3001     │ │ :3003    │ │   :18789     │
            └──────────┘ └──────────┘ └──────────────┘
                 │             │              │
            Message queue   Claude API    Telegram/
            (queue.json)    (Anthropic)   WhatsApp/
                                          Slack/Discord
```

---

## 1. Bridge MCP Server

The Bridge is the central message relay between OpenClaw (communication) and the Orchestrator (brain). Every message in and out of Julia flows through here.

### Server Details

| Property | Value |
|---|---|
| **Location** | `bridge/` |
| **Port** | 3001 |
| **HTTP Endpoint** | `http://localhost:3001/mcp` |
| **STDIO Mode** | `node bridge/mcp-stdio.mjs` (for Claude Code) |
| **Health Check** | `http://localhost:3001/health` |
| **Data Persistence** | `data/queue.json` |
| **Technology** | Node.js + Express + MCP SDK |
| **Start Command** | `cd bridge && npm run dev` |

### REST Endpoints (used by OpenClaw)

| Endpoint | Method | What It Does |
|---|---|---|
| `/incoming` | POST | OpenClaw sends incoming user messages here |
| `/pending-reply/:chatId` | GET | OpenClaw polls for orchestrator replies |
| `/health` | GET | Health check |

### MCP Tools (used by Orchestrator)

| Tool | Parameters | What It Does |
|---|---|---|
| **telegram_get_pending_messages** | — | Returns all unprocessed messages from the queue. The orchestrator calls this to discover new user messages. |
| **telegram_send_reply** | `chatId`, `message` | Sends a reply to a specific chat. The orchestrator calls this after processing a message to deliver the response. |
| **telegram_bridge_status** | — | Returns bridge health: uptime, queue depth, connection status. Used for monitoring and self-diagnosis. |

### Message Flow Through the Bridge

```
INCOMING:
  Telegram → OpenClaw → POST /incoming → queue.json → MCP: telegram_get_pending_messages → Orchestrator

OUTGOING:
  Orchestrator → MCP: telegram_send_reply → queue.json → GET /pending-reply/:chatId → OpenClaw → Telegram
```

---

## 2. Cowork MCP Server (Claude)

The Cowork MCP server wraps the Anthropic Claude API as a set of MCP tools. This gives Julia's orchestrator (GPT-4o) the ability to delegate tasks to Claude — making Julia a true multi-model system.

### Server Details

| Property | Value |
|---|---|
| **Location** | `cowork-mcp/` |
| **Port** | 3003 |
| **MCP Endpoint** | `http://localhost:3003/mcp` |
| **Health Check** | `http://localhost:3003/health` |
| **Model** | `claude-sonnet-4-6-20251101` (configurable) |
| **Technology** | TypeScript + Anthropic SDK + MCP SDK + Express |
| **Requires** | `ANTHROPIC_API_KEY` in environment or `.env.secrets` |

### MCP Tools

| Tool | Parameters | What It Does |
|---|---|---|
| **claude_task** | `prompt`, `system_prompt` (optional) | General-purpose text task. Send any prompt to Claude for reasoning, analysis, or writing. The workhorse tool. |
| **claude_multimodal_task** | `prompt`, `image_url` or `image_base64` | Vision + text tasks. Send an image alongside a prompt for analysis, description, or interpretation. |
| **claude_code_review** | `code`, `language`, `focus` (optional) | Structured code review. Returns findings organized by security, performance, readability, and best practices. |
| **claude_summarize** | `content`, `format` (`bullets` / `paragraph` / `tldr`) | Content summarization. Condenses any text into the requested format. |
| **claude_brainstorm** | `topic`, `constraints` (optional) | Idea generation. Produces ideas, alternative approaches, or creative solutions for a given topic. |
| **cowork_status** | — | Health check. Returns server state, current model, uptime, and request counts. |

### When the Orchestrator Delegates to Claude

The orchestrator (GPT-4o) sends work to Claude when:
- The task requires deep analytical reasoning
- Code review is requested
- Long-form writing or summarization is needed
- Creative brainstorming would benefit from a second perspective
- Multimodal analysis (images) is required
- The system-dev flow needs a planning step (Planning Claude)

---

## 3. OpenClaw Gateway

OpenClaw is not a traditional MCP server, but it functions as the system's external communication layer. It connects Julia to the outside world via WebSocket.

### Server Details

| Property | Value |
|---|---|
| **Location** | `openclaw/` |
| **WebSocket** | `ws://127.0.0.1:18789` |
| **Dashboard** | `openclaw dashboard` (CLI command) |
| **Start Command** | `openclaw gateway start --force` |
| **Platform** | Native Mac, persistent LaunchAgent |

### Channels

| Channel | Status | Notes |
|---|---|---|
| **Telegram** | ✅ Connected | Primary channel, approved users only |
| **WhatsApp** | 🔲 Not connected | Planned |
| **Slack** | 🔲 Not connected | Planned |
| **Discord** | 🔲 Not connected | Planned |

### Skills (OpenClaw's Internal Capabilities)

OpenClaw uses skills (not MCP tools) for its internal routing and system access. These are documented fully in `SKILLS_OVERVIEW.md`. The key ones for MCP integration:

| Skill | MCP Relevance |
|---|---|
| **julia-relay** | Posts to Bridge REST API (`POST /incoming`), polls for replies |
| **julia-bridge** | Direct bridge interaction with health and send/receive |
| **openclaw-self-manage** | Self-diagnosis — can restart the gateway if it detects problems |

---

## MCP Configuration for Agents

### For the Orchestrator

The orchestrator needs access to both MCP servers:

```json
{
  "mcpServers": {
    "bridge": {
      "url": "http://localhost:3001/mcp",
      "transport": "streamable-http"
    },
    "cowork": {
      "url": "http://localhost:3003/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### For Claude Code (Antigravity)

Claude Code uses the Bridge STDIO transport:

```json
{
  "mcpServers": {
    "julia-bridge": {
      "command": "node",
      "args": ["bridge/mcp-stdio.mjs"],
      "transport": "stdio"
    }
  }
}
```

---

## Tool Summary — All MCP Tools at a Glance

| Tool | Server | Port | Category |
|---|---|---|---|
| `telegram_get_pending_messages` | Bridge | 3001 | Messaging |
| `telegram_send_reply` | Bridge | 3001 | Messaging |
| `telegram_bridge_status` | Bridge | 3001 | Monitoring |
| `claude_task` | Cowork MCP | 3003 | Reasoning |
| `claude_multimodal_task` | Cowork MCP | 3003 | Vision |
| `claude_code_review` | Cowork MCP | 3003 | Code quality |
| `claude_summarize` | Cowork MCP | 3003 | Writing |
| `claude_brainstorm` | Cowork MCP | 3003 | Creativity |
| `cowork_status` | Cowork MCP | 3003 | Monitoring |

**Total: 9 MCP tools across 2 servers + 1 WebSocket gateway**

---

## Cross-Reference

- For skill details: see `SKILLS_OVERVIEW.md`
- For system architecture: see `agent_system_overview.md`
- For planning reference: see `CODE_PLANNING_PROMPT.md`
- For Cowork Claude agent card: see `agent_cards/cowork_claude.md`

---

*This document is maintained by the Docs Agent. Last updated: 2026-02-22.*
