---
name: openclaw-troubleshoot
description: >
  Diagnose and fix common OpenClaw problems: gateway auth failures,
  CLI pairing issues, channel connection failures, and slow dashboard.
  Use this skill whenever openclaw health fails, the CLI times out,
  a channel shows as disconnected, or the dashboard loads slowly.
---

# OpenClaw Troubleshooter

You are diagnosing and fixing an OpenClaw issue. Work through the
decision tree below in order. Do not skip steps.

---

## STEP 1 — Identify the symptom

Run the baseline check first:

```bash
openclaw health 2>&1
openclaw channels status 2>&1
```

Then match your symptom below:

| Symptom | Go to |
|---|---|
| `gateway timeout after 10000ms` | Section A |
| `Error: pairing required` | Section A |
| `unauthorized role: node` | Section A |
| Channel shows `disabled` | Section B |
| Channel shows `not configured` | Section C |
| Gateway says `Runtime: stopped` | Section D |
| Dashboard loads very slowly | Section E |
| `Unknown channel: telegram` | Section F |

---

## SECTION A — CLI not paired to gateway

**Symptom**: All CLI commands time out or return `unauthorized` / `pairing required`.

**Cause**: The CLI's auth token is not registered in the gateway's device table.
This happens after a fresh install or gateway reset.

**Fix**:

```bash
# Option 1: Interactive onboard wizard (recommended)
openclaw onboard
# Follow the prompts. Confirm Yes to all pairing/registration steps.

# Option 2: Force restart gateway and re-pair
openclaw gateway start --force
openclaw onboard
```

**Verify**:
```bash
openclaw health
# Expected: returns OK (not timeout)
```

**If still failing**: The gateway may be crashed. Check:
```bash
cat ~/.openclaw/logs/gateway.log | tail -20
cat ~/.openclaw/logs/gateway.err.log | tail -20
# Look for crash reason, then restart: openclaw gateway start --force
```

---

## SECTION B — Channel plugin disabled

**Symptom**: `channels status` shows channel is `disabled`.

**Fix**:
```bash
openclaw plugins enable telegram    # or whatsapp, discord, slack, etc.
openclaw gateway start              # restart to apply
openclaw channels status            # verify: should show "enabled"
```

---

## SECTION C — Channel not configured (no token)

**Symptom**: Channel shows `not configured` or `Unknown channel`.

**Fix for Telegram**:
```bash
# 1. Enable plugin
openclaw plugins enable telegram

# 2. Add token (bot token from @BotFather)
openclaw channels add --channel telegram --token "$TELEGRAM_BOT_TOKEN"

# 3. Set security policy
openclaw config set channels.telegram.dmPolicy pairing
openclaw config set channels.telegram.allowFrom '["<your-telegram-id>"]'

# 4. Restart
openclaw gateway start

# 5. Verify
openclaw channels status
# Expected: "Telegram default: enabled, configured, mode:polling, token:config"
```

---

## SECTION D — Gateway stopped / not running

**Symptom**: `openclaw doctor` shows `Runtime: stopped`.

**Fix**:
```bash
# Restart via LaunchAgent (normal)
openclaw gateway start

# If still stopped after 5s, force kill and restart:
openclaw gateway start --force

# Verify:
openclaw health
```

**If LaunchAgent is broken**:
```bash
# Run gateway directly in foreground to see errors:
openclaw gateway --port 18789 --verbose
# Read the error, Ctrl+C, fix, then: openclaw gateway start
```

---

## SECTION E — Dashboard loads slowly

**Root cause**: Dashboard slow = gateway WebSocket auth is failing.
The browser connects, times out authenticating, then retries.

**This is always a symptom of Section A** (CLI not paired).
Fix Section A first, then reload the dashboard.

**Dashboard URL format**:
```
http://127.0.0.1:18789/#token=<your-auth-token>
```
Your token is in `~/.openclaw/openclaw.json` under `gateway.auth.token`.

---

## SECTION F — Unknown channel error

**Symptom**: `openclaw channels add --channel telegram` returns `Unknown channel: telegram`.

**Cause**: The plugin is disabled — the channel type isn't registered.

**Fix**:
```bash
openclaw plugins enable telegram
# Then retry: openclaw channels add --channel telegram --token "..."
```

---

## SECTION G — New Telegram user needs access

**Symptom**: User messages bot, receives pairing code like `DMMD89RG`.

**Fix**:
```bash
# Approve the pairing code
openclaw pairing approve telegram DMMD89RG

# Add to persistent allowFrom (replace with real ID)
openclaw config set channels.telegram.allowFrom '["8519931474"]'

# Restart to persist
openclaw gateway start
```

---

## FULL SYSTEM HEALTH CHECK

Run this after any fix to confirm everything is green:

```bash
openclaw health                  # gateway: OK
openclaw channels status         # telegram: enabled, configured, mode:polling
openclaw plugins list | grep -E "(telegram|loaded|disabled)"
openclaw security audit          # no critical findings
```

**All four must pass before declaring the system healthy.**

---

## CURRENT KNOWN STATE (2026-02-21)

| Component | Status | Notes |
|---|---|---|
| Gateway | Running (LaunchAgent) | Port 18789 |
| Telegram plugin | Enabled | Registered |
| Telegram bot token | Configured | In openclaw.json |
| dmPolicy | `pairing` | Secure |
| allowFrom | `["8519931474"]` | Raphael's ID |
| CLI pairing | ⚠️ Needs `openclaw onboard` | Run once to fix |
