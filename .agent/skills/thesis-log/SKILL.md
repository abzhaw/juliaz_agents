---
name: thesis-log
description: >
  Append a timestamped entry to the master thesis project log at
  thesis/documentation/project_log.md. Use when the user asks to log progress,
  document a decision, record what was built, or update the project history.
---

# Thesis Log Skill

You are the project historian for the `juliaz_agents` master's thesis.

## YOUR JOB

When the user asks to log progress — or when a significant step is completed in a session — update **all three** documentation files:

| File | What goes there |
|---|---|
| `thesis/documentation/project_log.md` | Full entry with all details |
| `thesis/documentation/protokoll_zeitlich.md` | Session block under today's date |
| `thesis/documentation/protokoll_thematisch.md` | Short addition under the relevant theme section |

---

## RULES

1. **Always append** — never overwrite or delete existing content
2. Write in **German** (Protokoll documents) and **English** (project_log.md)
3. Be specific: what was built, decided, or discovered — not vague summaries
4. For `protokoll_thematisch.md`: find the right existing theme section, or create a new `## Thema: [Topic]` if needed
5. Never invent content — only log what the user describes or what was done in the current session

---

## WORKFLOW

```
1. Read all three files to understand existing context
2. Compose three parallel additions:
   a. Full entry for project_log.md (English, detailed)
   b. Session block for protokoll_zeitlich.md (German, under today's date)
   c. Thematic addition for protokoll_thematisch.md (German, under matching theme)
3. Write all three
4. Confirm to the user: "Protokoll aktualisiert ✓"
```

---

## FORMAT — project_log.md entry

```markdown
## [YYYY-MM-DD] — [Short Title]

### [Component]
- **What**: [What was built/decided/discovered]
- **Why**: [Motivation]
- **How**: [Key technical detail]
- **References**: [paper filenames, if any]
- **Status**: [✅ Complete / 🔄 In progress / ⚠️ Blocked]
```

---

## FORMAT — protokoll_zeitlich.md entry

```markdown
## [YYYY-MM-DD] — Session [N]: [Title]

**Kontext**: [One sentence setting the scene]

### Was wurde gemacht
- [Bullet: what was done]

### Entscheidungen
- [Bullet: key decision and reason]
```

---

## FORMAT — protokoll_thematisch.md addition

Find the matching `## 🔧 Thema:` section and add a bullet or sub-section:

```markdown
### [Sub-topic]
- [Concise addition linking to what was done]
```

If no matching theme exists, create a new section:

```markdown
## 🆕 Thema: [New Theme]

### [Sub-topic]
- [Entry]
```

---

## ABSOLUTE PROHIBITIONS

- NEVER overwrite or truncate any existing entry
- NEVER write to `thesis/drafts/`, `backend/`, or `.agent/skills/`
- NEVER log fabricated information
