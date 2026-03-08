# CLAUDE.md — juliaz_agents Project Instructions

> This file is automatically read by Claude Code, Cowork, and Antigravity sessions.
> It defines mandatory rituals and conventions for working in this repository.

---

## Mandatory: Session Documentation

Every substantive session MUST be logged before ending. A "substantive session" is any session that creates, modifies, or deletes files — not pure Q&A or reading.

### How to log a session

At the end of every substantive session, run:

```bash
/Users/raphael/juliaz_agents/thesis/scripts/log_session.sh \
  "Session Title" \
  "Markdown description of what was done" \
  "source"
```

Where `source` is one of: `cowork`, `antigravity`, `manual`

**Example:**
```bash
/Users/raphael/juliaz_agents/thesis/scripts/log_session.sh \
  "Health Checker Intelligence Upgrade" \
  "Rewrote health_check.sh with alert deduplication, escalation tiers, issue correlation, and self-healing. Added shared-findings integration for cross-agent awareness." \
  "cowork"
```

### What the 3-layer auto-documentation system captures

| Layer | Mechanism | What it logs |
|-------|-----------|--------------|
| 1 | Docs Agent (every 12h) | Detects undocumented git commits, alerts via Telegram |
| 2 | Git post-commit hook | Auto-appends every commit to project_log.md |
| 3 | This session hook | Logs high-level session summaries with context |

Layer 2 captures the "what" (individual commits). Layer 3 captures the "why" (session context and rationale). Layer 1 catches anything that slips through.

---

## Project Structure (3-System Architecture)

The repository is organized into three systems:

| System | Directory | Purpose |
|--------|-----------|---------|
| **User-System** | `julia/` | The multi-agent product (frontend, backend, bridge, orchestrator, cowork-mcp, openclaw) |
| **Meta-System** | `meta/` | Development & maintenance (ambient agents, docs, logs, config, todo) |
| **Thesis-System** | `thesis/` | Master's thesis research and writing |

### Key paths
- `thesis/documentation/project_log.md` — Master project log (append-only)
- `thesis/memory/session_buffer.md` — Buffer of recent sessions for thesis synthesis
- `thesis/scripts/log_session.sh` — Session logger script
- `shared-findings/incidents.json` — Cross-agent communication backbone
- `ecosystem.config.js` — PM2 process configuration for all services and agents

---

## Ambient Agents

Six ambient agents run via PM2 from `meta/agents/`. When modifying any agent:

1. Check `shared-findings/incidents.json` for active incidents
2. Verify changes pass `bash -n <script>` syntax check
3. Test with a dry run before deploying
4. Log the session using the hook above

---

## Conventions

- Agent identity files: `SOUL.md`, `IDENTITY.md`, `HEARTBEAT.md`
- Agent documentation: `meta/docs/agent_cards/<name>.md`
- All agents read from `shared-findings/` for cross-agent awareness
- Telegram is the primary alert channel (bot token in `.env.secrets`)
