---
name: openclaw-self-manage
description: >
  Self-management skill for the OpenClaw agent. Use when you need to check
  your own health, diagnose gateway issues, inspect channel status, or
  restart the gateway. Run this before reporting any connectivity issue to Raphael.
metadata:
  openclaw:
    requires:
      bins: ["openclaw", "launchctl"]
---

# OpenClaw Self-Management

Use this skill when something feels wrong — gateway timeouts, channel disconnects, auth errors.

---

## STEP 1 — Health check (always start here)

```bash
openclaw health 2>&1
```

| Output | Meaning | Go to |
|---|---|---|
| `OK` | Gateway healthy | Done ✅ |
| `gateway timeout after 10000ms` | Gateway not responding or device not paired | Section A |
| `unauthorized role: node` | Device registered as node, needs operator approval | Section A |
| `pairing required` | Device not yet approved as operator | Section A |
| Channel `disabled` | Plugin off | Section B |
| Channel `not configured` | Token missing | Section C |

---

## SECTION A — Device role issue (most common)

**What's happening:** The gateway is running (LaunchAgent `ai.openclaw.gateway` is active),
but this device's role is `node` instead of `operator`. The fix always requires
an interactive re-onboarding to approve the device — this cannot be done unattended.

**Verify gateway is actually running:**
```bash
launchctl print gui/$UID/ai.openclaw.gateway 2>&1 | grep state
# → state = running  (gateway IS up, it's a pairing issue)
# → state missing or not found  (gateway process died — see below)
```

**If gateway is running but CLI can't connect → interactive fix required:**
> Tell Raphael: "I need you to run `openclaw onboard` in a terminal and follow the prompts.
> The gateway is running but my device needs operator approval.
> Error: `{exact error text}`"

**If gateway process is NOT running (not in launchctl):**
```bash
# Reload the LaunchAgent
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>&1
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>&1
sleep 5
openclaw health
```

**If launchd plist doesn't exist yet:**
```bash
openclaw gateway install
# Then reload as above
```

**After Raphael runs `openclaw onboard`:**
```bash
openclaw health   # should return OK
openclaw channels status
```

---

## SECTION B — Plugin disabled

```bash
openclaw plugins enable telegram
launchctl kickstart -k gui/$UID/ai.openclaw.gateway
sleep 3
openclaw channels status
```

---

## SECTION C — Channel not configured

```bash
openclaw plugins enable telegram
openclaw channels add --channel telegram --token "$TELEGRAM_BOT_TOKEN"
openclaw config set channels.telegram.dmPolicy pairing
launchctl kickstart -k gui/$UID/ai.openclaw.gateway
sleep 3
openclaw channels status
```

---

## FULL SYSTEM CHECK

After any fix:
```bash
openclaw health
openclaw channels status
launchctl print gui/$UID/ai.openclaw.gateway | grep -E "state|pid"
```

---

## REPORTING TO RAPHAEL

When reporting, always include:
1. Exact symptom seen
2. Command run to diagnose
3. Exact error text from logs: `cat ~/.openclaw/logs/gateway.log | tail -20`
4. Gateway state: `launchctl print gui/$UID/ai.openclaw.gateway | grep state`

If interactive fix is required, be explicit: "I can't fix this without you running a command."
