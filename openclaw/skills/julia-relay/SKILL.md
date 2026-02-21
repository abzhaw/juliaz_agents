---
name: julia-relay
description: >
  Relay incoming Telegram messages to Julia via the local MCP bridge server
  (http://localhost:3001). Use whenever a user sends a message that requires
  Julia's intelligence to answer. Forward the message, wait for Julia's reply,
  then send it back to the user.
metadata:
  openclaw:
    requires:
      bins: ["curl"]
---

# Julia Relay Skill

When a user sends me a message that I should forward to Julia (the primary orchestrating AI), use this skill.

---

## WHEN TO USE THIS SKILL

Use this skill when:
- The user asks a complex question that needs Julia's full reasoning
- The user explicitly asks to "talk to Julia" or "ask Julia"
- The task involves code, planning, or agentic work
- You receive a message you cannot handle confidently on your own

---

## HOW IT WORKS

```
User → Telegram → Me (OpenClaw) → POST to bridge → Julia reads it via MCP
Julia thinks → sends reply via MCP → bridge stores reply
OpenClaw polls bridge → gets Julia's reply → sends to user via Telegram
```

---

## STEP-BY-STEP PROCEDURE

### Step 1: Forward the message to the bridge

```bash
mcporter call julia-bridge.telegram_send --params '{
  "correlationId": "<CHAT_ID>",
  "text": "<MESSAGE_TEXT>",
  "target": "julia"
}'
```

Save the `messageId` from the response.

### Step 2: Acknowledge to the user (optional but friendly)

Send a brief acknowledgment while Julia processes:
> "⏳ Forwarding to Julia — one moment..."

### Step 3: Poll for Julia's reply (up to 60 seconds)

```bash
# Poll using the MCP tool
for i in $(seq 1 20); do
  REPLY=$(mcporter call julia-bridge.telegram_receive --params '{
    "correlationId": "<CHAT_ID>",
    "target": "openclaw"
  }' | grep -o '"reply":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$REPLY" ] && [ "$REPLY" != "null" ]; then
    echo "REPLY: $REPLY"
    break
  fi
  sleep 3
done
```

### Step 4: Send Julia's reply to the user

Send the reply text as a normal Telegram message to the user.

If no reply arrives after 60 seconds:
> "⚠️ Julia is not available right now. Please try again."

---

## CHECK IF BRIDGE IS RUNNING

Before forwarding, verify the bridge is up:

```bash
mcporter call julia-bridge.bridge_health
```

If the bridge is not running (`Connection refused`), inform the user:
> "⚠️ The Julia bridge is offline. Please start it with: `cd bridge && npm run dev`"

---

## IMPORTANT RULES

1. **Always check bridge health first** — don't forward if bridge is down
2. **Always acknowledge** to the user that you're forwarding
3. **Always replace placeholders** (CHAT_ID, USER_ID, USERNAME, MESSAGE_TEXT) with real values from the Telegram event
4. **Never fabricate Julia's reply** — only send what the bridge returns
5. **Log what you forward** in memory so you can correlate replies
