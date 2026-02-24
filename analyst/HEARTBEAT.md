# Analyst — Heartbeat

## Health Indicators
- **Healthy**: `[analyst] Analysis complete. X open incidents, Y resolved.` in PM2 logs
- **Degraded**: `[analyst] Using rules-based fallback` — LLMs unavailable but still functioning
- **Error**: `[analyst] Fatal error:` in PM2 error logs

## Logs
```bash
pm2 logs analyst --lines 20
```

## Manual Run
```bash
cd /Users/raphael/juliaz_agents/analyst && node dist/index.js
```

## Test Suite
```bash
cd /Users/raphael/juliaz_agents/analyst && npm test
```

## Key State Files
| File | Purpose |
|------|---------|
| `shared-findings/incidents.json` | Open and resolved incidents |
| `shared-findings/cadence.json` | Notification timing and dedup state |
| `analyst/config/suppressions.json` | Known safe ports, processes, findings |

## Circuit Breaker
Max 6 Telegram messages per hour. Reset at the top of each hour.
Check: `cat shared-findings/cadence.json | python3 -m json.tool`

## Suppression Management
To suppress a noisy finding:
```json
// analyst/config/suppressions.json → suppressed_findings
"finding-id": {
  "reason": "Known false positive because...",
  "suppressed_by": "raphael",
  "date": "2026-02-24"
}
```
