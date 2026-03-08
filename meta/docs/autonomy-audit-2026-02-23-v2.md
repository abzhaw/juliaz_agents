# Autonomy Audit v2 — 2026-02-23

## Silver Lining

We are performing a comprehensive autonomy audit so that Raphael's multi-agent system runs without manual intervention, which matters because an agent ecosystem that needs human babysitting defeats the purpose of having agents.

---

## Phase 1 — Discovery Summary

### Agent Inventory

| Agent/Service | Directory | Identity Files | Automation Script | In PM2 | In Startup | Docs | Intended Schedule | Actual Status |
|---|---|---|---|---|---|---|---|---|
| Frontend | `frontend/` | — (infra) | package.json | ✅ | ✅ | ✅ | Always-on | ✅ Running |
| Bridge | `bridge/` | — (infra) | package.json | ✅ | ✅ | ✅ | Always-on | ✅ Running |
| Orchestrator | `orchestrator/` | — (infra) | package.json | ✅ | ✅ | ✅ | Always-on | ✅ Running |
| Backend | `backend/` | — (infra) | docker-compose.yml | ✅ | ✅ | ✅ | Always-on | ✅ Running |
| Cowork MCP | `cowork-mcp/` | — (infra) | package.json | ✅ | ✅ | ✅ | Always-on | ✅ Running |
| OpenClaw | `openclaw/` | SOUL+IDENTITY+HB | openclaw CLI | ❌ | ❌→✅ | ✅ | Always-on | ⚠️ Fixed |
| Sentinel | `security-agent/` | SOUL+IDENTITY+HB | daily-report.sh | ✅ | ✅ | ✅ | Daily 07:00 | ⚠️ Fixed |
| ADHD Agent | `adhd-agent/` | SOUL+IDENTITY+HB | adhd_loop.sh | — (LaunchAgent) | ✅ | ✅ | Every 4h | ✅ Running |
| Task Manager | `task-manager/` | SOUL+IDENTITY+HB | task_check.sh | ✅ | ✅ | ✅ | Every 6h | ✅ Running |
| Health Checker | `health-checker/` | SOUL+IDENTITY+HB | health_check.sh | ✅ | ✅ | ✅ | Every 15min | ✅ Running |
| Docs Agent | `docs-agent/` | SOUL+IDENTITY+HB | docs_drift_check.sh | ❌→✅ | ✅ | ❌→✅ | Every 12h | 🟢 Created |
| Thesis Agent | `thesis-agent/` | SOUL+HB→+IDENTITY | — | — | — | ✅ | Manual | 📝 Intentional |
| Julia Medium | `openclaw/agents/` | SOUL+IDENTITY+HB | — | — | — | ✅ | Manual | 📝 Intentional |
| Wish Companion | embedded | — | — | — | — | ✅ | Reactive | 📝 Intentional |

### Infrastructure

| Component | Status |
|---|---|
| Process Manager | PM2 — 9 production entries, 8 dev entries |
| Notification Channel | Telegram Bot API (token in .env.secrets) |
| Boot Automation | `start-system.sh` via `com.juliaz.start-system.plist` LaunchAgent |
| Health Endpoints | Ports 3000-3003 `/health` |
| MCP Servers | Bridge (3001), Cowork MCP (3003) |

---

## Phase 2 — Classification

### A. Autonomous ✅ (10 agents/services)
Frontend, Bridge, Orchestrator, Backend, Cowork MCP, Sentinel, ADHD Agent, Task Manager, Health Checker, Docs Agent

### B. Broken — Fixed ⚠️→✅ (3 issues)
1. **Sentinel** — `TELEGRAM_CHAT_ID` missing from `.env.secrets` (empty default = silent failure)
2. **OpenClaw** — not in startup script, not in PM2, described as "LaunchAgent" but no plist existed
3. **Boot automation** — `com.juliaz.start-system.plist` missing (start-system.sh never triggered automatically)

### C. Designed But Idle → Now Automated 🟡→✅ (1 agent)
1. **Docs Agent** — had agent card describing role but no directory, scripts, or PM2 entry

### D. Missing → Now Created 🔴→✅ (3 items)
1. `com.juliaz.start-system.plist` — boot trigger for entire system
2. `docs-agent/` — complete agent with SOUL.md, IDENTITY.md, HEARTBEAT.md, automation script
3. `thesis-agent/IDENTITY.md` — missing identity file

### E. Intentionally Manual 📝 (3 agents)
1. **Thesis Agent (Schreiber)** — academic writing requires human collaboration
2. **Julia Medium** — article research is inherently on-demand
3. **Wish Companion** — reactive mode embedded in orchestrator, activates contextually

---

## Phase 3 — Changes Made

### Fix 1: Sentinel Telegram Alerts (was silently broken)

**Problem**: `daily-report.sh` line 30 had `TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"` — empty default meant Telegram alerts never sent, even though the bot token was present.

**Root cause**: `TELEGRAM_CHAT_ID` was never added to `.env.secrets` when the bot was configured. The health checker and task manager scripts worked around this with a hardcoded fallback (`8519931474`), but Sentinel didn't.

**Fixes**:
- Added `TELEGRAM_CHAT_ID=8519931474` to `.env.secrets`
- Updated Sentinel's default to `"${TELEGRAM_CHAT_ID:-8519931474}"` for consistency

**Files modified**: `.env.secrets`, `security-agent/scripts/daily-report.sh`

### Fix 2: Boot Automation (system didn't auto-start)

**Problem**: `start-system.sh` was a well-built 7-stage startup script, but nothing triggered it. The Health Checker even monitored `com.juliaz.start-system` LaunchAgent — but no plist existed.

**Fix**: Created `config/com.juliaz.start-system.plist` — macOS LaunchAgent that runs `start-system.sh` once at login. Updated `start-system.sh` to also install this plist (self-registering).

**Files created**: `config/com.juliaz.start-system.plist`
**Files modified**: `start-system.sh`

### Fix 3: OpenClaw Not in Startup (communication gateway orphaned)

**Problem**: OpenClaw is documented as "Always Running / LaunchAgent" in every doc, but:
- Not in PM2 ecosystem config (it's a separate CLI, not Node.js)
- Not in `start-system.sh` (never started on boot)
- No LaunchAgent plist for it
- IDENTITY.md was a blank template

**Fix**: Added `openclaw gateway start --force` to `start-system.sh` (step 6/9). Filled in IDENTITY.md with actual identity metadata. Also added to `start-devops.sh`.

**Files modified**: `start-system.sh`, `start-devops.sh`, `openclaw/IDENTITY.md`

### Fix 4: Docs Agent Created (phantom → real)

**Problem**: Docs Agent was described as "Active" in `agent_system_overview.md` and had an agent card, but no agent directory, no scripts, no automation existed. It was purely aspirational.

**Fix**: Created complete `docs-agent/` with:
- `SOUL.md` — documentation drift detector identity
- `IDENTITY.md` — agent metadata
- `HEARTBEAT.md` — schedule and check targets
- `scripts/docs_drift_check.sh` — compares actual system state against docs, alerts on drift
- `memory/` — log directory
- PM2 entries in both `ecosystem.config.js` and `ecosystem.dev.config.js` (cron every 12h)
- Health Checker updated to monitor `docs-agent` PM2 process
- Agent card updated from "Active" to "Autonomous (PM2 cron, 12h)"

**Files created**: `docs-agent/SOUL.md`, `docs-agent/IDENTITY.md`, `docs-agent/HEARTBEAT.md`, `docs-agent/scripts/docs_drift_check.sh`
**Files modified**: `ecosystem.config.js`, `ecosystem.dev.config.js`, `health-checker/scripts/health_check.sh`, `docs/agent_cards/docs_agent.md`, `docs/agent_system_overview.md`

### Fix 5: Thesis Agent Identity (incomplete metadata)

**Problem**: Had SOUL.md and HEARTBEAT.md but no IDENTITY.md.

**Fix**: Created `thesis-agent/IDENTITY.md` with agent metadata.

**Files created**: `thesis-agent/IDENTITY.md`

### Fix 6: DevOps Script Enhanced

**Problem**: `start-devops.sh` didn't install LaunchAgents or start OpenClaw. Dev mode users would miss ambient agents.

**Fix**: Added LaunchAgent installation (ADHD Agent + start-system) and OpenClaw gateway start to `start-devops.sh`.

**Files modified**: `start-devops.sh`

### Fix 7: Minor — Script Permissions

**Problem**: 3 scripts in skill directories lacked execute permissions.

**Fix**: `chmod +x` on `openclaw/skills/tmux/scripts/wait-for-text.sh`, `openclaw/skills/tmux/scripts/find-sessions.sh`, `.agent/skills/git-pushing/scripts/smart_commit.sh`

---

## Phase 4 — Current Autonomy Status

| Agent | Status | Schedule | Mechanism |
|---|---|---|---|
| Frontend | ✅ Autonomous | Always-on | PM2 |
| Bridge | ✅ Autonomous | Always-on | PM2 |
| Orchestrator | ✅ Autonomous | Always-on | PM2 |
| Backend | ✅ Autonomous | Always-on | Docker + PM2 |
| Cowork MCP | ✅ Autonomous | Always-on | PM2 |
| OpenClaw | ✅ Autonomous | Always-on | start-system.sh + gateway CLI |
| Sentinel | ✅ Autonomous | Daily 07:00 + boot | PM2 cron |
| ADHD Agent | ✅ Autonomous | Every 4h + boot | macOS LaunchAgent |
| Task Manager | ✅ Autonomous | Every 6h | PM2 cron |
| Health Checker | ✅ Autonomous | Every 15min | PM2 cron |
| Docs Agent | ✅ Autonomous | Every 12h | PM2 cron |
| Thesis Agent | 📝 Manual | On-demand | Intentional |
| Julia Medium | 📝 Manual | On-demand | Intentional |
| Wish Companion | 📝 Manual | Reactive | Intentional (embedded) |

---

## Phase 5 — What Is NOT Autonomous (and Why)

| Agent | Why Manual | Could Be Autonomous If... |
|---|---|---|
| Thesis Agent (Schreiber) | Academic writing requires human collaboration. Automated runs would produce content drift, unauthorized citations, and sections that don't match supervisor feedback. | A "progress nag" mode were added (weekly Telegram: "You haven't worked on thesis in X days"). The actual writing must stay human-triggered. |
| Julia Medium | Article research is inherently on-demand — you write articles when you have something to say, not on a timer. | A "trend scanner" were added (daily scan for trending topics in Raphael's field via news API). |
| Wish Companion | Embedded in orchestrator as a special mode. Activates contextually during conversations about end-of-life wishes. Nothing to "schedule" — it's reactive by nature. | N/A — reactive design is correct. |
| ADHD Agent Action Execution | Approved actions sit in `memory/approved_actions.txt` until Antigravity reads them at IDE session start. This is a safety valve — no destructive file operations without IDE visibility. | An executor script ran approved actions automatically. But this carries real risk — the manual review step is the correct safety choice. |

---

## Phase 6 — All Files Created/Modified

| File | Action | Description |
|---|---|---|
| `.env.secrets` | Modified | Added `TELEGRAM_CHAT_ID=8519931474` |
| `security-agent/scripts/daily-report.sh` | Modified | Fixed empty TELEGRAM_CHAT_ID default to `8519931474` |
| `config/com.juliaz.start-system.plist` | Created | macOS LaunchAgent to trigger `start-system.sh` on login |
| `start-system.sh` | Modified | Added start-system plist self-install (step 4), OpenClaw start (step 6), renumbered to 9 steps |
| `start-devops.sh` | Modified | Added LaunchAgent installation + OpenClaw gateway start |
| `openclaw/IDENTITY.md` | Modified | Filled in blank template with actual identity |
| `thesis-agent/IDENTITY.md` | Created | Agent identity metadata |
| `docs-agent/SOUL.md` | Created | Documentation drift detector identity |
| `docs-agent/IDENTITY.md` | Created | Agent metadata |
| `docs-agent/HEARTBEAT.md` | Created | Schedule and check targets |
| `docs-agent/scripts/docs_drift_check.sh` | Created | Drift detection script (checks agent cards, PM2, ports, steps, identity completeness) |
| `ecosystem.config.js` | Modified | Added `docs-agent` entry (cron every 12h) — now 9 entries |
| `ecosystem.dev.config.js` | Modified | Added `docs-agent` entry — now 8 entries |
| `health-checker/scripts/health_check.sh` | Modified | Added `docs-agent` to CRON_PM2 monitoring list |
| `docs/agent_cards/docs_agent.md` | Modified | Updated from aspirational to actual autonomous agent |
| `docs/agent_system_overview.md` | Modified | Updated agent count, Docs Agent status, ambient agents section, known issues |
| `docs/autonomy-audit-2026-02-23-v2.md` | Created | This report |

---

## Recommendations for Future

1. **Thesis nag mode** (low effort): Weekly Telegram reminder if no thesis activity in 7+ days. Add a simple cron script that checks `thesis/memory/` modification dates.

2. **Julia Medium trend scanner** (high effort): Requires news API integration (e.g., NewsAPI, Google Trends) + topic matching against Raphael's interests. Would transform this from manual to semi-autonomous.

3. **OpenClaw LaunchAgent plist** (medium effort): Currently started by `start-system.sh` via CLI command. Creating a proper `com.juliaz.openclaw.plist` would make it independently recoverable by launchd if it crashes, without depending on the health checker.

4. **Environment variable consolidation**: All scripts hardcode `/Users/raphael/juliaz_agents`. Consider using `SCRIPT_DIR` pattern (like adhd_loop.sh does) for portability, or at minimum define `PROJECT_DIR` in a single sourced file.

---

*Generated: 2026-02-23 by Cowork Autonomy Audit v2*
