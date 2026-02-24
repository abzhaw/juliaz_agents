# Agent Card — Docs Agent

## Identity

| Field | Value |
|-------|-------|
| **Name** | Docs Agent |
| **Emoji** | 📖 |
| **Role** | Self-documenting intelligence — detects drift, proposes fixes |
| **Workspace** | `docs-agent/` |
| **Status** | Autonomous (PM2 cron every 12 hours) |

## What It Does

The Docs Agent keeps documentation honest. It runs a two-phase pipeline: first, a fast bash script checks for structural drift (missing files, undocumented services). Then, if anything is off — or if the system has changed since the last run — an LLM reasons about what happened and generates documentation proposals. Proposals are staged for human review; production docs are never overwritten.

## Architecture

```
Phase 1 (bash, free):  file-exists + grep checks → structural findings
Phase 2 (TypeScript + LLM):

  git diff + structural findings
         ↓
    Docs Agent LLM
    (Haiku → GPT-4o → rules)
         ↓
  proposals/ directory  +  shared-findings/docs-agent.json  +  Telegram
```

### LLM Fallback Chain
1. **Claude Haiku** — primary (fast, cheap, good at structured JSON)
2. **GPT-4o** — fallback (if Anthropic API is down)
3. **Rules-based engine** — always available (skeleton docs with TODO markers)

## Behavior

- **No changes detected**: Silent — skips LLM entirely (no API cost)
- **Structural drift found**: LLM assesses severity, generates fix proposals
- **System change detected**: LLM generates documentation for new agents, updated configs
- **Own docs missing**: Self-bootstrap — generates proposals for its own identity files
- **LLM unavailable**: Falls back to rules engine with skeleton templates
- **Circuit breaker**: Max 6 Telegram messages per hour

## Key Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Core identity and principles |
| `IDENTITY.md` | Technical spec and dependencies |
| `HEARTBEAT.md` | Health checks and troubleshooting |
| `src/index.ts` | Main entry point — 4-phase orchestrator |
| `src/detector.ts` | Bash script wrapper (Phase 1) |
| `src/change-scanner.ts` | Git diff change detection (Phase 2) |
| `src/llm.ts` | LLM fallback chain (Haiku → GPT-4o → rules) |
| `src/prompt.ts` | System prompts with style guide and templates |
| `src/rules-fallback.ts` | Deterministic analysis engine |
| `src/doc-writer.ts` | Proposal staging with manifest |
| `src/telegram.ts` | Telegram sender with circuit breaker |
| `scripts/docs_drift_check.sh` | Original bash structural detector |

## Dependencies

- `shared-findings/` directory (read by Analyst for correlation)
- Anthropic API key (optional — falls back to OpenAI then rules)
- OpenAI API key (optional — falls back to rules)
- Telegram bot token (optional — logs to stdout if missing)
- Git (for change detection)

## Automation

- **Schedule**: Every 12 hours via PM2 `cron_restart`
- **Config**: `ecosystem.config.js` entry `docs-agent`
- **Build**: `cd docs-agent && npm run build`
- **Test**: `cd docs-agent && npm test` (17 tests covering detector, scanner, writer)
