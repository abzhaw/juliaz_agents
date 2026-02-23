---
name: openclaw-integration
description: OpenClaw CLI, gateway setup, pairing, agent skills, and relay patterns. Use when configuring Julia's Telegram gateway, debugging pairing issues, or extending OpenClaw with new skills.
---

# OpenClaw Integration

## Key Commands
```bash
openclaw health              # Check gateway health
openclaw gateway start       # Start the gateway
openclaw gateway start --force  # Force restart
openclaw status              # Full system status
openclaw logs                # Tail gateway events
openclaw dashboard           # Open web UI
openclaw onboard             # Re-pair CLI (interactive)
```

## LaunchAgent Location
```
~/Library/LaunchAgents/ai.openclaw.gateway.plist
```

## Gateway Config
```
~/.openclaw/config.json
```

## Relay Pattern (OpenClaw → Bridge → Julia)
```
Telegram → OpenClaw gateway (ws://127.0.0.1:18789)
         → julia-relay skill POSTs to http://localhost:3001/incoming
         → Bridge stores in queue
         → Orchestrator polls via MCP tool
         → Orchestrator replies via MCP tool
         → Bridge stores reply
         → julia-relay GETs /pending-reply/:chatId
         → OpenClaw sends to Telegram
```

## Skill Structure (`openclaw/skills/`)
```
skills/
  julia-relay/
    SKILL.md       ← instructions for OpenClaw's agent
  openclaw-self-manage/
    SKILL.md       ← health check + restart instructions
```

## Pairing Issues
If stuck with `role: node` (not `role: gateway`):
1. `openclaw gateway stop`
2. Delete `~/.openclaw/device.json` or equivalent state file
3. `openclaw onboard` (interactive — must approve in Telegram)
4. `openclaw gateway start --force`

## Important Rules
- Never containerize OpenClaw — needs native WebSocket + local CLI
- Gateway must be running for any Telegram communication to work
- The bridge (port 3001) must be up for julia-relay to work
