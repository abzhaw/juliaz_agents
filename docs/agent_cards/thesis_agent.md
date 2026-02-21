# Agent Card: Thesis Agent

## What is it?
The Thesis Agent is a **documentation and research assistant** built specifically to support a master's thesis. It reads academic papers, helps draft thesis sections, and keeps a detailed record of everything that happens in this project — automatically.

## What problem does it solve?
Documenting a technical project for academic purposes is time-consuming and easy to forget. The Thesis Agent removes that burden by tracking progress automatically and helping structure research and writing when needed.

## How does it connect to the rest of the system?
The Thesis Agent works alongside Julia but independently. Julia does not usually invoke it — instead, the Thesis Agent listens to every conversation and takes notes in the background. It writes to its own dedicated folder (`thesis/`) and does not interfere with the rest of the system.

## What can it do?

### Research
- Reads academic papers and notes from a dedicated folder (`thesis/research_papers/`)
- Summarises the key findings of a paper when asked
- Finds relevant research for a given topic — but only from the approved folder

### Writing
- Drafts sections of the master's thesis
- Saves all drafts for the human to review and approve before they become official
- Marks unclear claims with "[CITATION NEEDED]" rather than guessing

### Logging (Automatic)
- After every 5 interactions, automatically updates two protocol documents:  
  — **Chronological log** (`protokoll_zeitlich.md`): what happened on which day  
  — **Thematic log** (`protokoll_thematisch.md`): how each topic evolved over the project
- Also maintains a full English `project_log.md`

## What can it NOT do?
- Use research from outside the approved folder — every citation must be traceable
- Publish drafts automatically — a human must review first
- Change the software, communication setup, or agent configurations

## Analogy
The Thesis Agent is like a **research assistant** at a university. You hand them a box of papers to read. They read them, summarise the useful parts, and help you draft sections of your thesis. They never make up citations — everything they reference is something you gave them to read.

---
*Updated: 2026-02-21 by Docs Agent*
