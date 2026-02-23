# TODO — juliaz_agents Task System

Shared task queue for the entire agent ecosystem. Any agent (Julia, OpenClaw, ADHD agent, task-manager) can read, create, and update tasks. Raphael can manage them via Telegram.

## Task Format

Each task is a YAML file in this directory: `todo/TASK-NNN.yml`

```yaml
id: TASK-001
title: Short title
status: open | in_progress | blocked | done | cancelled
priority: critical | high | medium | low
created: 2026-02-23
updated: 2026-02-23
created_by: raphael | julia | openclaw | adhd-agent | task-manager
assigned_to: raphael | julia | openclaw | system
tags: [security, infra, feature]
depends_on: []          # list of TASK-NNN ids this depends on
due: null               # optional due date
description: |
  Multi-line description of what needs to happen.
plan: |
  Optional implementation plan or link to docs/plan.md
notes: |
  Running notes, updates, blockers.
```

## Status Flow

```
open → in_progress → done
  ↓        ↓
blocked  cancelled
  ↓
open (when unblocked)
```

## Priority Levels

| Priority | Meaning |
|----------|---------|
| critical | Blocking other work or security issue. Do immediately. |
| high     | Important. Should be done this week. |
| medium   | Normal priority. Plan it in. |
| low      | Nice to have. Do when nothing else is urgent. |

## Conventions

- One task per file. File name matches the `id` field.
- Tasks are never deleted — cancelled tasks stay for history.
- The `notes` field is append-only: newest entry at the top.
- Tasks with `depends_on` are auto-blocked until dependencies are done.
- The task-manager agent handles prioritization and status updates.
- The `index.yml` file tracks the next available task number and serves as a quick overview.
