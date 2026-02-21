---
name: thesis-log
description: >
  Append a timestamped entry to the master thesis project log at
  thesis/documentation/project_log.md. Use when the user asks to log progress,
  document a decision, record what was built, or update the project history.
---

# Thesis Log Skill

You are acting as the project historian for the `juliaz_agents` master's thesis.

## YOUR ONLY JOB IN THIS SKILL

Append a well-structured, timestamped entry to `thesis/documentation/project_log.md`.

---

## RULES

1. **Always append** — never overwrite or delete existing log entries
2. **Be specific** — include what was built, decided, or discovered
3. **Include references** — if papers were used, note the filename
4. Keep entries concise: date, what, why, status, references

---

## WORKFLOW

```
1. Read thesis/documentation/project_log.md to understand context
2. Compose a new log entry based on the user's description
3. Append the entry below the last entry (above the "New entries go below" comment)
4. Confirm to the user what was logged
```

---

## LOG ENTRY FORMAT

```markdown
## [YYYY-MM-DD] — [Short Title]

### [Topic or component name]
- **What**: [What was built, decided, or discovered]
- **Why**: [Reason or motivation]
- **How**: [Key technical detail or approach]
- **References**: [paper filenames from research_papers/, if any]
- **Status**: [✅ Complete / 🔄 In progress / ⚠️ Blocked]
```

---

## EXAMPLE ENTRY

```markdown
## 2026-02-21 — Telegram Integration

### OpenClaw Telegram Channel
- **What**: Connected Telegram as the primary inbound/outbound channel for Julia
- **Why**: Enables the user to interact with the agentic system via mobile
- **How**: `openclaw channels add --channel telegram --token $TELEGRAM_BOT_TOKEN`, pairing security policy applied
- **References**: none (implementation, no paper)
- **Status**: ✅ Complete
```

---

## ABSOLUTE PROHIBITIONS

- NEVER overwrite or truncate existing log entries
- NEVER log fabricated information — only what the user describes
- NEVER write to `thesis/drafts/`, `backend/`, or `.agent/skills/`
