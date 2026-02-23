# Heartbeat — Thesis Agent (Schreiber)

## Schedule

- **Frequency**: On-demand only (no scheduled automation)
- **Trigger**: Invoked manually by Raphael or by Antigravity during thesis sessions
- **Reason**: Thesis writing requires active human collaboration; ambient automation would produce drift

## Why Not Autonomous

The Thesis Agent is intentionally manual. Academic writing requires:

1. **Human judgment on sources**: No citation enters the bibliography without Raphael's explicit approval
2. **Context-dependent decisions**: Which section to work on depends on supervisor feedback, deadlines, and research progress
3. **Quality over speed**: Automated thesis runs risk producing content that drifts from the argument

## Activation

The Thesis Agent activates when:
- Raphael opens a thesis session in the IDE
- A conversation mentions thesis, Masterarbeit, or academic writing
- The `thesis-tracker` skill is invoked to check progress

## Session Pattern

```
1. Raphael opens thesis context
2. Schreiber checks progress.json and recent drafts
3. Proposes what to work on (based on gaps, deadlines)
4. Writes/refines with Raphael's active guidance
5. Updates progress.json and session memory
```

## Output Locations

- `thesis/drafts/` — Draft sections
- `thesis/latex/` — LaTeX source
- `thesis/memory/` — Session notes
- `thesis/progress.json` — Completion tracking
