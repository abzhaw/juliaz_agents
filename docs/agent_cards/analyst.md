# Agent Card — Analyst

## Identity

| Field | Value |
|-------|-------|
| **Name** | Analyst |
| **Emoji** | 🔬 |
| **Role** | Correlation engine — ambient agent finding synthesis |
| **Workspace** | `analyst/` |
| **Status** | Autonomous (PM2 cron every 15 min) |

## What It Does

The Analyst reads structured JSON findings from all five ambient agents (Health Checker, Sentinel, ADHD Agent, Docs Agent, Task Manager) and correlates them into unified incident digests. It uses the system dependency graph to identify root causes, manages incident lifecycle (create → escalate → resolve), and sends Telegram digests with adaptive cadence.

## Architecture

```
shared-findings/*.json  →  Analyst  →  incidents.json + Telegram digest
     (5 collectors)         (LLM)       (cadence.json tracks timing)
```

### LLM Fallback Chain
1. **Claude Haiku** — primary (fast, cheap, good at structured JSON)
2. **GPT-4o** — fallback (if Anthropic API is down)
3. **Rules-based engine** — always available (no API needed)

## Behavior

- **New critical incident**: Immediate notification
- **Ongoing incident**: Hourly updates (4h+ → every 4h)
- **Recovery**: Immediate notification ("Backend restored after 3h15m")
- **All healthy**: Silent (daily digest at 08:00 if configured)
- **Circuit breaker**: Max 6 Telegram messages per hour
- **Dedup**: Identical digests are not sent twice

## Key Files

| File | Purpose |
|------|---------|
| `SOUL.md` | Core identity and principles |
| `IDENTITY.md` | Technical spec and dependencies |
| `HEARTBEAT.md` | Health checks and troubleshooting |
| `src/index.ts` | Main entry point |
| `src/incidents.ts` | Incident lifecycle management |
| `src/rules-fallback.ts` | Deterministic analysis engine |
| `src/llm.ts` | LLM fallback chain (Haiku → GPT-4o → rules) |
| `src/prompt.ts` | System prompt with dependency graph |
| `src/telegram.ts` | Telegram sender with circuit breaker |
| `src/types.ts` | Shared Finding Protocol types |
| `config/suppressions.json` | Known safe ports, processes, findings |

## Dependencies

- `shared-findings/` directory (populated by collector agents)
- Anthropic API key (optional — falls back to OpenAI then rules)
- OpenAI API key (optional — falls back to rules)
- Telegram bot token (optional — logs to stdout if missing)

## Automation

- **Schedule**: Every 15 minutes via PM2 `cron_restart`
- **Config**: `ecosystem.config.js` entry `analyst`
- **Build**: `cd analyst && npm run build`
- **Test**: `cd analyst && npm test` (11 tests covering incidents + rules fallback)
