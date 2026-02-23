# Autonomy Audit — 2026-02-23

## Silver Lining

We are making every designed ambient agent actually run autonomously, and creating a health-checker meta-agent, so that the juliaz_agents ecosystem is self-sustaining and Raphael never has to manually babysit agent processes.

---

## Changes Made This Session

### 1. ADHD Agent — Fixed and Activated

**Problem**: Paths pointed to `/Users/raphael/Documents/Devs/juliaz_agents/` (wrong). `RunAtLoad` was `false`. LaunchAgent was never installed by `start-system.sh`.

**Fixes**:
- Updated `config/com.juliaz.adhd-agent.plist`: corrected all paths to `/Users/raphael/juliaz_agents/`
- Set `RunAtLoad` to `true` (starts on login)
- Updated `config/settings.env`: corrected all paths
- Added LaunchAgent installation step to `start-system.sh` (step 4/7)
- Created missing `IDENTITY.md`

**Status**: Autonomous (LaunchAgent, every 4h, RunAtLoad on boot)

### 2. Task Manager — Automated

**Problem**: Had SOUL.md, HEARTBEAT.md, and IDENTITY.md but no actual automation script. Relied on OpenClaw heartbeat integration that was never implemented.

**Fixes**:
- Created `scripts/task_check.sh`: checks index consistency, stale tasks (>7 days in_progress), auto-detects unblocked tasks, orphan file detection, weekly Monday summary via Telegram
- Added PM2 entry in `ecosystem.config.js` and `ecosystem.dev.config.js` (cron every 6h)

**Status**: Autonomous (PM2 cron, every 6h)

### 3. Health Checker — Created from Scratch

**Problem**: No agent existed to monitor whether other agents and services were actually running.

**Created**:
- `health-checker/SOUL.md` — identity and behavioral rules
- `health-checker/HEARTBEAT.md` — check schedule and targets
- `health-checker/IDENTITY.md` — agent identity
- `health-checker/scripts/health_check.sh` — comprehensive health monitoring:
  - HTTP health endpoint probing (ports 3000-3003)
  - PM2 process status verification
  - Docker container status
  - LaunchAgent verification
  - OpenClaw gateway check
  - Auto-restart of stopped PM2 processes
  - Telegram alerts on failures
  - Silent when healthy
- Added PM2 entry in both ecosystem configs (cron every 15 min)
- Added to `start-system.sh` (initial health check 60s after boot)

**Status**: Autonomous (PM2 cron, every 15 min)

### 4. Thesis Agent — Documented as Intentionally Manual

**Problem**: Missing HEARTBEAT.md. Appeared "broken" when it was intentionally manual.

**Fixes**:
- Created `HEARTBEAT.md` explaining why it's on-demand only (academic writing requires human collaboration)

**Status**: Manual (intentionally, documented)

### 5. Startup System Updated

- `start-system.sh`: Now 7 steps (was 5). Installs ADHD Agent LaunchAgent, runs initial health check post-boot
- `ecosystem.config.js`: Now 8 PM2 entries (was 6). Added task-manager and health-checker
- `ecosystem.dev.config.js`: Same additions for dev mode

### 6. Documentation Updated

- `docs/agent_system_overview.md`: Agent table updated with all agents and their automation status
- `docs/agent_cards/adhd_agent.md`: Status changed from "Designed" to "Autonomous"
- `docs/agent_cards/health_checker.md`: New agent card created
- `docs/agent_cards/task_manager.md`: New agent card created
- `README.md`: Component table updated (7 → 10), directory structure expanded

---

## Current Autonomy Status — All Agents

| Agent | Autonomy | Schedule | Mechanism |
|-------|----------|----------|-----------|
| Frontend | Autonomous | Always-on | PM2 |
| Bridge | Autonomous | Always-on | PM2 |
| Orchestrator | Autonomous | Always-on | PM2 |
| Backend | Autonomous | Always-on | Docker + PM2 |
| Cowork MCP | Autonomous | Always-on | PM2 |
| OpenClaw | Autonomous | Always-on | LaunchAgent + Gateway |
| Sentinel (Security) | Autonomous | Daily 07:00 | PM2 cron |
| ADHD Agent | Autonomous | Every 4h + boot | macOS LaunchAgent |
| Task Manager | Autonomous | Every 6h | PM2 cron |
| Health Checker | Autonomous | Every 15min | PM2 cron |
| Thesis Agent (Schreiber) | Manual | On-demand | Intentional |
| Julia Medium | Manual | On-demand | Intentional |

---

## What Is NOT Autonomous Yet (and Why)

### 1. Thesis Agent (Schreiber)
**Why**: Academic writing requires active human collaboration. Automated runs would produce content drift, unauthorized citations, and sections that don't match supervisor feedback. This is **intentionally manual** — automating it would be harmful.

**Could be autonomous if**: A "progress nag" mode were added (weekly Telegram: "You haven't worked on thesis in X days"). But the actual writing must stay human-triggered.

### 2. Julia Medium (Article Research Agent)
**Why**: This is a creative/research agent for drafting Medium articles. It has a SOUL.md and skills inside OpenClaw but no scheduled trigger. Article research is inherently on-demand — you write articles when you have something to say, not on a timer.

**Could be autonomous if**: A "trend scanner" mode were added (daily scan for trending topics in Raphael's field, Telegram notification: "Trending topic: X — want me to draft something?"). This would require a news/trend API integration.

### 3. Docs Agent
**Why**: Referenced in `agent_system_overview.md` as "Active" but there is no dedicated agent directory or automation. Currently, documentation updates happen manually via Antigravity. There's no trigger for "documentation has drifted from reality."

**Could be autonomous if**: A scheduled job compared the actual codebase state (ports, agents, configs) against docs/ content and flagged discrepancies. This would essentially be a "documentation health check."

### 4. Wish Companion
**Why**: Embedded as a special mode inside Julia's orchestrator, not a standalone agent. It activates contextually during conversations about end-of-life wishes. There's nothing to "schedule" — it's reactive by nature. This is **correct and intentional**.

### 5. OpenClaw Approved Action Execution
**Why**: The ADHD Agent sends Telegram proposals and logs approvals in `memory/approved_actions.txt`, but approved actions are NOT automatically executed. They wait for Antigravity to read the file at session start. This is a **safety design choice** (no destructive actions without IDE visibility), but it means approved actions can sit unexecuted for hours/days until someone opens the IDE.

**Could be autonomous if**: A simple executor script ran approved actions automatically. But this carries risk — the current manual-review step is the safety valve.

---

## Recommendation: Next Steps for Full Autonomy

1. **Thesis nag mode** (low effort): Add a weekly Telegram reminder if no thesis activity in 7+ days
2. **Docs drift detector** (medium effort): Scheduled script that compares live ports/processes against docs content
3. **Julia Medium trend scanner** (high effort): Requires news API integration, topic matching

---

*Generated: 2026-02-23 by Cowork session*
