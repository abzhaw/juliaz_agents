---
name: juliaz-system
description: "Foundational knowledge about the juliaz_agents multi-agent system architecture. ALWAYS trigger this skill when the conversation involves ANY component of Julia's agent ecosystem — orchestrator, bridge, cowork-mcp, OpenClaw, frontend, backend, ADHD agent, julia_medium_agent, or thesis workspace. Also trigger when Raphael asks 'where is X', 'how does X work', 'what connects to what', or any architectural/navigation question about the system. This is the map of the entire codebase and how the pieces fit together."
---

# juliaz-system — Architecture & Navigation

> You are working on **juliaz_agents** — Raphael's multi-agent platform for his master's thesis on autonomous AI collaboration.

## Mental Model

```
Raphael (human) → Antigravity (IDE agent / builder) → Julia (the product being built)
```

- **Antigravity** = the AI in the IDE (Claude Code / Cowork) that builds Julia
- **Julia** = the multi-agent system being built
- **OpenClaw** = communication gateway (Telegram, WhatsApp, etc.)

## The 7 Components

| Component | Location | Port | Stack | Role |
|-----------|----------|------|-------|------|
| **Frontend** | `./frontend/` | 3002 | Next.js 15 + Tailwind + Framer Motion | Dashboard UI with its own AI chat (GPT-4o via Vercel AI SDK) |
| **Bridge** | `./bridge/` | 3001 | Express + MCP (streamable HTTP) | Message hub connecting agents ↔ UI. Queue stored in `data/queue.json` |
| **Backend** | `./backend/` | 3000 | Express + Prisma + PostgreSQL (Docker) | REST API for persistence: tasks, memories, letters, logs, usage, updates |
| **Orchestrator** | `./orchestrator/` | — | Claude Haiku (primary) + GPT-4o (fallback) | Julia's brain. Polls bridge every 5s, generates replies, manages memory |
| **Cowork MCP** | `./cowork-mcp/` | 3003 | MCP server wrapping Anthropic API | Claude delegation: 6 tools (claude_task, multimodal, code_review, summarize, brainstorm, status) |
| **OpenClaw** | `./openclaw/` | — | `openclaw` CLI (npm global) | Telegram gateway. Forwards messages to bridge via `julia-relay` skill |
| **ADHD Agent** | `./adhd-agent/` | — | macOS LaunchAgent (every 4h) | System hygiene: scans for duplicate skills, dead agents, orphaned configs |

### Supporting Directories

| Directory | Purpose |
|-----------|---------|
| `./julia_medium_agent/` | Ambient research agent tracking Medium articles |
| `./thesis/` | Master's thesis workspace (research papers, drafts, documentation, memory) |
| `./docs/` | System documentation, agent cards, planning prompts |
| `./.superpowers/` | Feature release notes and README |

## Message Flow (Telegram → Julia → Reply)

```
Telegram user sends message
  → OpenClaw gateway receives it (ws://127.0.0.1:18789)
    → OpenClaw POSTs to bridge: POST http://localhost:3001/incoming
      → Bridge stores in queue.json (state: pending)
        → Orchestrator polls via MCP: telegram_get_pending_messages (state → processing)
          → Orchestrator generates reply (Claude Haiku → GPT-4o fallback)
            → Orchestrator calls MCP: telegram_send_reply (state → replied)
              → OpenClaw polls GET /pending-reply/:chatId
                → OpenClaw delivers to Telegram
```

## Key Patterns & Conventions

### Agent Definition Files
Each agent directory follows this convention:
- `SOUL.md` — Core identity, personality, values, boundaries
- `IDENTITY.md` — Name, creature type, vibe, emoji
- `TOOLS.md` — Available tools and environment config
- `AGENTS.md` — Behavioral playbook, memory patterns, group chat rules
- `HEARTBEAT.md` — Scheduling, health checks, reporting cadence
- `HEURISTICS.md` — Learned rules from past incidents
- `MEMORY.md` — Persistent context across sessions
- `USER.md` — Info about the user (Raphael)

### Tool Definition Patterns
- **Anthropic format** (orchestrator, cowork-mcp): `{ name, description, input_schema }` with JSON Schema
- **OpenAI format** (frontend chat): `{ function: { name, description, parameters } }`
- **MCP tools** (bridge): Defined via `server.tool(name, schema, handler)`

### Error Handling
- **Graceful fallback**: Claude Haiku → GPT-4o (orchestrator)
- **Exponential backoff**: Consecutive errors trigger increasing delays (capped 55s)
- **Rate limiting**: Honors `Retry-After` header from Anthropic
- **Fire-and-forget**: Memory capture and letter generation never crash main loop
- **Timeouts**: 30s per API call with AbortController

### Memory System
- **Short-term**: In-memory conversation history (20 messages = 10 turns per chat)
- **Long-term**: Backend PostgreSQL (memories, letters, logs, tasks)
- **Memory extraction**: gpt-4o-mini categorizes moments as STORY, FEELING, MOMENT, WISH, REFLECTION
- **Letter generation**: Daily physical letters via Lob.com using GPT-4o + seed file + recent memories

### Configuration
- **Environment**: `.env.example` (template), `.env.secrets` (live keys — NEVER commit)
- **Process manager**: PM2 via `ecosystem.config.js` (prod) / `ecosystem.dev.config.js` (dev)
- **Docker**: Only backend runs in Docker (PostgreSQL + Express API)
- **MCP config**: `.mcp.json` for bridge connection

## File Location Quick Reference

When Raphael asks "where is X", use this:

| Looking for... | File(s) |
|----------------|---------|
| Julia's personality/prompt | `orchestrator/src/prompt.ts` |
| Tool definitions (orchestrator) | `orchestrator/src/tools.ts` |
| Claude API client | `orchestrator/src/claude.ts` |
| GPT-4o fallback client | `orchestrator/src/openai.ts` |
| Main polling loop | `orchestrator/src/index.ts` |
| Memory extraction logic | `orchestrator/src/memory-keeper.ts` |
| Letter generation | `orchestrator/src/letter-scheduler.ts` + `orchestrator/src/lob.ts` |
| Bridge MCP tools | `bridge/src/index.ts` |
| Bridge message queue | `bridge/data/queue.json` |
| Cowork MCP tools | `cowork-mcp/src/index.ts` |
| Frontend chat endpoint | `frontend/app/api/chat/route.ts` |
| Dashboard page | `frontend/app/page.tsx` |
| DevOps API route | `frontend/app/api/devops/route.ts` |
| Backend REST API | `backend/src/index.ts` |
| Database schema | `backend/prisma/schema.prisma` |
| Docker setup | `backend/docker-compose.yml` |
| PM2 configs | `ecosystem.config.js`, `ecosystem.dev.config.js` |
| OpenClaw relay skill | `openclaw/skills/julia-relay/` |
| OpenClaw troubleshooting | `openclaw/skills/openclaw-troubleshoot/` |
| System overview (non-technical) | `docs/agent_system_overview.md` |
| Agent cards | `docs/agent_cards/` |
| Thesis research | `thesis/research_papers/` |
| Thesis drafts | `thesis/drafts/` |

## Known Pain Points

These are real issues in the codebase — reference them when relevant:

1. **Hardcoded Mac paths** in orchestrator tools (email skill path: `/Users/raphael/Documents/Devs/juliaz_agents/openclaw/skills/email-aberer`)
2. **Tool definition duplication** between orchestrator and frontend (both define similar tools separately)
3. **No pagination** on any backend GET endpoint (returns entire table)
4. **Bridge queue grows unbounded** — no pruning of old replied messages
5. **Memory lost on restart** — in-memory conversation history clears before DB save
6. **Cowork MCP defaults to Haiku** despite being intended for complex delegation
7. **No structured logging** — sparse console.log, no log levels
8. **No tests visible** — no test files or CI/CD pipeline (except backend has Vitest configured)
9. **No authentication** on any endpoint (frontend chat, backend API, bridge)
10. **Silent content truncation** — cowork-mcp silently drops content over 25K chars

## Backend Database Tables

| Table | Key Fields |
|-------|-----------|
| `task` | title, priority, dueDate, completed |
| `memory` | chatId, category, content, originalText |
| `letter` | content, status (DRAFT/SENT), lobId, sentAt |
| `log` | level, source, message |
| `usage` | model, promptTokens, completionTokens, totalTokens |
| `update` | title, content, type |

## Bridge MCP Tools

| Tool | Purpose |
|------|---------|
| `telegram_get_pending_messages` | Fetch & mark messages as processing |
| `telegram_send_reply` | Queue a reply (with optional messageId) |
| `telegram_bridge_status` | Status snapshot |
| `telegram_receive` / `telegram_send` | Compatibility aliases |
| `bridge_health` | Detailed peer reachability |
