# Docs Agent — Heartbeat

## Health Indicators

- **Healthy**: `[docs-agent] Documentation check complete. N proposals generated.` in PM2 logs
- **Healthy (no changes)**: `[docs-agent] All synchronized, no changes. Skipping LLM.`
- **Degraded**: `[docs-agent] Using rules-based fallback (no LLM available)` — LLMs unavailable but still functioning
- **Error**: `[docs-agent] Fatal error:` in PM2 error logs

## Logs

```bash
pm2 logs docs-agent --lines 20
```

## Manual Run

```bash
cd /Users/raphael/juliaz_agents/docs-agent && node dist/index.js
```

## Test Suite

```bash
cd /Users/raphael/juliaz_agents/docs-agent && npm test
```

## Key State Files

| File | Purpose |
|------|---------|
| `docs-agent/memory/state.json` | Last run timestamp, git hash, file snapshot |
| `docs-agent/memory/cadence.json` | Telegram circuit breaker and dedup state |
| `docs-agent/proposals/index.json` | Proposal manifest (pending/applied/rejected) |
| `shared-findings/docs-agent.json` | Latest findings for Analyst consumption |

## Proposals

To review generated proposals:
```bash
cat docs-agent/proposals/index.json | python3 -m json.tool
ls docs-agent/proposals/*.md
```

To clear old proposals:
```bash
rm docs-agent/proposals/*.md
echo '{"last_updated":"","proposals":[]}' > docs-agent/proposals/index.json
```
