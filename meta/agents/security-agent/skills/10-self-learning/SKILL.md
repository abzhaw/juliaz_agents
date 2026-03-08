---
name: self-learning
description: After each daily scan, analyze findings, update the baseline, suppress dismissed issues, and improve future heuristics
---

# Skill: Self-Learning Engine

## Purpose
Sentinel gets smarter over time. Every report is a learning opportunity. This skill runs last in the daily cycle and updates the agent's memory so tomorrow's report is better than today's.

## What It Does

### 1. Compare Today vs. Yesterday
- What new findings appeared today that weren't yesterday?
- What findings disappeared (resolved)?
- What findings are recurring for N consecutive days?

### 2. Update Baseline
- Add confirmed-safe findings to `memory/baseline.json`
- This suppresses them from future reports so the signal stays clean

### 3. Apply Suppression List
- If Raphael replied "dismiss" to a finding (tracked in `memory/suppressed.json`), skip it in future reports
- Suppressed findings still logged silently but not surfaced

### 4. Track Severity Trends
- Is the overall security posture improving or degrading week-over-week?
- Which service generates the most findings? (focus attention there)

### 5. Update Learnings Journal
- Append to `memory/learnings.md` with what changed today
- Note any false positives that should be suppressed
- Note any new patterns discovered

## Memory Files

### `memory/baseline.json`
```json
{
  "known_safe": [
    {"check": "port-scan", "finding": "port 5432 on 127.0.0.1", "added": "2026-02-23"},
    {"check": "process-audit", "finding": "node pm2 daemon", "added": "2026-02-23"}
  ],
  "last_updated": "2026-02-23"
}
```

### `memory/suppressed.json`
```json
{
  "suppressed": [
    {"check": "api-security", "finding": "no rate limiting on bridge", "dismissed_by": "raphael", "date": "2026-02-23", "reason": "internal only"}
  ]
}
```

### `memory/learnings.md`
```markdown
## 2026-02-23
- First scan complete. Baseline established.
- 3 findings dismissed by Raphael (bridge rate limiting — internal only)
- New pattern: docker container restarts correlate with bridge error spikes
```

## Severity Rules
This skill has no severity output — it is the system's memory, not a scanner.

## Output Format (in daily report)
```
SELF-LEARNING UPDATE
📚 Baseline: 12 known-safe items
🚫 Suppressed: 3 items (dismissed by Raphael)
📈 Trend: Security posture IMPROVING (6→3 findings week-over-week)
🔍 Focus area this week: credential hygiene (3/10 findings)
```

## Principles
- **Never suppress a Critical or High finding automatically** — always surface to Raphael
- **Trend over signal** — a persistent Low finding that never gets fixed is worth more attention than a one-off Medium
- **Explain changes** — always note why something was added to baseline or suppressed
