---
name: openclaw-gateway
description: "Julia's integration skill for invoking OpenClaw. Use this skill whenever a task involves communication, messaging, or channel operations (WhatsApp, Telegram, Slack, Discord, WebChat). Defines invocation syntax, event listening, and integration rules."
---

# OpenClaw Integration — Julia's Communication Layer

## Overview

OpenClaw is Julia's **communication and channel sub-agent**. It owns all
messaging operations across WhatsApp, Telegram, Slack, Discord, and WebChat.

Julia invokes OpenClaw via the CLI. Julia never handles channel communication
directly — that responsibility belongs entirely to OpenClaw.

## When to Use This Skill

Use this skill whenever the task involves:
- Sending a message on any channel (WhatsApp, Telegram, Slack, Discord, WebChat)
- Receiving / listening for inbound user messages
- Scheduling a message or channel event
- Querying OpenClaw's memory or conversation history
- Any other channel or communication operation

## Invocation Syntax

```bash
openclaw agent --message "[scoped task instruction]" --thinking high
```

### Rules for the `--message` argument
- Be **specific and scoped** — one task per invocation
- Include all context OpenClaw needs (channel, target, content, timing)
- Do NOT pass vague high-level goals — decompose first, then delegate

### Examples

```bash
# Send a WhatsApp message
openclaw agent \
  --message "Send a WhatsApp message to +15555550123 saying: 'Daily summary ready'" \
  --thinking high

# Schedule a recurring Telegram notification
openclaw agent \
  --message "Schedule a Telegram message to @mychannel at 09:00 daily with: [content]" \
  --thinking high

# Query conversation history
openclaw agent \
  --message "Retrieve the last 5 messages from the WhatsApp conversation with +15555550123" \
  --thinking high
```

## Listening for Inbound Events (Trigger Mode)

When Julia needs to react to messages arriving on any channel, she connects
to OpenClaw's WebSocket gateway as a listener:

```
Gateway: ws://127.0.0.1:18789
```

Inbound events arrive as JSON. Julia reads the event, decides what action
to take, and may invoke OpenClaw again to reply.

## Pre-Invocation Checklist

Before calling OpenClaw, Julia must verify:

1. **Gateway is running**: `openclaw health` returns OK
2. **Instruction is scoped**: one clear task, not a vague goal
3. **Channel/target is specified**: include the exact channel and recipient
4. **Sensitive actions**: if the action has irreversible consequences
   (e.g. sending to a large group, deleting data), use `notify_user`
   with `BlockedOnUser: true` to confirm with the user first

## OpenClaw's Boundaries

| OpenClaw CAN | OpenClaw CANNOT |
|---|---|
| Send/receive messages on any channel | Write to `backend/` |
| Manage channel integrations | Modify `.agent/skills/` |
| Use its own memory and skills | Delete files |
| Return results to Julia via stdout/WebSocket | Act without Julia's instruction |

## Gateway Health Commands

```bash
openclaw health          # check gateway is running
openclaw gateway start   # start/restart gateway
openclaw logs            # tail gateway logs
openclaw channels --help # inspect connected channels
```

## Result Handling

OpenClaw returns results to Julia via **stdout** (for direct invocations)
or as **WebSocket events** (for streaming/inbound flows).

Julia should:
- Parse stdout for success/failure confirmation
- Handle errors gracefully — if OpenClaw fails, log and retry or notify user
- Never assume OpenClaw succeeded without checking the return value
