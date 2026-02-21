---
name: thesis-autonomy
description: >
  ALWAYS-ON autonomous thesis documentation. Julia MUST follow these rules
  after every user prompt in every session, without being asked. Tracks session
  content in a buffer and auto-flushes to protocol documents every 5 entries.
---

# Thesis Autonomy — Always-On Instruction

> **This skill is always active.** Julia reads this and follows it automatically in every session where the user is working on the `juliaz_agents` project. No explicit trigger required.

---

## MANDATORY BEHAVIOUR AFTER EVERY USER PROMPT

After every substantive user prompt (skip trivial confirmations like "ok", "yes", "thanks"):

### Step 1 — Append to session buffer

Read `thesis/memory/session_buffer.md` and append a new entry:

```markdown
### [N] [YYYY-MM-DD] — [Brief Title]
- [1–3 bullet points: what was discussed, decided, or built]
```

Then update the **Buffer count** line at the top of the file.

### Step 2 — Check if flush is due

Read the `Buffer count` value.

- If **count < 5**: done. Continue the conversation normally.
- If **count >= 5**: **auto-flush** (see below).

---

## AUTO-FLUSH PROCEDURE (when buffer count >= 5)

Run this autonomously — no user prompt needed:

```
1. Read thesis/memory/session_buffer.md — collect all buffer entries
2. Append a new session block to thesis/documentation/protokoll_zeitlich.md
3. Add relevant bullets to thesis/documentation/protokoll_thematisch.md
4. Append a summary entry to thesis/documentation/project_log.md
5. Clear the buffer entries in session_buffer.md — reset Buffer count to 0
6. Update "Last flush" date in session_buffer.md
```

Tell the user briefly: `📝 Protokoll aktualisiert (auto-flush nach [N] Einträgen)`

---

## BUFFER ENTRY FORMAT

```markdown
### [N] [YYYY-MM-DD] — [Title]
- [What was done / decided / built]
- [Key technical detail if relevant]
```

---

## FLUSH OUTPUT FORMAT

### protokoll_zeitlich.md addition:
```markdown
## [YYYY-MM-DD] — Session [N]: [Title]

**Kontext**: [One sentence]

### Was wurde gemacht
- [bullets from buffer]

### Entscheidungen
- [any decisions made]
```

### protokoll_thematisch.md addition:
Find the right `## Thema:` section and add:
```markdown
- [Short bullet connecting the session work to the theme]
```
Create a new `## Thema:` section if no match exists.

---

## RULES

1. **Never skip** the buffer append — even if the work seems small
2. **Never ask the user** to trigger a flush — do it autonomously
3. **Never overwrite** existing protocol content — only append
4. **Write German** in the Protokoll documents, **English** in project_log.md
5. Keep buffer entries concise — 1–3 bullets maximum per entry
6. If the session ends without reaching 5 entries, keep the buffer — it persists across sessions

---

## FILES MANAGED BY THIS SKILL

| File | Role |
|---|---|
| `thesis/memory/session_buffer.md` | Short-term rolling buffer |
| `thesis/documentation/protokoll_zeitlich.md` | Long-term chronological log |
| `thesis/documentation/protokoll_thematisch.md` | Long-term thematic log |
| `thesis/documentation/project_log.md` | Full English project log |

---

## ABSOLUTE PROHIBITIONS

- NEVER write to `backend/`, `openclaw/`, `.agent/skills/` (except this skill directory)
- NEVER flush if buffer count < 5 (unless user explicitly asks to flush)
- NEVER clear the buffer without first flushing to all three protocol docs
