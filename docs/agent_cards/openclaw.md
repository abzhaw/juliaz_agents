# Agent Card: OpenClawJulia

## What is it?
OpenClaw (now **OpenClawJulia**) is Julia's **communication layer** — the component responsible for everything related to messaging apps. It connects Julia to the outside world: Telegram, WhatsApp, Slack, and Discord. In its upgraded state, it also acts as a powerful sub-agent with direct access to system tools.

## What problem does it solve?
Without OpenClaw, Julia would have no way to receive or send messages on external platforms. OpenClaw is the dedicated component that owns this entire layer, keeping communication concerns fully separate from the rest of the system.

## How does it connect to the rest of the system?
OpenClaw connects to the **Bridge** — a small MCP server running at `localhost:3001`. When a user sends a Telegram message, OpenClaw forwards it to the bridge via a REST call (`POST /incoming`). When a reply is ready, OpenClaw picks it up by polling the bridge (`GET /pending-reply/:chatId`) and delivers it to the user.

```
Telegram user → OpenClaw → Bridge (REST) → Orchestration (MCP)
                OpenClaw ← Bridge (poll) ← Orchestration (MCP)
```

## What can it do?
- Receive messages from Telegram (and WhatsApp, Slack, Discord)
- Forward messages to the bridge for processing
- Deliver replies back to the user on the right channel
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
| `julia-relay` | Forward Telegram messages to the bridge and poll for replies |
| `julia-bridge` | Direct bridge to the Julia orchestrator with health and send/receive tools |
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
*Updated: 2026-02-21 (Update 2) by Docs Agent*
