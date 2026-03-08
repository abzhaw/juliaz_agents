---
name: thesis-structure
description: Kapitelarchitektur und Gliederung der Masterarbeit. Verwaltet die Struktur, schlaegt vor wo Inhalte hingehoeren, validiert den logischen Fluss zwischen Kapiteln.
---

# Thesis Structure Skill

## Purpose

This skill manages the structural backbone of the Master Thesis. It maintains the chapter outline, validates logical flow between sections, and ensures every piece of content lands in the right place. The thesis is written in German, in LaTeX, and follows the conventions of a German computer science Master Thesis (Informatik Masterarbeit).

## Chapter Architecture

The thesis follows the canonical German CS thesis structure, adapted to the specific topic of multi-agent orchestration with the juliaz_agents system:

### 01-einleitung (Einleitung)
- **Purpose**: Frame the problem, motivate the work, state research questions, outline the thesis structure
- **Contents**:
  - Problemstellung: Why is multi-agent orchestration relevant now?
  - Motivation: Personal and technical motivation (the juliaz_agents system as a real-world case)
  - Forschungsfragen: 2-3 precise research questions
  - Aufbau der Arbeit: Brief overview of each chapter
- **Length target**: 4-6 pages
- **Dependencies**: None (entry point)

### 02-grundlagen (Grundlagen)
- **Purpose**: Define all foundational concepts the reader needs before encountering the architecture
- **Contents**:
  - Multi-Agent-Systeme (MAS): Definition, properties, coordination models
  - Large Language Models (LLMs): Architecture, capabilities, limitations
  - Tool Use / Function Calling: How LLMs interact with external tools
  - Model Context Protocol (MCP): Anthropic's protocol for tool integration
  - Agentic AI: Definition and characteristics of AI agents vs. chatbots
  - Orchestrierung: Patterns for coordinating multiple agents
- **Length target**: 15-20 pages
- **Dependencies**: None (provides definitions for all subsequent chapters)

### 03-verwandte-arbeiten (Verwandte Arbeiten)
- **Purpose**: Survey existing multi-agent frameworks and position this thesis within the research landscape
- **Contents**:
  - Existing frameworks: AutoGPT, CrewAI, LangGraph, Microsoft AutoGen, MetaGPT
  - Academic research on multi-agent coordination
  - Tool-use research: Toolformer, Gorilla, ToolLLM
  - MCP ecosystem and related protocols
  - Gap analysis: What existing work does not cover that this thesis addresses
- **Length target**: 10-15 pages
- **Dependencies**: 02-grundlagen (uses terminology defined there)

### 04-konzept (Konzept und Architektur)
- **Purpose**: Present the architecture of juliaz_agents as a designed solution to the research questions
- **Contents**:
  - Systemuebersicht: High-level architecture diagram and component overview
  - Agentenmodell: Julia (orchestrator), OpenClaw (gateway), Cowork-MCP (sub-agent), ADHD Agent
  - Kommunikationsarchitektur: MCP bridge, message passing, tool calling flow
  - Entwurfsentscheidungen: Why GPT-4o for orchestration, why MCP for tool relay, why multi-model
  - Sicherheitskonzept: 1Password integration, secret management
  - Erweiterbarkeit: How new agents and skills are added
- **Length target**: 15-20 pages
- **Dependencies**: 02-grundlagen (MAS definitions, MCP protocol), 03-verwandte-arbeiten (differentiation from existing work)

### 05-implementierung (Implementierung)
- **Purpose**: Describe the technical realization of the architecture from chapter 04
- **Contents**:
  - Technologiestack: TypeScript, Python, Next.js, Docker, PM2
  - Julia Orchestrator: openai.ts tool-calling loop, prompt engineering, memory management
  - OpenClaw Telegram Gateway: Python skill system, email integration
  - MCP Bridge: WebSocket relay, message format, ~200 lines implementation
  - Cowork-MCP: Claude as sub-agent via MCP, delegation patterns
  - Frontend Dashboard: Next.js 15, Vercel AI SDK, real-time updates
  - Backend API: REST + Postgres, session management
  - ADHD Agent: Ambient system hygiene, skill scanning
  - Deployment: PM2 ecosystem, startup scripts, log management
- **Length target**: 20-25 pages
- **Dependencies**: 04-konzept (implements what was designed)

### 06-evaluation (Evaluation)
- **Purpose**: Assess the system against research questions with concrete evidence
- **Contents**:
  - Evaluationsmethodik: How the system is evaluated (case studies, qualitative analysis)
  - Fallstudie 1 — Wish Companion: Multi-agent gift recommendation workflow
  - Fallstudie 2 — ADHD Agent: Ambient system maintenance and skill scanning
  - Analyse der Orchestrierung: Message flow analysis, latency, reliability
  - Erweiterbarkeit bewerten: How easily new agents were added
  - Limitationen: What the system cannot do, failure modes
- **Length target**: 15-20 pages
- **Dependencies**: 04-konzept (evaluates against design goals), 05-implementierung (references specific code)

### 07-zusammenfassung (Zusammenfassung und Ausblick)
- **Purpose**: Conclude the thesis, summarize findings, reflect, look ahead
- **Contents**:
  - Zusammenfassung der Ergebnisse: Answers to each research question
  - Beitraege der Arbeit: What this thesis contributes to the field
  - Reflexion: Lessons learned, challenges encountered
  - Ausblick: Future work, potential improvements, research directions
- **Length target**: 4-6 pages
- **Dependencies**: 06-evaluation (summarizes evaluation results)

## Structure File

The canonical structure is maintained in `thesis/latex/structure.json`. This file is the single source of truth for the thesis outline.

```json
{
  "thesis_title": "Multi-Agent-Orchestrierung mit Large Language Models: Entwurf und Implementierung des juliaz_agents-Systems",
  "author": "Raphael",
  "chapters": [
    {
      "id": "01-einleitung",
      "title": "Einleitung",
      "file": "chapters/01-einleitung.tex",
      "sections": [
        {"id": "1.1", "title": "Problemstellung und Motivation"},
        {"id": "1.2", "title": "Forschungsfragen"},
        {"id": "1.3", "title": "Aufbau der Arbeit"}
      ],
      "status": "draft",
      "word_count_target": 2000,
      "dependencies": []
    }
  ]
}
```

## Operations

### Place Content
Given a topic or piece of content, determine which chapter and section it belongs to:
- Analyze the content's nature (theoretical, architectural, implementation detail, evaluation result)
- Match against chapter purposes defined above
- If ambiguous, suggest the primary location and mention alternatives
- Example: "MCP message format specification" -> 02-grundlagen (definition) AND 05-implementierung (concrete usage)

### Validate Flow
Check that the thesis argument progresses logically:
- Every term used in chapter N must be defined in chapter N or earlier
- The Konzept chapter must reference Grundlagen definitions
- The Implementierung chapter must map 1:1 to Konzept components
- The Evaluation must address all Forschungsfragen from Einleitung
- No forward references without explicit "siehe Kapitel X" markers

### Track Dependencies
Maintain a dependency graph between sections:
- `02-grundlagen:MAS` -> used by `04-konzept:Agentenmodell`
- `02-grundlagen:MCP` -> used by `04-konzept:Kommunikationsarchitektur`, `05-implementierung:MCP-Bridge`
- `02-grundlagen:Tool-Use` -> used by `04-konzept:Entwurfsentscheidungen`, `05-implementierung:Julia-Orchestrator`
- Flag violations: "Chapter 04 references 'Skill-System' but this is not defined in 02-grundlagen"

### Propose Restructuring
When chapters grow unbalanced:
- Compare actual page counts against targets
- Identify sections that could be split or merged
- Suggest promotions (subsection -> section) or demotions (section -> subsection)
- Never restructure without presenting the proposal to the human first

## Rules

1. The structure file is updated only through this skill — no other skill modifies `structure.json`
2. Chapter IDs (`01-einleitung`, etc.) are stable identifiers used across all skills
3. Section numbering follows LaTeX conventions (1.1, 1.2, etc.)
4. All structural changes are proposals until the human approves
5. The chapter order is fixed unless the human explicitly requests a change
