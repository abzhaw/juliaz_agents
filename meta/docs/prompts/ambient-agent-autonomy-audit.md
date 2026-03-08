# Prompt: Ambient Agent Autonomy Audit & Remediation

> **Purpose**: Use this prompt to audit any multi-agent system for autonomy gaps — agents that are designed but not running, broken configurations, missing health monitoring — and fix everything so the system is self-sustaining.
>
> **When to use**: When you suspect agents or services are designed but not actually running autonomously, or when setting up a new multi-agent ecosystem that needs to self-monitor.

---

## The Prompt

```
You are an expert in multi-agent system operations. Your task is to perform a comprehensive autonomy audit of my agent ecosystem and fix everything so all agents run without manual intervention.

## Context

I have a multi-agent system at [PROJECT_DIR]. Some agents are designed (have identity files, documentation, even scripts) but are NOT actually running autonomously. Others may be running but have broken configs. I want you to:

1. Discover everything
2. Fix what's broken
3. Automate what's designed but idle
4. Create a health-checker meta-agent
5. Update all documentation
6. Give me a final report of what's still not autonomous and why

## Phase 1 — Discovery (Read-Only)

Explore the entire project directory. For EVERY agent or service directory, determine:

### Agent Inventory Checklist
For each directory that looks like an agent or service:
- [ ] Does it have identity files? (SOUL.md, IDENTITY.md, HEARTBEAT.md, or equivalent)
- [ ] Does it have executable scripts? (*.sh, *.py, or a package.json with start scripts)
- [ ] Is it referenced in the process manager config? (PM2 ecosystem.config.js, docker-compose.yml, systemd units, launchd plists, crontab, etc.)
- [ ] Is it referenced in the system startup script? (boot script, LaunchAgent, init.d)
- [ ] Does it have a documentation entry? (README, agent card, wiki page)
- [ ] What is its INTENDED schedule? (always-on, cron, interval, on-demand, event-driven)
- [ ] What is its ACTUAL status? (running, stopped, never started, misconfigured)

### Configuration Cross-Check
- [ ] Do all path references across configs point to the SAME correct project directory? (This is a common bug — paths drift when projects move)
- [ ] Do startup scripts actually install/load all agents they should?
- [ ] Are cron schedules, LaunchAgent plists, or systemd timers actually registered with the OS?
- [ ] Are environment variables and secrets accessible to all agents that need them?

### Infrastructure Inventory
- [ ] What process manager is used? (PM2, systemd, supervisord, Docker Compose, etc.)
- [ ] What notification channel exists? (Telegram, Slack, email, webhook, etc.)
- [ ] What health endpoints exist? (HTTP /health, port checks, etc.)
- [ ] Is there a system startup script? Does it cover all agents?

Produce a summary table:

| Agent/Service | Directory | Identity Files | Automation Script | In Process Manager | In Startup | Docs | Intended Schedule | Actual Status |
|---|---|---|---|---|---|---|---|---|

## Phase 2 — Classification

Classify every agent into exactly one category:

### A. Autonomous ✅
Running on schedule, correctly configured, documented. No action needed.

### B. Broken — Should Be Autonomous ⚠️
Has identity + scripts + config entries but something is wrong:
- Wrong paths in config files
- Not registered with OS scheduler
- Startup script doesn't install it
- RunAtLoad/enabled is false
- Missing environment variables

**Action**: Fix the configuration. Don't rewrite the agent — fix what's blocking it.

### C. Designed But Idle 🟡
Has identity files (SOUL.md, etc.) and maybe even a HEARTBEAT describing its schedule, but:
- No actual executable script exists
- Not in the process manager config
- Relies on integration that was never built

**Action**: Write the missing automation script. Add it to the process manager config. Add it to the startup script.

### D. Missing — Should Exist 🔴
A capability gap. Common ones:
- No health checker / watchdog agent
- No documentation drift detector
- No startup verification

**Action**: Create the agent from scratch (identity files + script + config + docs).

### E. Intentionally Manual 📝
Some agents SHOULD NOT be automated. Identify these and document WHY they're manual. Common reasons:
- Requires human judgment (creative writing, academic work)
- Reactive by nature (activates on specific user input, not on schedule)
- Safety concern (destructive actions need human review)

**Action**: Don't automate. But DO create a HEARTBEAT.md explaining why it's manual, so future auditors don't mistake "intentionally manual" for "broken."

## Phase 3 — Remediation

### For Category B (Broken):
1. Identify the exact misconfiguration (wrong path, wrong flag, missing registration)
2. Fix it in the source file
3. If it's a path issue, check ALL config files for the same wrong path — path drift is usually systemic

### For Category C (Designed But Idle):
1. Read the agent's SOUL.md and HEARTBEAT.md to understand what it SHOULD do
2. Write the automation script following the patterns established by existing working agents
3. The script should:
   - Load secrets/env from the project's standard location
   - Perform its checks
   - Send notifications via the project's established channel (Telegram, Slack, etc.)
   - Log everything to a memory/log directory
   - Be idempotent (safe to run multiple times)
4. Add entry to the process manager config (both prod and dev if applicable)
5. Add to the system startup script

### For Category D (Missing — Health Checker):
Create a health-checker meta-agent with this specification:

**Identity**: The watchdog. Runs frequently (every 10-15 minutes). Checks that every other agent and service is alive.

**What it checks**:
- HTTP health endpoints for all web services
- Process manager status for all registered processes
- Container status for all Docker services
- OS scheduler status for all LaunchAgents/systemd timers/cron jobs
- Communication gateway health (if applicable)

**Behavior**:
- Silent when healthy (no news is good news)
- Auto-heals where safe: restart stopped (not errored) processes
- Alerts on failures via the project's notification channel
- Does NOT auto-heal errored processes (they need investigation)
- Does NOT restart Docker containers (too risky without context)
- Logs every check result for historical tracking

**Files to create**:
- SOUL.md — identity and behavioral rules
- HEARTBEAT.md — schedule, check targets, escalation rules
- IDENTITY.md — short identity
- scripts/health_check.sh — main check script
- memory/ — log directory
- reports/ — daily aggregated reports

### For Category E (Intentionally Manual):
- Create HEARTBEAT.md if missing, explaining the manual-by-design decision
- Update documentation to show status as "Manual (intentional)" not "Designed" or "Not yet automated"

## Phase 4 — Startup Integration

The system startup script must cover ALL agents. Update it to:

1. Start the process manager with all configs
2. Install/register OS-level schedulers (LaunchAgents, cron, etc.)
3. Run an initial health check after a warm-up delay
4. Log the full startup sequence

## Phase 5 — Documentation Update

For every change made, update:

1. **Agent cards** (one-page summary per agent) — create new ones, update status on existing ones
2. **System overview** — the master agent table with correct status for every agent
3. **README** — component count, directory structure, startup instructions
4. **Autonomy audit report** — a dated document listing:
   - All changes made
   - Current autonomy status table (agent, schedule, mechanism)
   - What's NOT autonomous and WHY (with "could be autonomous if..." for each)
   - Recommended next steps

## Phase 6 — Final Verification

Run a verification pass:
- [ ] Every agent in the process manager config has a corresponding directory with scripts
- [ ] Every agent directory with identity files is either in the process manager OR documented as intentionally manual
- [ ] All path references are consistent across all config files
- [ ] The startup script references all agents
- [ ] Documentation matches reality
- [ ] The health checker covers all other agents

## Output Format

End with a clear summary:

### Autonomy Status Table
| Agent | Status | Schedule | Mechanism |
|---|---|---|---|

### Not Autonomous — Reasons
| Agent | Why | Could Be Autonomous If... |
|---|---|---|

### Files Created/Modified
List every file touched with a one-line description of the change.
```

---

## Customization Points

When using this prompt for a new project, replace:

| Placeholder | Example Values |
|---|---|
| `[PROJECT_DIR]` | `/Users/you/my-agents`, `/opt/agent-system` |
| Process manager | PM2, systemd, supervisord, Docker Compose |
| OS scheduler | macOS LaunchAgent, Linux systemd timer, cron |
| Notification channel | Telegram Bot API, Slack webhook, email, PagerDuty |
| Identity file pattern | SOUL.md, agent.yaml, config.json — whatever your project uses |
| Health endpoints | `/health`, `/api/status`, custom ports |

---

## What This Prompt Catches

Based on real-world experience auditing multi-agent systems, these are the most common autonomy failures:

1. **Path drift** — Project moved but configs still reference the old path. Affects ALL config files systemically.
2. **RunAtLoad: false** — Agent is registered with the OS scheduler but configured not to start at boot. Effectively dead until manually triggered.
3. **Identity without automation** — Someone designed the agent (wrote SOUL.md, HEARTBEAT.md) but never wrote the actual script or added it to the process manager. Common in fast-moving projects.
4. **No health monitoring** — Everything looks configured, but nobody is actually checking if it's running. Services fail silently for days.
5. **Startup script doesn't cover all agents** — New agents get added to the process manager config but not to the boot script. They work after manual `pm2 start` but don't survive reboots.
6. **Documentation says "Designed" forever** — Agents get automated but nobody updates the docs. Or agents stay manual but docs say "Active." The audit catches both.
7. **Missing "why manual" documentation** — An agent is intentionally manual but there's no record of why. Future auditors waste time trying to "fix" it.

---

## Recommended Cadence

- **Full audit**: Monthly, or after any significant system change
- **Health checker**: Runs continuously (every 10-15 min)
- **Documentation sync**: After every audit, or triggered by health checker when it detects new/removed services

---

*Prompt version: 1.0 — Created 2026-02-23 from juliaz_agents autonomy audit*
