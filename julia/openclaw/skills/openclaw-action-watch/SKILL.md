---
name: openclaw-action-watch
description: Monitor OpenClaw releases, status, and security/runtime signals to detect when user action is needed (updates, broken auth, failed jobs, channel issues). Use when checking OpenClaw health or deciding whether Raphael should intervene.
---

# OpenClaw Action Watch

## Core checks

Run these checks in order:

1. `openclaw status --all`
2. `openclaw cron runs --limit 30`
3. `openclaw channels status`

## Detect action-needed conditions

Treat as action-needed if any of these occur:

- New OpenClaw update available and not yet applied.
- Agent/auth failures like "No API key found", "token_missing", or repeated unauthorized websocket errors.
- Scheduled job failures in recent cron runs.
- Channel disconnected/degraded state.
- Security warnings that expose credentials/tokens or break expected operation.

## Output format

Return either:

- `NO_ACTION`: short status summary only.
- `ACTION_NEEDED`: bullet list with:
  - issue
  - impact
  - exact command(s) Raphael should run
  - urgency (low/medium/high)

## Notification behavior

When `ACTION_NEEDED`, prepare a concise email body to Raphael (`raphael@aberer.ch`) and also send a short Telegram summary.

Email subject format:
`[OpenClaw] Action needed - <short reason>`
