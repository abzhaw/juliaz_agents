# Julia-OpenClaw MCP Bridge

A lightweight MCP server that acts as a **message bus** between Julia (the IDE AI) and OpenClaw (the Telegram AI).

## Architecture

```
User → Telegram → OpenClaw
                      │
                      │  POST /incoming
                      ▼
              bridge (localhost:3001)
                      │
                      │  MCP tools (stdio)
                      ▼
                    Julia
                      │
                      │  telegram_send_reply
                      ▼
              bridge stores reply
                      │
                      │  GET /pending-reply/:chatId
                      ▼
                  OpenClaw → Telegram → User
```

## Setup

### 1. Install & build

```bash
cd bridge
npm install
npm run build
```

### 2. Start the bridge

```bash
npm run dev        # development (tsx, hot reload)
# or
npm start          # production (compiled)
```

Bridge starts on **port 3001** for OpenClaw REST + **stdio** for Julia MCP.

### 3. Configure Julia to use the MCP server

Add to your Antigravity / Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "julia-openclaw-bridge": {
      "command": "node",
      "args": ["/Users/raphael/Documents/Devs/juliaz_agents/bridge/dist/index.js"]
    }
  }
}
```

### 4. Fix OpenClaw CLI pairing (one-time)

The CLI needs to be re-paired with the gateway:

```bash
openclaw onboard
# Follow the prompts — approve the repair pairing
openclaw health   # should say OK
```

### 5. Deploy julia-relay skill to OpenClaw

The skill is already in `openclaw/skills/julia-relay/SKILL.md`. OpenClaw loads it automatically on next session restart.

---

## MCP Tools (for Julia)

| Tool | What it does |
|---|---|
| `telegram_get_pending_messages` | Returns all Telegram messages waiting for Julia's reply |
| `telegram_send_reply` | Queues a reply for OpenClaw to deliver |
| `telegram_bridge_status` | Shows pending/processing/replied counts |

## HTTP Endpoints (for OpenClaw)

| Endpoint | Method | What it does |
|---|---|---|
| `/incoming` | POST | OpenClaw sends `{ chatId, userId, username, text }` |
| `/pending-reply/:chatId` | GET | OpenClaw polls for Julia's reply |
| `/health` | GET | Health check |
| `/messages` | GET | Debug — see all messages in queue |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BRIDGE_PORT` | `3001` | HTTP server port |
