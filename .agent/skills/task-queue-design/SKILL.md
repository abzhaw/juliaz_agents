---
name: task-queue-design
description: YAML task queues, priority, stale detection, weekly summaries. Use when building or extending Julia's TODO system and task-manager agent.
---

# Task Queue Design

## Julia's Task Format (TASK-NNN.yml)
```yaml
id: TASK-003
title: Fix bridge reconnection logic
status: open           # open | in-progress | blocked | done
priority: high         # low | medium | high | critical
created: 2026-02-23
updated: 2026-02-23
assigned_to: julia     # julia | antigravity | raphael
tags: [bridge, bug, backend]
description: |
  Bridge loses connection to orchestrator after 10min idle.
  Needs auto-reconnect with exponential backoff.
blockers: []
notes: []
```

## Task Index (todo/index.yml)
```yaml
total: 5
open: 3
in_progress: 1
done: 1
last_checked: 2026-02-23T07:00:00Z
tasks:
  - id: TASK-001
    title: Credential security plan
    status: open
    priority: critical
```

## Task Manager Patterns
```bash
# Count open tasks
grep -l "status: open" todo/TASK-*.yml | wc -l

# Find stale tasks (open > 7 days)
for f in todo/TASK-*.yml; do
  created=$(grep "^created:" "$f" | cut -d' ' -f2)
  status=$(grep "^status:" "$f" | cut -d' ' -f2)
  age=$(( ($(date +%s) - $(date -jf "%Y-%m-%d" "$created" +%s 2>/dev/null || echo 0)) / 86400 ))
  [ "$status" = "open" ] && [ "$age" -gt 7 ] && echo "STALE: $f (${age}d)"
done
```

## Priority Matrix
| Priority | SLA | Examples |
|---------|-----|---------|
| `critical` | < 24h | Security vulnerabilities, data loss |
| `high` | < 3d | Service down, broken feature |
| `medium` | < 1 week | Improvements, tech debt |
| `low` | Backlog | Nice-to-have, refactors |
