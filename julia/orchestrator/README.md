# Orchestrator — Julia (Telegram AI Agent)

Julia is a personal AI agent accessible via Telegram. She processes incoming messages, reasons about them using LLMs, and can invoke tools (send emails, delegate to Claude) before replying.

## Architecture

```
Telegram → OpenClaw → Bridge (port 3001) → Orchestrator → Bridge → OpenClaw → Telegram
                                                ↓
                                     GPT-4o (primary LLM)
                                     Cowork-MCP → Claude Haiku (delegation)
```

The orchestrator polls the bridge for new messages, processes them through a tool-calling loop, and posts replies back.

## Model

| Model | Role |
|-------|------|
| **GPT-4o** | Primary LLM for conversation + tool calling |
| **Claude Haiku 4.5** | Sub-agent via `ask_claude` tool (delegated tasks) |

## Tools

| Tool | Description |
|------|-------------|
| `send_email` | Sends email from raphael@aberer.ch via 1Password CLI + SMTP |
| `ask_claude` | Delegates complex tasks to Claude via cowork-mcp (port 3003) |

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — bridge polling loop |
| `src/openai.ts` | GPT-4o client + tool-use loop (`generateReply()`) |
| `src/claude.ts` | Claude client (currently unused — GPT-4o is primary) |
| `src/prompt.ts` | Julia's system prompt and personality |
| `src/tools.ts` | Tool definitions (Anthropic + OpenAI format) and `executeTool()` dispatcher |
| `src/bridge.ts` | Bridge HTTP client (fetch messages, post replies) |
| `src/memory.ts` | Memory retrieval helpers |
| `src/memory-keeper.ts` | Background memory management |
| `src/letter-scheduler.ts` | Scheduled letter/email functionality |
| `src/lob.ts` | Physical mail integration (Lob API) |

## Environment

Create `orchestrator/.env`:

```
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
COWORK_MCP_URL=http://localhost:3003
```

## Running

```bash
# Development (with hot reload)
npm run dev

# Production (via PM2 — use root ecosystem.config.js)
npx pm2 start ecosystem.config.js --only orchestrator
```

## Dependencies

- `openai` — GPT-4o API client
- `@anthropic-ai/sdk` — Claude API client (for tool definitions format)
- `dotenv` — Environment variable loading
