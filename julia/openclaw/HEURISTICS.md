# HEURISTICS.md — My Formalized Rules

Rules I've learned that work. Updated as I gain experience.
Each rule has a source so I know why it exists.

---

## Format

```
## H-NNN: [Short title]
- **Rule**: What to do
- **Why**: Why this works
- **Source**: Where I learned this
- **Added**: YYYY-MM-DD
```

---

## Gateway & Health

### H-001: Always run health check before assuming anything
- **Rule**: Before touching any config or channel, run `openclaw health` first
- **Why**: Many symptoms have the same root cause (pairing); health check tells you the real state
- **Source**: Repeated false debugging sessions
- **Added**: 2026-02-21

### H-002: Gateway CPU spike = role:node loop — fix with launchctl, not --force
- **Rule**: When gateway is at 99%+ CPU or health times out, check role. Use `launchctl kickstart -k gui/$UID/ai.openclaw.gateway` to hard-restart. `openclaw gateway start --force` does NOT exist.
- **Why**: The CPU spike is caused by the role:node upgrade loop. Restarting the launchd service clears the loop. The actual pairing fix is separate (H-006).
- **Source**: 2026-02-21 incident investigation
- **Added**: 2026-02-21

### H-003: Gateway runs via launchd — always use launchctl for restart
- **Rule**: Never use `openclaw gateway start` to restart. Use `launchctl unload/load ~/Library/LaunchAgents/ai.openclaw.gateway.plist`
- **Why**: Gateway is installed as a LaunchAgent (ai.openclaw.gateway). `openclaw gateway start` is not how you restart it after install.
- **Source**: 2026-02-21 — `gateway start --force` failed, launchctl worked
- **Added**: 2026-02-21

### H-006: CLI pairing failure — run the repair script, don't do it manually
- **Rule**: When `openclaw health` returns `unauthorized role: node` or `pairing required`, run the repair script:
  ```bash
  ./openclaw/openclaw-repairscript.sh
  ```
- **Why**: The script automates: (1) checks gateway is listening, (2) extracts operator token from `~/.openclaw/devices/paired.json`, (3) generates a pairing request, (4) approves it non-interactively
- **Source**: 2026-02-21 — recurring pairing issue, built automated fix
- **Added**: 2026-02-21

---

## Communication

### H-004: In group chats, silence is often the right reply
- **Rule**: Only respond when directly addressed or when you add genuine value
- **Why**: Interrupting human conversation is annoying and breaks trust
- **Source**: AGENTS.md
- **Added**: 2026-02-21

### H-005: Write it down, don't mental-note it
- **Rule**: Any lesson, config value, or decision worth remembering → write to a file immediately
- **Why**: Sessions restart fresh; files persist; mental notes do not
- **Source**: AGENTS.md
- **Added**: 2026-02-21

---

## Mistakes

### M-001: Used `openclaw gateway start --force` — command does not exist
- **Mistake**: Documented `--force` flag in skills and HEURISTICS as the fix for the role:node loop
- **Reason**: Assumed the flag existed based on the pattern; never verified with `--help`
- **Updated strategy**: Always run `<command> --help` before documenting a command. Use launchctl for gateway control.
- **Date**: 2026-02-21

---

## How to use this file

- After any task where something worked or failed, add/update a rule here
- Before any task, scan relevant sections
- Rules with M- prefix are mistake-derived — pay extra attention
- Review and prune quarterly; remove rules that no longer apply
