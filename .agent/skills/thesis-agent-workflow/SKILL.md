---
name: thesis-agent-workflow
description: Agent-assisted thesis writing loops, draft-review-revise cycles. Use when the thesis agent is writing, expanding, or refining sections of Raphael's master's thesis.
---

# Thesis Agent Workflow

## Writing Loop Pattern
```
1. LOAD      — read current section draft from thesis/drafts/
2. RESEARCH  — retrieve relevant papers from thesis/research_papers/
3. DRAFT     — LLM generates or expands content with German academic tone
4. SAVE      — write to thesis/drafts/section_name.md with timestamp
5. LOG       — append session to thesis/memory/session_buffer.md
6. REVIEW    — (optional) human or LLM reviews draft quality
```

## Session Buffer Format (thesis/memory/session_buffer.md)
```markdown
## Session 2026-02-23

### What was done
- Expanded Kapitel 2.3 (Methodologie) by ~500 words
- Added citation: Müller et al. (2024)

### Key decisions
- Used IMRaD structure for methodology section
- Cited 3 papers on multi-agent systems

### Next steps
- Add empirical validation sub-section
- Review Kapitel 3 draft
```

## Draft File Convention
```
thesis/drafts/
  kapitel_1_einleitung.md
  kapitel_2_grundlagen.md
  kapitel_3_methodik.md
  kapitel_4_ergebnisse.md
  kapitel_5_diskussion.md
  kapitel_6_fazit.md
  abstract_de.md
  abstract_en.md
```

## LLM Prompt for Expansion
```
Du bist ein akademischer Autor. Erweitere den folgenden Abschnitt einer 
deutschen Masterarbeit um 300-500 Wörter. Verwende formale Wissenschaftssprache, 
Passiv wo angemessen, und zitiere [citation] gemäß APA-Format.

Bisheriger Text:
[current draft]

Schreibe die erweiterte Version:
```
