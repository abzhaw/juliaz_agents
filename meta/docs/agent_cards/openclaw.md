# Agent Card: OpenClaw

**System Layer**: Product-System — the Telegram interface that end-users interact with

## What is it?
OpenClaw is Julia's **Telegram gateway** — the component that connects Julia to Telegram users. It receives messages from Telegram, forwards them to the Julia-Bridge, and delivers Julia-Orchestrator's replies back to users.

## What problem does it solve?
Without OpenClaw, Julia would have no way to receive or send messages on Telegram. OpenClaw is the dedicated component that owns this communication layer, keeping messaging concerns fully separate from the rest of the system.

## How does it connect to the rest of the system?
OpenClaw connects to the **Julia-Bridge** — the central message hub running at `localhost:3001`. When a user sends a Telegram message, OpenClaw forwards it to the bridge via a REST call (`POST /incoming`). When a reply is ready, OpenClaw picks it up by polling the bridge (`GET /pending-reply/:chatId`) and delivers it to the user.

```
Telegram user → OpenClaw → Julia-Bridge (REST) → Julia-Orchestrator (MCP)
                OpenClaw ← Julia-Bridge (poll) ← Julia-Orchestrator (MCP)
```

## What can it do?
- Receive messages from Telegram
- Forward messages to the Julia-Bridge for processing
- Deliver replies back to the user on Telegram
- **Execute code** and run scripts
- **Manage terminal sessions** via `tmux`
- **Query the Oracle** for specialized knowledge
- **Access Notion** pages and databases
- Check its own health and self-repair the gateway

## What can it NOT do?
- Generate intelligent replies — it relays and routes, doesn't think
- Write code or modify the backend
- Act outside its communication scope

## Runs where?
- Natively on the Mac (not in Docker)
- Gateway WebSocket: `ws://127.0.0.1:18789`
- Skills: `./openclaw/skills/`

## Skills it uses
| Skill | Purpose |
|---|---|
| `julia-relay` | Forward Telegram messages to the Julia-Bridge and poll for replies |
| `julia-bridge` | Direct bridge to Julia-Orchestrator with health and send/receive tools |
| `code` | Run local code and scripts in various languages |
| `tmux` | Manage persistent terminal sessions and multiplexing |
| `notion` | Search and read from Notion workspaces |
| `oracle` | Query the system Oracle for architectural or domain knowledge |
| `email-aberer` | Send emails via SMTP using 1Password CLI for credentials |
| `openclaw-self-manage` | Health check, gateway restart, channel diagnosis |
| `openclaw-troubleshoot` | Decision tree for common failures |

## Analogy
OpenClaw is like a telephone switchboard operator. Calls come in, the operator routes them to the right place. Calls go out, the operator places them. The operator doesn't decide what to say — they just connect the right people.

---
*Updated: 2026-03-08 (Update 3) — Naming standardization*
