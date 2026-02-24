# Ambient Agent Redesign — Analyst Layer + Smart Collectors

**Date**: 2026-02-24
**Author**: Antigravity (brainstormed with Raphael)
**Status**: Approved design, pending implementation
**Approach**: C — Bash collectors with local fixes + shared LLM Analyst layer

---

## Problem Statement

The five ambient agents (Health Checker, Sentinel, ADHD Agent, Docs Agent, Task Manager) suffer from structural limitations that make them noisy, unintelligent, and ultimately ignorable:

1. **Alert fatigue**: Health Checker sent 16 identical alerts over 4 hours for the same backend-down incident — no deduplication, no escalation, no incident tracking
2. **No reasoning**: Agents report symptoms ("Backend HTTP 000") without diagnosing causes ("Docker container crash-looping") or correlating across agents
3. **False positives**: ADHD Agent suggests merging `nodejs-best-practices` + `python-patterns` (different languages, 66% word overlap from generic programming terms); Sentinel flags macOS system ports as threats
4. **No recovery tracking**: When a service comes back up, nobody gets notified — the stream of alerts just stops
5. **No inter-agent correlation**: Backend being DOWN, bridge accumulating 5221 errors, and port 3000 not listening are the same root cause reported by three different agents as independent findings

### Root Cause

All agents are **stateless periodic bash scripts** that check conditions, format strings, and POST to Telegram. They have no memory across runs, no dependency model, no shared state, and no reasoning capability.

---

## Design Overview

### Architecture: Smart Collectors + Analyst Layer

```
┌─────────────────────────────────────────────────────────────┐
│                 DATA COLLECTION (bash, free)                 │
│                                                              │
│  Health Checker ──→ shared-findings/health-checker.json      │
│  (every 15min)      + local incident state tracking          │
│                                                              │
│  Sentinel ────────→ shared-findings/sentinel.json            │
│  (daily 07:00)      + security-agent/reports/YYYY-MM-DD.md   │
│                                                              │
│  ADHD Agent ──────→ shared-findings/adhd-agent.json          │
│  (every 4h)         + own Telegram proposals (YES/NO/LATER)  │
│                                                              │
│  Docs Agent ──────→ shared-findings/docs-agent.json          │
│  (every 12h)                                                 │
│                                                              │
│  Task Manager ────→ shared-findings/task-manager.json        │
│  (every 6h)                                                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              ANALYST (Node.js + TypeScript, every 15min)      │
│                                                              │
│  1. Read all shared-findings/*.json                          │
│  2. Read shared-findings/incidents.json (open incidents)     │
│  3. Read analyst/config/suppressions.json (known false +)    │
│  4. Call LLM: Haiku → GPT-4o → rules-based fallback         │
│     "Correlate, diagnose, decide notification cadence"       │
│  5. Update incidents.json (open/resolve/escalate)            │
│  6. Update cadence.json (notification timing)                │
│  7. Send unified Telegram digest (if needed)                 │
│                                                              │
│  Static knowledge baked into system prompt:                   │
│    • Dependency graph (Postgres→Backend→Bridge→Orchestrator)  │
│    • Suppressions list (known safe ports, processes)          │
│    • Escalation thresholds (15m / 1h / 4h)                   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
                     Telegram (Raphael)
                     Adaptive cadence:
                       • New incident → immediate
                       • Escalation → hourly
                       • Recovery → immediate
                       • Healthy → daily 08:00
                       • All quiet 7 days → weekly Monday
```

### Key Principle: Separation of Collection from Reasoning

Bash scripts are **sensors** — cheap, reliable, easy to debug. The Analyst is the **brain** — expensive per call but only reasons when needed. This mirrors the orchestrator pattern (tools collect data, LLM reasons about it) at the system operations level.

---

## Section 1: Shared Findings Protocol

All five agents output structured JSON to `shared-findings/` at project root.

### Finding Schema

```json
{
  "agent": "health-checker",
  "timestamp": "2026-02-24T11:30:00Z",
  "findings": [
    {
      "id": "hc-backend-http-000",
      "severity": "critical",
      "category": "service-down",
      "title": "Backend API unreachable",
      "detail": "HTTP 000 from localhost:3000/health (timeout 5s)",
      "raw_data": { "http_code": "000", "url": "http://localhost:3000/health" },
      "first_seen": "2026-02-24T11:30:00Z",
      "related_to": ["hc-pm2-backend-docker"]
    }
  ],
  "healthy": [
    "Frontend (3002): HTTP 200",
    "Bridge (3001): HTTP 200"
  ]
}
```

### Design Decisions

- **`id` is deterministic**: Same issue always gets the same ID (e.g., `hc-backend-http-{code}`). Enables cross-run tracking without fuzzy matching.
- **`first_seen` tracked by agent**: Each bash script keeps a local state file mapping finding IDs to first-seen timestamps. Gives the Analyst duration information.
- **`related_to` is agent-local**: Health Checker says "backend HTTP failure relates to backend-docker PM2 issue." Cross-agent correlation is the Analyst's job.
- **`healthy` list**: Tells the Analyst what's working. Critical for recovery detection — finding was in previous cycle's findings, now it's in healthy → incident resolved.

### Files

| File | Written by | Purpose |
|------|-----------|---------|
| `shared-findings/health-checker.json` | Health Checker | Service health findings |
| `shared-findings/sentinel.json` | Sentinel | Security scan findings |
| `shared-findings/adhd-agent.json` | ADHD Agent | Skill hygiene findings |
| `shared-findings/docs-agent.json` | Docs Agent | Documentation drift findings |
| `shared-findings/task-manager.json` | Task Manager | Task queue findings |
| `shared-findings/incidents.json` | Analyst (read-only for collectors) | Open/resolved incident state |
| `shared-findings/cadence.json` | Analyst | Notification timing state |

---

## Section 2: Bash Script Fixes

Pure bash/python improvements — no LLM calls. Fix real bugs and output structured JSON.

### 2.1 Health Checker

**A. State tracking** — new file `health-checker/memory/incidents.json`:

```json
{
  "hc-backend-http-000": {
    "first_seen": "2026-02-24T11:30:00Z",
    "last_seen": "2026-02-24T14:45:00Z",
    "count": 14
  }
}
```

Each run: if finding ID already exists, update `last_seen` and `count`. New findings get `first_seen` = now. This kills the identical-alert problem at the source.

**B. Handle all PM2 states** — replace 4-state if/elif with full state map:

| PM2 Status | Classification | Action |
|---|---|---|
| `online` | healthy | — |
| `stopped` | recoverable | auto-restart |
| `errored` | failed | report with restart count |
| `waiting restart` | crash-looping | report with PM2 backoff info |
| `launching` | transient | skip (check next cycle) |
| `one-launch-status` | one-shot | expected for cron jobs |
| `not_found` | missing | report |

**C. Retry before declaring DOWN** — try twice with 3s gap. Only declare DOWN if both fail.

**D. Output to `shared-findings/health-checker.json`** instead of Telegram.

### 2.2 Sentinel

**A. Time-windowed log analysis** — filter to last 24h using PM2 log timestamps instead of grepping the entire log file.

**B. System process allowlist for unknown ports** — ports owned by known macOS processes get severity downgraded to info:

```bash
KNOWN_SYSTEM_PROCS="Electron|Code Helper|com.apple|AirPlay|rapportd|ControlCe"
```

**C. Fix or remove broken network traffic check** — the `-n` flag in `lsof` produces IP addresses, but the allowlist uses domain names. Options:
- Remove `-n` flag (accept slower DNS resolution)
- Replace with "count unique outbound IPs" metric
- Let the Analyst handle network analysis with LLM reasoning

**D. Output to `shared-findings/sentinel.json`**.

### 2.3 ADHD Agent

**A. Replace web-crawler stop words** with curated programming-domain stop words (~50 terms):

```python
PROGRAMMING_STOP_WORDS = {
    "code", "function", "method", "class", "error", "handling",
    "best", "practice", "pattern", "example", "create", "build",
    "implement", "configure", "setup", "test", "debug", "return",
    "value", "variable", "data", "type", "string", "ensure",
    "avoid", "prefer", "should", "always", "never", ...
}
```

**B. Language-aware comparison** — extract language tags from skill names/descriptions. If two skills target different languages, raise merge threshold from 50% to 85%.

**C. Output to `shared-findings/adhd-agent.json`** — ADHD Agent keeps its own Telegram proposal loop for YES/NO/LATER approvals. Findings also go to shared directory for Analyst correlation.

### 2.4 Docs Agent & Task Manager

Minimal changes — output to `shared-findings/{agent}.json` instead of Telegram. Logic stays the same.

---

## Section 3: Incident State Model

Central state tracking for deduplication, escalation, duration, and recovery.

### File: `shared-findings/incidents.json`

Managed exclusively by the Analyst. Read-only for collectors.

```json
{
  "incidents": {
    "INC-20260224-001": {
      "status": "open",
      "severity": "critical",
      "title": "Backend crash loop (Docker)",
      "root_cause_hypothesis": "backend-docker container exiting, PM2 in backoff",
      "contributing_findings": [
        "hc-backend-http-000",
        "hc-pm2-backend-docker-waiting-restart",
        "sentinel-port-3000-not-listening",
        "sentinel-bridge-5221-errors"
      ],
      "first_seen": "2026-02-24T11:30:00Z",
      "last_seen": "2026-02-24T14:45:00Z",
      "duration_minutes": 195,
      "escalation_level": 3,
      "notifications_sent": [
        {"at": "2026-02-24T11:30:00Z", "type": "new_incident"},
        {"at": "2026-02-24T12:30:00Z", "type": "escalation", "message": "1h unresolved"},
        {"at": "2026-02-24T14:30:00Z", "type": "escalation", "message": "3h unresolved"}
      ]
    }
  },
  "resolved": [
    {
      "id": "INC-20260223-002",
      "title": "Bridge high error count",
      "resolved_at": "2026-02-23T19:00:00Z",
      "duration_minutes": 45,
      "auto_resolved": true
    }
  ]
}
```

### Incident Lifecycle

| Event | What Happens |
|-------|-------------|
| New finding not in any incident | Analyst creates new incident or adds to existing |
| Same finding persists | Update `last_seen` and `duration_minutes`. No notification unless escalation threshold hit |
| Finding disappears from collector | Remove from `contributing_findings`. If all gone → resolve incident |
| Incident resolved | Recovery notification: "Backend recovered after 3h45m" |

### Escalation Thresholds

| Duration | Level | Action |
|----------|-------|--------|
| 0-15 min | 1 — New | Immediate alert |
| 15 min - 1h | 2 — Ongoing | Hourly update with duration |
| 1h - 4h | 3 — Extended | Hourly update, severity bump |
| 4h+ | 4 — Critical | Every-30-min updates, suggest manual intervention |

---

## Section 4: The Analyst Service

### Location & Stack

- **Directory**: `analyst/`
- **Stack**: Node.js + TypeScript (consistent with system)
- **PM2 entry**: cron every 15 minutes, `autorestart: false`
- **Dependencies**: Anthropic SDK (Haiku), OpenAI SDK (GPT-4o fallback)

### Execution Flow

```
Every 15 minutes:
  1. Read all shared-findings/*.json
  2. Read shared-findings/incidents.json
  3. Read analyst/config/suppressions.json
  4. Build context: all findings + open incidents + dependency graph
  5. Call LLM (Haiku → GPT-4o → rules-based fallback):
     "Correlate findings. Update incidents. Decide notification."
  6. Parse structured JSON response
  7. Update incidents.json
  8. Update cadence.json
  9. Send Telegram if LLM says to notify
```

### LLM Prompt Structure

**System prompt contains static knowledge:**

1. **Dependency graph** — hardcoded topology:
   ```
   PostgreSQL (Docker) → Backend API (3000) → Bridge (3001) → Orchestrator → OpenClaw
   Frontend (3002) — independent
   Cowork-MCP (3003) — independent
   ```

2. **Suppressions list** — loaded from `analyst/config/suppressions.json`:
   ```json
   {
     "known_safe_ports": {
       "5000": "macOS AirPlay Receiver",
       "7000": "macOS AirDrop",
       "49152-49999": "Ephemeral ports (Electron, VS Code)"
     },
     "known_safe_processes": [
       "Electron", "Code Helper", "com.apple", "rapportd", "ControlCe"
     ],
     "language_tags": ["nodejs", "python", "typescript", "go", "rust"]
   }
   ```

3. **Escalation rules** — thresholds from Section 3.

**Dynamic payload per call:**
```json
{
  "collector_findings": { /* merged shared-findings/*.json */ },
  "open_incidents": { /* from incidents.json */ },
  "last_digest_sent": "2026-02-24T14:30:00Z",
  "current_time": "2026-02-24T14:45:00Z"
}
```

### LLM Structured Response

Enforced via tool_use / JSON mode:

```json
{
  "incidents_update": [
    {
      "id": "INC-20260224-001",
      "action": "update",
      "status": "open",
      "severity": "critical",
      "title": "Backend crash loop (Docker)",
      "root_cause": "backend-docker container exiting, PM2 in backoff",
      "correlated_findings": ["hc-backend-http-000", "hc-pm2-backend-docker", "sentinel-port-3000"],
      "suggested_action": "Check docker logs backend and pm2 logs backend-docker"
    }
  ],
  "resolved_incidents": [],
  "should_notify": true,
  "notification_reason": "escalation — incident exceeds 3h",
  "digest": "..."
}
```

### Fallback Chain

```
Haiku (primary, ~$0.001/call)
  → GPT-4o (fallback, ~$0.01/call)
    → Rules-based engine (no LLM, free)
```

**Rules-based fallback** handles essentials:
- New finding → create incident, send alert
- Existing finding → update duration, check escalation
- Missing finding → resolve incident, send recovery
- Cadence rules enforced mechanically

Lost without LLM: root cause hypotheses, cross-agent correlation, natural language. Kept: deduplication, incident lifecycle, recovery tracking, escalation.

### Cost Estimate

- Input: ~2000-4000 tokens per call
- Output: ~500-800 tokens per call
- Haiku: ~$0.001-0.003 per call
- At 96 calls/day (every 15 min): ~$0.10-0.30/day
- With adaptive cadence (fewer calls when healthy): **~$0.05-0.15/day**

---

## Section 5: Adaptive Cadence & Digest Format

### Cadence Rules

| System State | Cadence | Content |
|---|---|---|
| New incident | Immediate | Full detail + root cause + suggested action |
| Open incident, new info | Hourly | Duration update + new correlated findings |
| Open incident, no change | Every 4h | Brief "still unresolved" |
| Incident resolved | Immediate | Recovery notification with total duration |
| All healthy | Daily (08:00) | One-liner: "All systems healthy" |
| All healthy 7 days | Weekly (Monday 08:00) | Weekly summary with ADHD/Docs/Task findings |

### Hard Rules (not up to LLM)

- Max **6 messages per hour** (circuit breaker)
- Never send **exact same digest text** twice (dedup hash)
- Always send **recovery notifications**
- ADHD and Docs findings only in daily/weekly unless critical

### Digest Formats

**During incidents:**
```
🔴 Incident Update — 3h15m
Backend crash loop (Docker container exiting)

Impact: Backend API down, Bridge accumulating errors,
        OpenClaw degraded
Unaffected: Frontend, Cowork-MCP
Suggested: docker logs backend && pm2 logs backend-docker

📋 Also noted:
  • Docs: thesis-agent needs agent card (low)
  • ADHD: nodejs/python merge skipped (different languages)

Next update in ~1h unless status changes.
```

**On recovery:**
```
✅ Incident Resolved — 3h52m
Backend recovered. All systems healthy.

Timeline: DOWN 11:30 → escalated 12:30 → RECOVERED 15:22
```

**Daily healthy:**
```
✅ Daily Digest — 2026-02-24
All 7 services healthy. No open incidents.

📋 Housekeeping:
  • Docs: thesis-agent needs agent card
  • Tasks: 2 open, 1 in progress, 0 stale

🔐 Sentinel: 0 critical, 0 high findings
```

**Weekly healthy:**
```
📊 Weekly Summary — Feb 17-24
Uptime: 99.2% (1 incident, 3h52m total downtime)

📋 System hygiene:
  • 103 skills, 0 duplicates, 1 merge candidate reviewed
  • 1 missing agent card (thesis-agent)

🔐 Security: 0 new findings this week
📋 Tasks: 3 completed, 2 open, 0 stale
```

### Cadence State: `shared-findings/cadence.json`

```json
{
  "last_digest_sent": "2026-02-24T14:30:00Z",
  "last_digest_hash": "a3f8b2c1",
  "messages_this_hour": 2,
  "last_daily_digest": "2026-02-24T08:00:00Z",
  "last_weekly_digest": "2026-02-17T08:00:00Z"
}
```

---

## Section 6: Suppressions & Learning

### File: `analyst/config/suppressions.json`

```json
{
  "known_safe_ports": {
    "5000": "macOS AirPlay Receiver",
    "7000": "macOS AirDrop",
    "49152-49999": "Ephemeral ports (Electron, VS Code, language servers)"
  },
  "known_safe_processes": [
    "Electron", "Code Helper", "com.apple", "rapportd",
    "ControlCe", "AMPLibraryAgent"
  ],
  "suppressed_findings": {},
  "language_tags": ["nodejs", "node", "python", "typescript", "go", "rust", "java", "swift"]
}
```

### How Learning Works (Without LLM Memory)

1. User suppresses a false positive once → it never comes back
2. Analyst proposes new suppressions in weekly digest: "Port 49332 flagged 14 times, always Code Helper. Suppress?"
3. Confirmed via Telegram YES/NO (reuses ADHD agent's approval pattern)
4. Over time, suppressions.json grows and noise shrinks

---

## Documentation Updates Required on Implementation

This design introduces a new component (Analyst) and changes how existing agents communicate. The following documentation must be updated:

### agent_system_overview.md

1. **Ambient Agents section** (line ~198): Add Analyst description after the existing five agents
2. **Agents table** (line ~249): Add row: `| **Analyst** | Correlation engine — unifies ambient agent findings | ✅ Autonomous (PM2 cron, 15min) |`
3. **What Runs Where table** (line ~272): Add row: `| Analyst | analyst/ | — | ❌ No — PM2 managed |`
4. **Known Issues** (line ~288): Update to reflect any current issues

### New files needed

- `docs/agent_cards/analyst.md` — agent card following existing format (see health_checker.md as template)
- `analyst/SOUL.md` — core identity
- `analyst/IDENTITY.md` — agent identity
- `analyst/HEARTBEAT.md` — schedule definition

### Existing agents to update

- **Docs Agent** (`docs-agent/scripts/docs_drift_check.sh`): Add `analyst` to the name→card mapping on line 60-67
- **Health Checker**: Will no longer send Telegram directly — the overview trigger mechanics description needs updating
- **All agent HEARTBEAT.md files**: Note that Telegram reporting now goes through shared-findings/ → Analyst

### ecosystem.config.js

Add PM2 entry for `analyst`:
```javascript
{
  name: 'analyst',
  script: 'analyst/dist/index.js',
  cron_restart: '*/15 * * * *',
  autorestart: false,
  env: { NODE_ENV: 'production' }
}
```

---

## File Structure Summary

| File | Owner | Purpose |
|------|-------|---------|
| `shared-findings/*.json` | Each collector | Raw findings per agent |
| `shared-findings/incidents.json` | Analyst | Open/resolved incidents |
| `shared-findings/cadence.json` | Analyst | Notification timing |
| `analyst/config/suppressions.json` | Raphael + Analyst proposals | Known false positives |
| `analyst/src/index.ts` | — | Main Analyst service |
| `analyst/src/prompt.ts` | — | LLM system prompt + dependency graph |
| `analyst/src/llm.ts` | — | Haiku → GPT-4o → fallback chain |
| `analyst/src/rules-fallback.ts` | — | Rules-based fallback (no LLM) |
| `analyst/src/incidents.ts` | — | Incident state management |
| `analyst/src/telegram.ts` | — | Telegram digest sender |
| `health-checker/memory/incidents.json` | Health Checker | Local incident state (first_seen tracking) |
