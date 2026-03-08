---
name: telegram-approval
description: >
  Human-in-the-loop approval via Telegram. Use whenever the ADHD agent needs
  Raphael's permission before taking an action. Sends a structured proposal
  message directly via the Telegram Bot API, then polls for YES/NO/LATER reply.
  Never acts without a YES. Treats timeout as NO and snoozes the finding.
---

# Telegram Approval Loop

The ADHD Agent never acts unilaterally. Every proposed change goes through
this loop: send → wait → act (or don't).

## Flow

```
1. Format proposal as Telegram message
2. Send via Bot API (telegram_notify.sh)
3. Store pending_approval.json with fingerprint + message_id
4. Poll getUpdates for Raphael's reply (poll_approval.sh)
5. On YES → log + queue for execution
   On NO  → log + mark as rejected (won't re-propose)
   On LATER/timeout → snooze for 24h
```

## Telegram Message Format

```
🧹 *ADHD Agent*

*🔴 DUPLICATE*
Duplicate skill: adhd-focus

The skill 'adhd-focus' exists in 2 registries:
  • .claude/skills/adhd_focus/SKILL.md
  • .skills/skills/adhd-focus/SKILL.md

*Proposal:*
Keep '.skills/skills/adhd-focus/' as authoritative.
Remove: .claude/skills/adhd_focus/SKILL.md

Reply *YES* to proceed, *NO* to skip, *LATER* to snooze 24h.
```

## Sending a Message Manually

```bash
# Source config + secrets first
source config/settings.env
source "$SECRETS_FILE"

curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'"${TELEGRAM_CHAT_ID}"'",
    "text": "Your message here",
    "parse_mode": "Markdown"
  }'
```

## Finding Your Chat ID (first-time setup)

1. Send any message to your Telegram bot
2. Run:
   ```bash
   source .env.secrets
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
   ```
3. Find `result[0].message.chat.id` — that's your `TELEGRAM_CHAT_ID`
4. Add it to `config/settings.env`

## Reply Recognition

The poller looks for the first message from `TELEGRAM_CHAT_ID` containing:
- `YES` — approved, queue for execution
- `NO` — rejected, record and skip permanently
- `LATER` — snooze for `SNOOZE_SECONDS` (default 24h)

Case-insensitive. The reply doesn't need to be a Telegram "reply" — any message
containing just that word from the right chat is accepted.

## Safety Guarantee

Approved actions are written to `memory/approved_actions.txt` as pending.
The loop does NOT automatically delete or modify files. Antigravity (this IDE)
reads `approved_actions.txt` at session start and executes with full visibility.
This means: even a YES from Raphael goes through one more human touchpoint.
