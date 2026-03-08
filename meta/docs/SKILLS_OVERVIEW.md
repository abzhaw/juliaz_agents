# Julia Multimodel Agent — Skills Overview

> **What this document covers**: Every skill available to Julia and her sub-agents, organized by where they live and what they do.
> **Maintained by**: The Docs Agent
> **Last updated**: 2026-02-22

---

## How Skills Work in Julia

A **skill** is a structured document (SKILL.md) that teaches an agent how to perform a specific task. Skills contain trigger conditions, step-by-step procedures, and behavioral guidelines. When a user sends Julia a message via Telegram, the system routes the request through the appropriate skills.

Skills live in different locations depending on who uses them:

| Location | Used By | Purpose |
|---|---|---|
| `openclaw/skills/` | OpenClaw (The Messenger) | Communication, bridging, system tools |
| `orchestrator/` (embedded) | Julia's Orchestrator (The Brain) | Conversation, routing, delegation |
| `cowork-mcp/` (via API) | Cowork Claude (The Second Brain) | Complex reasoning, writing, code review |
| Wish Companion (embedded) | Julia's Orchestrator | End-of-life wish fulfillment |

---

## 1. OpenClaw Skills — Communication & System Tools

These skills run inside OpenClaw and give Julia hands-on system access beyond just chatting.

### Communication Skills

| Skill | Location | What It Does |
|---|---|---|
| **julia-relay** | `openclaw/skills/julia-relay/` | Forwards Telegram messages to the Bridge (`POST /incoming`) and polls for replies. This is the primary message pipeline. |
| **julia-bridge** | `openclaw/skills/julia-bridge/` | Direct bridge interface with health checks, send, and receive. Used for bridge diagnostics and manual message routing. |

### System Tool Skills

| Skill | Location | What It Does |
|---|---|---|
| **code** | `openclaw/skills/code/` | Executes local code and scripts in various languages. Julia can run Python, Node.js, bash, and more on demand. |
| **tmux** | `openclaw/skills/tmux/` | Manages persistent terminal sessions. Julia can open, interact with, and monitor long-running processes. |

### Knowledge & External Access Skills

| Skill | Location | What It Does |
|---|---|---|
| **notion** | `openclaw/skills/notion/` | Searches and reads from Notion workspaces. Julia can look up knowledge base entries, databases, and pages. |
| **oracle** | `openclaw/skills/oracle/` | Queries the system Oracle for architectural and domain knowledge. Used for deep questions about the Julia system itself. |
| **email-aberer** | `openclaw/skills/email-aberer/` | Sends emails via SMTP using 1Password CLI for credential management. Julia can compose and send emails securely. |

### Self-Management Skills

| Skill | Location | What It Does |
|---|---|---|
| **openclaw-self-manage** | `openclaw/skills/openclaw-self-manage/` | Health checks, gateway restart, channel diagnosis. OpenClaw can detect and fix its own problems. |
| **openclaw-troubleshoot** | `openclaw/skills/openclaw-troubleshoot/` | Decision tree for common failures. Provides structured troubleshooting steps when something breaks. |

---

## 2. Orchestrator Capabilities — Julia's Brain

The orchestrator does not use traditional SKILL.md files — its capabilities are embedded in its system prompt and tool-calling configuration. These are the things Julia can *decide* to do when processing a message.

### Core Capabilities

| Capability | What It Does |
|---|---|
| **Conversation** | Natural multi-turn dialogue with per-contact memory. Julia remembers what you talked about last time. |
| **Intent Classification** | Determines whether a message is user conversation or a system-development request. Routes accordingly. |
| **Tool Calling** | Julia can invoke any registered MCP tool (Bridge tools, Cowork Claude tools) within her response loop. |
| **Multi-model Delegation** | Routes complex tasks to Claude via Cowork MCP when the task benefits from Claude's strengths. |
| **Per-contact Memory** | Maintains conversation history for each user, enabling context-aware responses across sessions. |

### Special Modes

| Mode | What It Does |
|---|---|
| **Wish Companion** | Activated naturally in conversation when Julia detects end-of-life context. Enables 5 capabilities: letter writing, memoir creation, witnessing, legacy box building, and living celebration planning. Based on palliative care research (Dignity Therapy, Being Mortal). Uses skills: `dying-wishes`, `wish-fulfillment`. |

---

## 3. Cowork Claude Skills — The Second Brain

When the orchestrator delegates to Claude via Cowork MCP, Claude has access to these specialized capabilities (exposed as MCP tools):

| Tool/Skill | What It Does |
|---|---|
| **claude_task** | General-purpose text reasoning. Any task that benefits from Claude's analytical depth. |
| **claude_multimodal_task** | Vision + text tasks. Send images alongside prompts for analysis. |
| **claude_code_review** | Structured code review covering security, performance, readability, and best practices. |
| **claude_summarize** | Content summarization in multiple formats: bullet points, paragraphs, or TL;DR. |
| **claude_brainstorm** | Idea generation, alternative approaches, and creative problem-solving. |

---

## 4. Ambient Agent Skills — Background Workers

These agents run alongside Julia and contribute their skills passively. They utilize a **Silent-Unless-Actionable Trigger Mechanic** — their skills evaluate the system state on a schedule, but they intentionally abort sending Telegram messages if the system is healthy.

### ADHD Agent — System Hygiene

| Capability | What It Does |
|---|---|
| **Duplicate skill detection** | Scans for near-duplicate skills across the workspace |
| **Orphan detection** | Finds agent folders with no active registration |
| **Dead skill scanning** | Identifies empty or broken SKILL.md files |
| **Trigger pollution alerts** | Detects overlapping routing conditions between skills |
| **Merge proposals** | Suggests combining small skills that belong together |

Status: 🟡 Designed, partially manual. Sends proposals via Telegram.

### Thesis Agent (Schreiber) — 10 Planned Skills

| Skill | What It Does |
|---|---|
| **thesis-structure** | Manages chapter architecture and outline of the master's thesis |
| **draft-writer** | Writes LaTeX sections in Wissenschaftsdeutsch (academic German) |
| **research-scout** | Finds relevant academic papers from the approved folder |
| **citation-gatekeeper** | Human-in-the-loop citation approval — never auto-cites |
| **code-to-thesis** | Extracts code examples from juliaz_agents for the thesis |
| **session-synthesizer** | Transforms conversation logs into thesis narrative |
| **argument-advisor** | Plays devil's advocate / thesis advisor role |
| **figure-architect** | Creates TikZ/PGF diagrams for the thesis |
| **latex-builder** | Compiles LaTeX documents locally |
| **thesis-tracker** | Monitors thesis progress and deadlines |

Status: 🟡 Design complete, implementation in progress.

### Julia Medium — Research Agent

| Capability | What It Does |
|---|---|
| **Topic monitoring** | Watches topics of interest and flags new developments |
| **Source summarization** | Reads and summarizes research sources concisely |
| **Follow-up drafting** | Generates follow-up questions for deeper research |
| **Article drafting** | Produces draft articles and analyses |

Status: 🟡 Designed, workspace created.

### Docs Agent — Documentation

| Capability | What It Does |
|---|---|
| **System overview updates** | Keeps `agent_system_overview.md` current |
| **Agent card maintenance** | Updates individual agent cards when agents change |
| **Change detection** | Reads configuration and workspace changes to know when docs need updating |

Status: ✅ Active.

---

## 5. Skill Summary — What Julia Can Do via Chat

When you message Julia on Telegram, she can:

**Communicate**: Receive and respond on Telegram (and soon WhatsApp, Slack, Discord)

**Think**: Process your message with GPT-4o, delegate complex reasoning to Claude

**Execute**: Run code in multiple languages, manage terminal sessions

**Remember**: Recall past conversations per contact, maintain context

**Research**: Query Notion knowledge bases, consult the Oracle, search for information

**Write**: Draft long-form content, summarize documents, brainstorm ideas

**Review**: Analyze code for security, performance, and readability

**Email**: Compose and send emails via secure SMTP

**Self-heal**: Diagnose and fix her own gateway and bridge problems

**Witness**: Hold space for end-of-life conversations (Wish Companion mode)

---

## 6. Meta-System Skills — Developer & Maintenance Tools

> **Important**: These skills are NOT available to Julia's user-facing chatbot. They power the coding agents (Antigravity, Claude Code) that *build and maintain* Julia. For the full explanation of why these are separate, see [`agent_system_overview.md`](agent_system_overview.md) section "The Meta-System vs The Product System."

The `.agent/skills/` directory contains **77 skills** used by meta-system agents. These are developer tools — they help Raphael and his AI coding assistants write better code, debug faster, and ship Julia more reliably.

### By Category

| Category | Count | Examples |
|---|---|---|
| **Agent & AI Patterns** | ~13 | agent-orchestration-patterns, agent-soul-design, llm-prompt-engineering, rag-retrieval-patterns, anthropic-claude-integration, openai-api-integration |
| **API & Backend Development** | ~12 | api-design-principles, api-security, rest-api-integration, nestjs-expert, nodejs-best-practices, streaming-api-design, webhook-design |
| **Frontend & UI** | ~8 | react-patterns, nextjs-best-practices, tailwind-css, framer-motion, dashboard-design, data-visualization, antigravity-frontend-dev |
| **Database & Data** | ~6 | database-design, postgresql-operations, prisma-expert, data-pipeline-patterns, json-data-patterns |
| **DevOps & Infrastructure** | ~12 | docker-expert, pm2-process-management, launchagent-macos, deployment-procedures, environment-config, system-monitoring, log-management, shell-scripting |
| **Testing & Code Quality** | ~6 | testing-patterns, e2e-testing-patterns, playwright-skill, code-review-excellence, clean-code, debugging-strategies |
| **Security** | ~4 | access-control, security-scanning, secrets-management, incident-response |
| **Communication & Protocols** | ~5 | mcp-protocol-design, mcp-client-patterns, telegram-bot-development, websocket-realtime, notification-systems |
| **Academic & Research** | ~5 | academic-writing-de, scientific-writing, citation-management, research-paper-analysis, thesis-agent-workflow |
| **Languages & Patterns** | ~6 | typescript-advanced-types, javascript-mastery, python-patterns, error-handling-patterns, git-advanced-workflows, cron-scheduling |

### How They Differ from Product Skills

| | Product Skills (`openclaw/skills/`) | Meta-System Skills (`.agent/skills/`) |
|---|---|---|
| **Used by** | OpenClaw, Julia-Orchestrator | Antigravity, Claude Code, ADHD Agent |
| **Purpose** | Serve end-users on Telegram | Build and maintain Julia |
| **Visible to users?** | Yes (indirectly) | No |
| **Format** | SKILL.md with triggers | SKILL.md with coding patterns |

---

## Cross-Reference

- For MCP server details and tool schemas: see `MCP_OVERVIEW.md`
- For system architecture: see `agent_system_overview.md`
- For planning reference: see `CODE_PLANNING_PROMPT.md`
- For individual agent details: see `agent_cards/`

---

*This document is maintained by the Docs Agent. Last updated: 2026-02-22.*
