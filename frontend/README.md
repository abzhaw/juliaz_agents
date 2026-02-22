# Frontend — Julia Dashboard

A Next.js 15 web dashboard for Julia's agent system. Features a streaming AI chatbot (GPT-4o via Vercel AI SDK), system status panels, and a dark glass-panel UI.

## Architecture

```
Browser → Next.js (port 3002) → /api/chat → GPT-4o (streaming SSE)
                                     ↓
                              Tools: ask_claude → cowork-mcp (port 3003)
                                     get_tasks → backend (port 3000)
                                     get_memories → backend (port 3000)
```

The frontend chatbot is **independent** from the Telegram path (OpenClaw → Bridge → Orchestrator). Both can run simultaneously.

## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Dashboard layout — chat panel, status widgets |
| `app/api/chat/route.ts` | Streaming chat endpoint (GPT-4o + tool calling) |
| `components/ChatWindow.tsx` | Chat UI — `useChat()` hook, markdown rendering, tool indicators |
| `app/globals.css` | Dark theme, glass-panel styles |

## Chat Tools

| Tool | What it does |
|------|-------------|
| `ask_claude` | Delegates complex tasks to Claude Haiku via cowork-mcp |
| `get_tasks` | Fetches task board from backend REST API |
| `get_memories` | Searches stored memories from backend |

## Environment

Create `frontend/.env.local`:

```
OPENAI_API_KEY=sk-proj-...
```

## Running

```bash
# Development
npm run dev          # → http://localhost:3002

# Production (via PM2)
npx pm2 start ecosystem.config.js --only frontend
```

## Stack

Next.js 15 · React 19 · Tailwind CSS 4 · Vercel AI SDK · Framer Motion · React Markdown
