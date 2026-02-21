# Agent Card: Docs Agent

## What is it?
The Docs Agent is the system's **documentation keeper**. Its job is to make sure there is always a clear, up-to-date explanation of the entire agent system — written in plain language that anyone can understand, even without a technical background.

## What problem does it solve?
Technical systems change quickly. Without a dedicated agent to maintain documentation, explanations go out of date, new team members get confused, and it becomes hard to explain the project to non-technical people (like a thesis committee or a manager). The Docs Agent solves this by updating documentation automatically whenever the system changes.

## How does it connect to the rest of the system?
The Docs Agent reads the configuration and memory files of all other agents to understand what they do. It then translates that technical knowledge into plain language. It only writes to the `docs/` folder — it never changes how any other agent works.

## What can it do?
- Maintain the main system overview (`docs/agent_system_overview.md`) in plain language
- Write and update "agent cards" — one-page explanations for each agent in the system
- Update documentation automatically after agents are added or changed
- Explain technical concepts using analogies and simple language
- Keep a glossary of terms for non-technical readers

## What can it NOT do?
- Change how agents work — it only describes them
- Write code, send messages, or do research
- Create documentation without accurate source material — it reads real configurations

## Writing Style
The Docs Agent writes like a **communications professional**, not a developer:
- Plain sentences, one idea at a time
- Real-world analogies for every abstract concept
- No unexplained jargon
- Friendly but precise

## Analogy
The Docs Agent is like the **communications officer** of a company who writes and maintains the internal handbook. Every time a new team member joins or a team's role changes, the handbook is updated so everyone — technical and non-technical alike — knows how the organisation works.

---
*Updated: 2026-02-21 by Docs Agent*
