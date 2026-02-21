# Telegram ↔ Julia Integration Contract

**Version**: 1.0  
**Date**: 2026-02-21  
**Owner**: Julia system  

This document is the canonical contract between OpenClaw's `telegram-to-julia` 
skill and Julia. Both sides must honour these formats exactly.

---

## Overview

```
Telegram User
    │  (raw text message)
    ▼
OpenClaw [telegram-to-julia skill]
    │  formats → passes via CLI
    ▼
Julia (openclaw agent --message "..." --thinking high)
    │  processes → returns via stdout
    ▼
OpenClaw [telegram-to-julia skill]
    │  delivers verbatim
    ▼
Telegram User
```

---

## Contract: OpenClaw → Julia (Inbound)

### Format

OpenClaw ALWAYS sends Julia a message in this exact format:

```
[telegram:{sender_id}:{sender_username}] {raw_message_text}
```

### Examples

```
[telegram:123456789:raphael] What is the status of the backend API?
[telegram:987654321:] Please summarise the open tasks.
[telegram:111222333:julia_test_user] Can you send me today's briefing?
```

### Fields

| Field | Type | Description |
|---|---|---|
| `sender_id` | integer | Telegram numeric user ID — always present |
| `sender_username` | string | @handle without `@`, empty string if not set |
| `raw_message_text` | string | Unmodified message text from Telegram |

### Guarantees from OpenClaw

- `sender_id` is always a verified, allowlisted Telegram user
- `raw_message_text` is **never modified** — it is byte-for-byte what the user typed
- The format prefix `[telegram:{id}:{username}]` is always present
- Each message is one discrete Telegram message (no batching)

---

## Contract: Julia → OpenClaw (Outbound)

### Format

Julia returns a **plain text string** via stdout. OpenClaw delivers this
string verbatim to the Telegram user.

```
{julia_response_text}
```

### Rules Julia Must Follow

| Rule | Detail |
|---|---|
| Plain text only | No markdown that Telegram can't render — use Telegram-safe formatting |
| Max length | 4096 characters (Telegram message limit). Split longer responses. |
| No metadata | Do not prefix with "Julia:" or any system label |
| Empty response | Return an explicit error string — never return empty stdout |
| Errors | Return a human-readable error string. OpenClaw forwards it as-is. |

### Telegram-Safe Formatting Julia May Use

Telegram supports **MarkdownV2** in bot messages. Julia may use:

```
*bold*
_italic_
`inline code`
```code block```
[link text](https://url)
```

Avoid: raw `<`, `>`, `&` without escaping, unsupported HTML tags.

### Response Examples

```
The backend API is running on port 3000. Last health check: OK. 
Database: connected. No open incidents.
```

```
Here are your 3 open tasks:
1. Implement task PATCH endpoint
2. Write integration tests  
3. Set up Telegram channel in OpenClaw
```

---

## Security Constraints

| Constraint | Enforced by |
|---|---|
| Only allowlisted Telegram IDs reach Julia | OpenClaw `dmPolicy` + skill guard |
| Unknown senders get a pairing code, not Julia | OpenClaw gateway |
| OpenClaw does not store conversations | skill `telegram-to-julia` (no memory calls) |
| Julia does not directly access Telegram | Architecture (no Telegram SDK in Julia) |

---

## Allowed Sender IDs (Allowlist)

Maintained in `~/.openclaw/openclaw.json` under `channels.telegram.allowFrom`.

To add a new Telegram user ID:
```bash
openclaw config set channels.telegram.allowFrom '["TELEGRAM_USER_ID_1", "TELEGRAM_USER_ID_2"]'
openclaw gateway start   # restart to apply
```

---

## Timeout & Retry Policy

| Event | Behaviour |
|---|---|
| Julia responds within 60s | Normal delivery |
| Julia silent after 60s | OpenClaw sends "Processing, please wait." and retries once |
| Retry also times out | OpenClaw sends error message. Logs incident. |
| Julia returns error string | OpenClaw forwards it to user as-is |

---

## What Is NOT in Scope (v1.0)

- No conversation threading / history
- No file/image handling (text only)
- No group chat support (DM only)
- No OpenClaw memory persistence
- No other channels (WhatsApp, Discord, etc.)
- No autonomous OpenClaw responses

Expand only after this relay works reliably.
