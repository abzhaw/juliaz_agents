# Agent Card: Cowork Claude (MCP Sub-Agent)

## What is it?
The **Cowork Claude MCP Server** is a bridge that exposes the Anthropic Claude API as a set of MCP tools,
allowing Julia's orchestrator and any other agent in the system to delegate tasks to Claude programmatically.

It runs as a local HTTP server on port 3003, accepting MCP-over-HTTP requests at `/mcp`.

---

## What problem does it solve?
Julia's orchestrator currently uses GPT-4o (OpenAI) for its primary AI loop. The Cowork Claude MCP server
adds a second AI brain — Claude — that can be called for:
- Complex reasoning or writing tasks
- Multimodal analysis (images + text)
- Code review and critique
- Content summarization
- Creative brainstorming and planning

This makes Julia a **multi-model** agentic system, able to route tasks to whichever model is best suited.

---

## How does it fit into the system?

```
Telegram User
    └── OpenClaw → Bridge (3001) → Orchestrator
                                       │
                                       ├── OpenAI GPT-4o  (primary loop)
                                       │
                                       └── Claude via cowork-mcp (3003) ← NEW
```

---

## Available Tools

| Tool | Description |
|---|---|
| `claude_task` | General-purpose text task delegation to Claude |
| `claude_multimodal_task` | Vision tasks — send images + text to Claude |
| `claude_code_review` | Structured code review (security / perf / readability) |
| `claude_summarize` | Summarize any content (bullets, paragraph, TL;DR) |
| `claude_brainstorm` | Generate ideas, steps, or alternatives |
| `cowork_status` | Health check — server state, model, uptime |

---

## Technical Details

| Property | Value |
|---|---|
| **Port** | 3003 |
| **MCP Endpoint** | `http://localhost:3003/mcp` |
| **Health** | `http://localhost:3003/health` |
| **Transport** | Streamable HTTP (stateless) |
| **Model** | `claude-sonnet-4-6-20251101` (configurable) |
| **Language** | TypeScript / Node.js |

---

## Requirements

- `ANTHROPIC_API_KEY` in environment or `.env.secrets`
- Node.js 18+

---

*Updated: 2026-02-22 · Added by Antigravity (Cowork)*
