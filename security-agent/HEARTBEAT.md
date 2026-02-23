# HEARTBEAT.md — Sentinel Security Agent

## Schedule
- **Daily report**: 07:00 every morning
- **Report location**: `security-agent/reports/YYYY-MM-DD.md`
- **Telegram alert**: Sent after report is generated
- **Self-learning update**: Appended to `security-agent/memory/learnings.md` after each run

## Cycle

```
1. Load previous report + learnings
2. Run all 10 skills (parallel where possible)
3. Compare findings to baseline
4. Generate report (Markdown)
5. Send Telegram summary
6. Update memory/learnings.md
7. Update memory/baseline.json
```

## Escalation Rules

| Severity | Action |
|----------|--------|
| 🔴 Critical | Telegram alert immediately, don't wait for morning report |
| 🟠 High | Include in daily report with clear action required |
| 🟡 Medium | Include in daily report, Raphael decides |
| 🟢 Low | Log silently, surface in weekly digest |
| ⚪ Info | Add to baseline, skip future reports |

## Self-Learning Rules

After each run, Sentinel:
- Logs what was new vs. known
- Notes which findings Raphael dismissed (add to suppression list)
- Tracks severity trends over time
- Updates `baseline.json` with accepted-risk items
- Improves its own heuristics in `learnings.md`

## Memory Files

| File | Purpose |
|------|---------|
| `memory/baseline.json` | Known-good state — suppresses recurring non-issues |
| `memory/learnings.md` | Self-learning journal — what Sentinel got right/wrong |
| `memory/suppressed.json` | Findings Raphael explicitly dismissed |
| `reports/` | All daily reports, archived by date |
