# Agent Card: Docs Agent

## What is it?
The Docs Agent is an automated documentation drift detector. It runs every 12 hours and compares the actual system state (PM2 configs, agent directories, port mappings, startup scripts) against what the documentation claims. When it finds discrepancies, it alerts Raphael via Telegram.

## What problem does it solve?
Technical systems change fast. Documentation usually lags behind. The Docs Agent closes that gap by automatically detecting when docs have drifted from reality, so they can be corrected before they mislead.

## How does it connect to the rest of the system?
The Docs Agent reads configuration files, agent directories, and documentation — then compares them. It does not modify any agent's code, configuration, or behavior.

```
System changes → Docs Agent reads configs + docs → Detects drift → Telegram alert
```

## Trigger Mechanics (Silent-Unless-Actionable)
The Docs Agent evaluates the system on its 12-hour cycle but is **completely silent** unless it detects that the system's runtime reality has drifted from the documentation (e.g., config changes, new ports). If you receive no messages, your documentation is perfectly up-to-date.

## What can it do?
- Detect missing agent cards for agents that have SOUL.md files
- Verify PM2 ecosystem entries are documented in the system overview
- Check that documented port numbers match actual configuration
- Verify start-system.sh step counts match README claims
- Check that all agent directories have complete identity files

## What can it NOT do?
- Fix documentation (it only detects drift and alerts)
- Change how any agent works
- Write code or modify configurations

## Status
✅ Autonomous (PM2 cron, every 12h)

## Workspace
`docs-agent/` — agent directory with scripts and memory

---
*Created: 2026-02-23 by Autonomy Audit*
