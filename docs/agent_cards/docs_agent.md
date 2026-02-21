# Agent Card: Docs Agent

## What is it?
The Docs Agent is a specialised agent responsible for keeping **plain-language documentation** up to date. Every time Julia's system changes — a component is added, a role shifts, a bug is fixed — the Docs Agent updates the documentation so it stays accurate.

## What problem does it solve?
Technical systems change fast. Documentation usually lags behind. The Docs Agent closes that gap by automatically updating docs whenever the system changes, so that the developer (and future readers) always have an accurate picture of what the system does.

## How does it connect to the rest of the system?
The Docs Agent reads change signals from the rest of the system — configuration files, agent workspaces, commit context — and updates the documentation accordingly. It does not modify any agent's code or behaviour.

```
Any system change → Docs Agent reads config/context → Updates docs/
```

## What can it do?
- Update `docs/agent_system_overview.md` when the system changes
- Update individual agent cards in `docs/agent_cards/`
- Read any agent's configuration or workspace to understand what changed
- Maintain plain-language explanations that non-developers can understand

## What can it NOT do?
- Change how any agent works — it only describes them
- Write code
- Send messages
- Publish documentation automatically without content review

## Workspace
`docs/` — all documentation output lands here

## Analogy
The Docs Agent is like a company's communications officer who maintains the internal handbook. Every time someone's role changes or a new team joins, they update the handbook so everyone stays on the same page.

---
*Updated: 2026-02-21 by Docs Agent*
