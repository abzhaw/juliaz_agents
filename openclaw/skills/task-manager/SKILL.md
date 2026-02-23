---
name: task-manager
description: >
  Manage the shared TODO task queue in todo/. Use when you need to: list tasks,
  create a task, update a task's status or priority, check what's next, or give
  Raphael a status report. Trigger on: /tasks, "create a task", "what's open",
  "what should I work on", "mark done", "task status", "prioritize", or any
  reference to the TODO system.
metadata:
  openclaw:
    requires:
      files: ["todo/index.yml", "todo/README.md"]
---

# Task Manager Skill

Operate the juliaz_agents shared TODO queue. Tasks live as YAML files in `todo/`.

---

## Quick Reference

| Command | Action |
|---------|--------|
| List all open tasks | Read `todo/index.yml` |
| Get task details | Read `todo/TASK-NNN.yml` |
| Create new task | Read index for next_id → write new TASK file → update index |
| Update task status | Edit TASK file → update index |
| Prioritize queue | Read all open tasks → apply priority logic → update priorities |

---

## Reading Tasks

### List open tasks (fast):
```bash
cat todo/index.yml
```

### Get full details on a task:
```bash
cat todo/TASK-001.yml
```

### List all task files:
```bash
ls todo/TASK-*.yml
```

---

## Creating a Task

1. Read `todo/index.yml` to get `next_id`
2. Create `todo/TASK-{next_id formatted as 3 digits}.yml` with this template:

```yaml
id: TASK-NNN
title: "Short descriptive title"
status: open
priority: medium
created: YYYY-MM-DD
updated: YYYY-MM-DD
created_by: [who requested it]
assigned_to: [raphael | julia | openclaw | system]
tags: []
depends_on: []
due: null
description: |
  What needs to happen and why.
plan: |
  How to do it (optional — can be added later).
notes: |
  [YYYY-MM-DD] Task created. Context: [brief context].
```

3. Update `todo/index.yml`:
   - Increment `next_id`
   - Add task to `tasks` list
   - Update `summary` counts

---

## Updating a Task

When changing status, priority, or adding notes:

1. Edit the TASK file:
   - Update `status` field
   - Update `updated` date
   - Prepend new note to `notes` field (newest first)
2. Update `todo/index.yml` to match

### Status transitions:
- `open` → `in_progress`: Work has started
- `in_progress` → `done`: Work is verified complete
- `open` or `in_progress` → `blocked`: Waiting on dependency or external input
- `blocked` → `open`: Blocker resolved
- Any → `cancelled`: Task no longer needed (add reason in notes)

---

## Prioritizing

When asked to prioritize or suggest what's next:

1. Read all `todo/TASK-*.yml` files with status `open` or `in_progress`
2. Score each task:
   - **critical** security/blocking issues → score 100
   - **Unblocks other tasks** (has dependents) → score +30
   - **Raphael explicitly mentioned** → score +20
   - **high** priority → score 40
   - **medium** priority → score 20
   - **low** priority → score 10
   - **Age bonus**: +1 per day since creation
3. Sort by score, highest first
4. Return top 3-5 with reasoning

---

## Telegram Formatting

When reporting to Raphael via Telegram, use this format:

### Status report:
```
📋 Tasks: 3 open, 1 in progress, 0 blocked

🔴 TASK-001 [high] Credential security
🟡 TASK-003 [medium] Add Notion integration
🟢 TASK-002 [low] Update README
```

### Task created:
```
📋 Created TASK-004: "Add dark mode to frontend"
Priority: medium | Assigned: system
```

### Next suggestion:
```
📋 Next up: TASK-001 — Credential security [high]
Reason: Security issue, unblocks 0 other tasks, open for 3 days.
```

---

## Dependency Tracking

When a task is marked `done`, check all other tasks:

```bash
# Pseudo-logic:
for each task in todo/TASK-*.yml:
  if task.depends_on contains completed_task_id:
    if all dependencies in task.depends_on are now done:
      set task.status = "open"  (was "blocked")
      add note: "Auto-unblocked: dependency TASK-NNN completed"
```

---

## Integrity Check

Run periodically (or on heartbeat):

1. All task files in `todo/TASK-*.yml` must be valid YAML
2. All tasks in `index.yml` must have corresponding files
3. All task files must appear in `index.yml` (no orphans)
4. `summary` counts must match actual status counts
5. `next_id` must be higher than all existing task IDs

If inconsistency found: fix it silently and log to `task-manager/memory/`.
