---
name: todo-workflow-design
description: TODO systems for agents, TASK-NNN format, agent-readable specs. Use when creating, reading, or managing tasks in Julia's todo/ directory.
---

# TODO Workflow Design

## Standard Task Lifecycle
```
open → in-progress → done
open → blocked → open (when unblocked)
open → cancelled (if no longer needed)
```

## Creating a New Task
```yaml
# File: todo/TASK-004.yml
id: TASK-004
title: Implement streaming chat in frontend  
status: open
priority: medium
created: 2026-02-23
updated: 2026-02-23
assigned_to: antigravity
tags: [frontend, streaming, chat]
description: |
  Add SSE streaming to the chat component so responses appear
  token-by-token instead of all at once. Use the Vercel AI SDK
  useChat hook with the existing /api/chat route.
blockers: []
notes:
  - Consider fallback for browsers that don't support streaming
```

## Reading/Updating from an Agent
```bash
# Find all open high-priority tasks
grep -l "status: open" todo/TASK-*.yml | xargs grep -l "priority: high"

# Mark as in-progress
sed -i '' 's/status: open/status: in-progress/' todo/TASK-004.yml

# Update the timestamp
sed -i '' "s/updated: .*/updated: $(date +%Y-%m-%d)/" todo/TASK-004.yml
```

## Index Update After Changes
```yaml
# todo/index.yml — update after each task change
total: 6
open: 4
in_progress: 1
done: 1
last_checked: 2026-02-23T07:30:00Z
```

## Tagging Convention
| Tag | Meaning |
|-----|---------|
| `security` | Security-related work |
| `bug` | Broken behavior to fix |
| `frontend` | UI/dashboard work |
| `agent` | Agent behavior change |
| `ops` | Infrastructure/devops |
| `thesis` | Thesis-related task |
