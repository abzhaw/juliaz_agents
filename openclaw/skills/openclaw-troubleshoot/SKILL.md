---
name: openclaw-troubleshoot
description: >
  Diagnose and fix common OpenClaw problems: gateway auth failures,
  CLI pairing issues, channel connection failures, and high CPU.
  Use when openclaw health fails, the CLI times out, a channel shows
  as disconnected, or the gateway is consuming excessive CPU.
metadata:
  openclaw:
    requires:
      bins: ["openclaw", "launchctl"]
---

# OpenClaw Troubleshooter

Work through the decision tree below in order. Do not skip steps.

---

## STEP 1 — Baseline check

```bash
openclaw health 2>&1
launchctl print gui/$UID/ai.openclaw.gateway 2>&1 | grep -E "state|pid|exit"
cat ~/.openclaw/logs/gateway.log | tail -20
```

Match your symptom:

| Symptom | Section |
|---|---|
| `gateway timeout after 10000ms` | A |
| `unauthorized role: node` | A |
| `pairing required` | A |
| `role-upgrade` in gateway log | A |
| Channel shows `disabled` | B |
| Channel shows `not configured` | C |
| Gateway at 99%+ CPU | D |
| `Unknown channel: telegram` | E |

---

## SECTION A — Device role issue (most common failure)

**Root cause:** The CLI device is registered as `role: node` in the gateway.
It needs `role: operator` to function. This is a **pairing** issue, not a
gateway crash. The gateway process itself is usually still running.

### A1 — Confirm gateway IS running

```bash
launchctl print gui/$UID/ai.openclaw.gateway 2>&1 | grep state
# → "state = running" means gateway is UP, problem is pairing only
# → anything else means gateway process is down (→ A2)
```

### A2 — If gateway is DOWN, restart it

```bash
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>&1
sleep 2
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist 2>&1
sleep 5
openclaw health
```

If plist doesn't exist:
```bash
openclaw gateway install
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist
sleep 5
openclaw health
```

### A3 — If gateway IS running but CLI role is wrong

⚠️ **This requires Raphael to run an interactive command. You cannot fix this autonomously.**

Tell Raphael:
> "The OpenClaw gateway is running but my device needs operator approval.
> Please run this in a terminal and follow the prompts:
> ```
> openclaw onboard
> ```
> The prompts will ask to confirm security, then approve this device as operator."

After he runs it:
```bash
openclaw health   # should return OK
openclaw channels status
```

**Why this keeps happening:**
The gateway's device registry survives restarts but does not auto-approve devices.
Each time the gateway's device DB is cleared or replaced, the CLI needs re-pairing.
This happens when: gateway reinstalled, plist replaced, or auth token regenerated.

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

## SECTION D — Gateway CPU spike (99%+)

**Cause:** Almost always Section A — the `role: node` upgrade loop.
The gateway processes hundreds of rejected upgrade requests per second.

```bash
# First fix Section A, then:
launchctl kickstart -k gui/$UID/ai.openclaw.gateway
sleep 5
openclaw health
```

Note: `openclaw gateway start --force` does NOT exist. Use launchctl.

---

## SECTION E — Unknown channel error

```bash
openclaw plugins enable telegram
openclaw channels add --channel telegram --token "..."
```

---

## New user pairing (Telegram)

User messages bot → receives code like `DMMD89RG`:

```bash
openclaw pairing approve telegram DMMD89RG
openclaw config set channels.telegram.allowFrom '["8519931474"]'
launchctl kickstart -k gui/$UID/ai.openclaw.gateway
```

---

## KNOWN STATE (2026-02-21)

| Component | Status |
|---|---|
| Gateway | Runs via LaunchAgent `ai.openclaw.gateway` — NOT via `openclaw gateway start` |
| Gateway process | `/opt/homebrew/lib/node_modules/openclaw/dist/index.js gateway --port 18789` |
| Telegram | Enabled, polling mode, token configured |
| dmPolicy | `pairing` |
| allowFrom | `["8519931474"]` (Raphael) |
| Recurring issue | `role: node` loop → **only fix**: `openclaw onboard` (interactive, needs Raphael) |
| Wrong command | `openclaw gateway start --force` does NOT exist |
| Right commands | `launchctl unload/load/kickstart` for gateway control |
