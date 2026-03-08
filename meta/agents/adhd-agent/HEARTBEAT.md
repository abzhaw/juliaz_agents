# HEARTBEAT.md

## Ambient Mode (launchd)

The ADHD Agent runs as a macOS LaunchAgent every **4 hours**:
- **Plist**: `~/Library/LaunchAgents/com.juliaz.adhd-agent.plist`
- **Log**: `memory/adhd_loop.log`
- **Error log**: `memory/adhd_loop_error.log`

Check if running:
```bash
launchctl list | grep adhd-agent
```

⚠️ **After any change to `config/com.juliaz.adhd-agent.plist` or `config/settings.env`**, reload the LaunchAgent:
```bash
# Unload old, copy updated plist, reload
launchctl unload ~/Library/LaunchAgents/com.juliaz.adhd-agent.plist
cp config/com.juliaz.adhd-agent.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.juliaz.adhd-agent.plist
launchctl list | grep adhd-agent   # confirm it's listed
```

## Manual Triggers

```bash
# Full scan + status email + Telegram proposals
bash scripts/adhd_loop.sh --once

# Scan only, no email/Telegram (safe to run anytime)
bash scripts/adhd_loop.sh --once --dry-run

# Raw scanner output (respects exceptions.json by default)
python3 scripts/scan_skills.py
python3 scripts/scan_skills.py --json

# Raw scanner — audit mode (no exceptions, see everything)
python3 scripts/scan_skills.py --no-exceptions

# Generate a status report HTML without sending email
python3 scripts/scan_skills.py --json | \
  python3 scripts/generate_status_report.py --scan-output - --output /tmp/adhd_status.html
open /tmp/adhd_status.html
```

## Status Report (Email)

Every cycle, the agent emails a full HTML status report to `raphael@aberer.ch` via
OpenClaw's `email-aberer` skill (SMTP via Swizzonic, credentials from 1Password).

**Prerequisites:**
- 1Password CLI must be signed in: `op signin` in any terminal before the agent runs
- The LaunchAgent plist sets `HOME=/Users/raphael` so `op` can find your keychain

If email fails (e.g. 1Password not signed in), the agent logs a warning and continues
scanning — Telegram approval requests still go out normally.

**Report contents:**
- Total skills and active finding count
- Bridge health status
- Full skills inventory per registry
- All actionable findings with proposals
- Acknowledged cross-registry intentional items (collapsed by default)

## Pending Approved Actions

When Raphael replies YES to a Telegram proposal, the action is logged in
`memory/approved_actions.txt` but NOT automatically executed.

Antigravity (this IDE) reads this file at session start and executes with
full visibility. To process pending approvals:

```bash
cat memory/approved_actions.txt
```

Then execute each line manually or ask Antigravity to handle it.

## Bridge Dependency

The approval poller uses the Telegram Bot API directly — it does NOT require
the Julia-OpenClaw bridge to be running. Bridge health is irrelevant for
the ADHD Agent's Telegram communication.
