# Project Log — `juliaz_agents`

> This log documents every major step, decision, and milestone in the `juliaz_agents` project.  
> Maintained by the Thesis Agent. Entries are added by running the `thesis-log` skill.

---

## 2026-02-21 — Initial System Setup

### Backend REST API
- **What**: Built a Tasks REST API as the primary software artefact
- **Stack**: Node.js · Express · TypeScript · Prisma ORM · PostgreSQL 15 · Docker Compose · Vitest
- **Endpoints**: `GET /health`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- **Method**: Test-Driven Development (TDD) — tests written before implementation
- **Location**: `./backend/`
- **Status**: ✅ Complete and tested

### Julia — Primary Orchestrating Agent
- **What**: Set up Julia as the primary AI orchestrator using Antigravity (Google's agentic CLI framework)
- **Skills**: 300+ domain-specific SKILL.md files loaded from `.agent/skills/`
- **Role**: Receives goals, decomposes them, coordinates sub-agents, builds and maintains the backend
- **Status**: ✅ Active

### OpenClaw — Communication Sub-Agent
- **What**: Integrated OpenClaw as Julia's communication and channel layer
- **CLI**: `openclaw` (npm global, v2026.2.19-2)
- **Gateway**: `ws://127.0.0.1:18789`
- **Channels configured**: Telegram
- **Security**: `dmPolicy: pairing`, `allowFrom` allowlist, `gateway.bind: loopback`
- **Skills created**: `openclaw-expert`, `openclaw-gateway`, `openclaw-troubleshoot`
- **Location**: `./openclaw/`
- **Status**: ✅ Active — Telegram channel connected

### Telegram Integration
- **What**: Configured Telegram as the primary inbound/outbound communication channel
- **Bot**: Connected via `TELEGRAM_BOT_TOKEN` (stored in `.env.secrets`)
- **Security**: Pairing mode — only approved users can interact
- **Status**: ✅ Live

### GitHub Repository
- **Repo**: `https://github.com/abzhaw/juliaz_agents`
- **Branch**: `main`
- **Git identity**: `abzhaw` / `abzhaw@users.noreply.github.com`
- **Status**: ✅ Public, pushed and up to date

### Thesis Agent
- **What**: Set up this thesis agent to document the project for a master's thesis
- **Workspace**: `./thesis/`
- **Skills**: `thesis-research`, `thesis-writer`, `thesis-log`
- **Research papers folder**: `./thesis/research_papers/` (drop papers here)
- **Status**: ✅ Active

---

<!-- New entries go below this line, newest at the bottom -->

---

## 2026-02-21 — Wish Companion: Dying Wishes Research & Fulfillment Skills

### Context
Julia was built for Raphael's dear friend who has cancer. This session added a specialized capability layer — the **Wish Companion** — grounded in palliative care research, enabling Julia to actively help fulfill five deeply felt wishes common to people living with terminal illness.

### What was done

**New skill: `dying-wishes`** (`openclaw/skills/dying-wishes/SKILL.md`)
- Research layer drawing from: SUPPORT Study, Dignity Therapy (Chochinov), Atul Gawande's *Being Mortal*, the Five Wishes framework, JAMA/NEJM palliative care literature
- Documents the 8 most common wishes of cancer patients
- Establishes Julia's unique advantage: she can hold space without fatigue, grief, or discomfort — something no human in the person's life can sustain indefinitely
- Defines when to invoke the `wish-fulfillment` skill

**New skill: `wish-fulfillment`** (`openclaw/skills/wish-fulfillment/SKILL.md`)
- Action layer: 5 wishes with activation triggers and step-by-step procedures
  1. Write the letters that haven't been written (co-authoring in the person's voice)
  2. Turn memories into a memoir (gentle interview-based documentation)
  3. Be a witness — hold space without agenda (presence as the primary gift)
  4. Build a legacy box for people left behind (letters, wisdom, practical info, future milestone messages)
  5. Plan a living celebration (gathering while the person is still present to feel the love)
- Each wish designed to be achievable with Julia's existing capabilities: conversation, writing, memory

**New agent card: `wish-companion`** (`docs/agent_cards/wish-companion.md`)
- Documents the Wish Companion as a named mode of Julia
- Summarizes the 5 wishes, research foundation, and activation model
- Clarifies what Julia does NOT do (no medical care, no pushing, no treating this as a productivity task)

**Orchestrator prompt** (`orchestrator/src/prompt.ts`)
- Wish Companion section added to Julia's system prompt during session
- Note: prompt was subsequently reset to a generic form — the wish companion awareness now lives in the skill files rather than the system prompt

### Key decisions
- Skills-as-documentation pattern: the capability is encoded in SKILL.md files read by OpenClaw, not hardcoded into the orchestrator
- "Offer, don't push" principle: Julia activates wish companion mode through natural conversation signals, not commands
- Separation of research layer (dying-wishes) from action layer (wish-fulfillment) for modularity

### Files created
- `openclaw/skills/dying-wishes/SKILL.md`
- `openclaw/skills/wish-fulfillment/SKILL.md`
- `docs/agent_cards/wish-companion.md`

---

## 2026-02-22 — Julia Tool Calling: Email Capability

### Context
Julia (the orchestrator) responded to real-world action requests with "I can't do that" because there was no tool calling configured. OpenClaw already had a working `email-aberer` skill with SMTP scripts. This session wired them together.

### What was done

**New file: `orchestrator/src/tools.ts`**
- Defines `send_email` OpenAI function calling schema
- Executes via `op run --env-file=env-smtp.env -- python3 email_send.py`
- Calls OpenClaw's existing `email_send.py` script directly (same machine, no bridge changes needed)
- Never throws — errors become tool result strings for OpenAI to relay naturally

**Updated: `orchestrator/src/openai.ts`**
- Replaced single `client.chat.completions.create()` call with a tool-use loop (max 5 iterations)
- Passes `tools: TOOLS, tool_choice: 'auto'` to every API call
- Accumulates token usage across all iterations
- Function signature unchanged — `index.ts` required zero modifications

**Updated: `orchestrator/src/prompt.ts`**
- Added `send_email` to capabilities list
- Added Email behaviour section: when to call immediately vs. ask first; how to confirm success/failure

### Key decisions
- Tool-use loop is entirely self-contained in `generateReply()` — the caller sees no change
- Tools run locally in the orchestrator process rather than routing through bridge/OpenClaw
- `MAX_TOOL_ITERATIONS = 5` guards against infinite loops
- The architecture is designed for easy extension: add new tools in `tools.ts` only

### Files changed
- `orchestrator/src/tools.ts` (new)
- `orchestrator/src/openai.ts` (tool-use loop)
- `orchestrator/src/prompt.ts` (capabilities + email behaviour)

---

## 2026-02-22 — Thesis Documentation Enforcement

### Context
The `thesis-autonomy` skill was defined but had no enforcement mechanism. Claude Code (Antigravity) was not documenting sessions because `MEMORY.md` was empty — nothing reminded it to follow the skill each session.

### What was done
- **Diagnosed** the root cause: `MEMORY.md` empty + no hook = skill ignored every session
- **Flushed** the session buffer (5 entries: sessions 3–7) to all three protocol documents
- **Updated `MEMORY.md`** with a mandatory reminder to always follow `thesis-autonomy` after every substantive prompt

### Key decisions
- `MEMORY.md` chosen as primary enforcement mechanism — it is automatically injected into every Claude Code session context (first 200 lines)
- Two-level enforcement: MEMORY.md (always loaded, short instruction) + skill file (full procedure detail)

### Files changed
- `/Users/raphael/.claude/projects/-Users-raphael-Documents-Devs-juliaz-agents/memory/MEMORY.md` (updated)
- `thesis/memory/session_buffer.md` (flushed and reset)
- `thesis/documentation/protokoll_zeitlich.md` (appended)
- `thesis/documentation/protokoll_thematisch.md` (appended)
- `thesis/documentation/project_log.md` (this entry)

---

## 2026-02-22 — masterthesis-de Skill (Cowork Session)

### Context
A dedicated thesis-writing skill was created to enforce academic writing standards whenever Antigravity writes thesis content.

### What was done
- Created `.claude/skills/masterthesis-de/SKILL.md` via full skill-creator cycle (draft → evals → 3 iterations → description optimization)
- Ran evals: with_skill 100% pass rate vs. without_skill 93% baseline — key difference: correct author names (Schick ≠ Schoop), explicit DOI URLs, Swiss German orthography (`ss` not `ß`)
- Integrated Wish Companion research: SUPPORT Study, Chochinov, Gawande, 5 wishes, ethical design principles
- System architecture updated to 6 components in the skill

### Files created
- `.claude/skills/masterthesis-de/SKILL.md`
- `.claude/skills/masterthesis-de/evals/evals.json`

---

## 2026-02-22 — ADHD Agent: Ambient Skill Hygiene System

### Context
The juliaz_agents ecosystem was growing across 4 skill registries with no automatic hygiene mechanism. A dedicated ambient agent was built to continuously audit skill health and surface issues — with Telegram-based human approval for every action.

### What was done

**adhd-focus skill** — mandatory 5-step planning ritual (Zoom Out → Problem Map → Silver Lining → Session Plan → Julia Sync) that triggers at session start in any juliaz_agents context.

**ADHD ambient agent** (`juliaz_agents/adhd-agent/`):
- `scan_skills.py` — detects exact duplicates, near-duplicates (>75% description similarity), thin skills (<5 content lines), merge candidates across all 4 registries
- `adhd_loop.sh` — ambient loop: scan → filter snoozed/acted-on → Telegram proposal → poll approval → act → log
- `telegram_notify.sh` — sends proposals via Telegram Bot API directly
- `poll_approval.sh` — polls bridge `GET /queues/julia` for YES/NO/LATER (never calls `getUpdates` — OpenClaw owns that)
- macOS LaunchAgent (`com.juliaz.adhd-agent.plist`) — runs every 6 hours
- Installed and live verified: Telegram message sent (msg_id=86), scanner caught real duplicate on first run

**Ecosystem integration**: README updated to 7 components; `memory/approved_actions.txt` pattern for safe execution by Antigravity.

### Key decisions
- Human-in-the-loop is non-negotiable: no file deleted without explicit YES from Raphael
- Bridge-first reply polling: respects OpenClaw's ownership of the Telegram `getUpdates` connection
- Approved actions logged for Antigravity execution (second safety layer)
- LaunchAgent over pm2: shell process, not a Node.js server

### Files created
- `adhd-agent/` (SOUL, IDENTITY, AGENTS, HEARTBEAT, config/, scripts/, skills/)
- `README.md` (7th component added)

---

## 2026-02-22 — Session 10: Cowork MCP — Claude als Multimodaler Sub-Agent (Cowork-Session)

### Context
Julia's orchestrator uses GPT-4o as its sole AI brain. This session submitted Claude (Anthropic) into the Julia system as a second AI model accessible via MCP — making Julia a true multi-model agentic platform.

### What was done

**New component: `cowork-mcp/`** — TypeScript MCP server on port 3003
- `src/index.ts` — Streamable HTTP MCP server wrapping the Anthropic Claude API (stateless, one transport per request)
- `package.json` + `tsconfig.json` — ESM TypeScript project, clean `tsc` build
- Built with `@modelcontextprotocol/sdk` + `@anthropic-ai/sdk`

**6 MCP tools registered** (all callable from any MCP client in the system):
1. `claude_task` — General-purpose text delegation to Claude (reasoning, writing, analysis)
2. `claude_multimodal_task` — Vision tasks with base64 or URL images alongside text
3. `claude_code_review` — Structured review with severity ratings (🔴/🟡/🟢)
4. `claude_summarize` — Content summarization in bullets / paragraph / TL;DR formats
5. `claude_brainstorm` — Idea generation, action steps, or alternatives
6. `cowork_status` — Health check: server state, model, uptime, tool list

**Tested live** — server started successfully, health endpoint confirmed, all 5 callable tools reached the Anthropic API. API returned `"credit balance too low"` (billing issue on the stored key, not a code defect — MCP plumbing is verified end-to-end).

**Ecosystem integration:**
- `ecosystem.config.js` — `cowork-mcp` added as PM2 app with `...secrets` env spread (consistent with orchestrator pattern)
- `docs/agent_cards/cowork_claude.md` — New agent card added
- `README.md` — Architecture diagram updated to 6 components; Cowork MCP quick-start section added
- `cowork-mcp/examples/test.mjs` — Standalone ESM test agent demonstrating all tools

### Key decisions
- Stateless transport (`sessionIdGenerator: undefined`) — consistent with bridge pattern; no session affinity issues
- New transport per request rather than single shared server — prevents request ID collisions under concurrent load
- Error handling swallows all Anthropic API errors into clean text responses — orchestrator never crashes on sub-agent failure
- `CHARACTER_LIMIT = 25,000` truncation guard on all Claude responses — protects context windows downstream

### Files created
- `cowork-mcp/src/index.ts`
- `cowork-mcp/package.json`, `tsconfig.json`, `README.md`
- `cowork-mcp/examples/test.mjs`
- `docs/agent_cards/cowork_claude.md`

### Files updated
- `ecosystem.config.js` (cowork-mcp app added)
- `README.md` (6th component, architecture diagram, quick-start)

---

## 2026-02-22 — Session 11: Application Setup Audit & Infrastructure Fixes

### Context
After cowork-mcp was created, a full audit of all 6 running components revealed configuration gaps that would prevent production startup. Fixed proactively before any components were started via PM2.

### What was done
- **Full system audit**: All 6 components checked (Frontend/3002, Bridge/3001, Backend/3000, Orchestrator, OpenClaw, Cowork-MCP/3003) — 3 concrete issues identified
- **`backend/package.json`**: `ts-node` replaced with `tsx` (incompatible with `"moduleResolution": "bundler"` in tsconfig); `tsx` added to devDependencies
- **`ecosystem.config.js`** and **`ecosystem.dev.js`**: `...secrets` spread now injected into orchestrator + backend env blocks (not only cowork-mcp). All PM2 apps pick up API keys correctly from `.env.secrets`
- **`.claude/launch.json`**: Created unified launch config for all 5 services

### Key decisions
- Secrets injection via `fs.readFileSync('.env.secrets')` at ecosystem config load time — avoids `env_file` PM2 quirks across different PM2 versions
- `tsx` over `ts-node` for consistency with bridge and cowork-mcp (same devDependency already present)

### Files changed
- `backend/package.json`
- `ecosystem.config.js`
- `ecosystem.dev.js`
- `.claude/launch.json` (new)

---

## 2026-02-22 — Sessions 12-13: Infrastructure Repair & Model Migration

### Context
Multiple infrastructure failures: EADDRINUSE crash loops on bridge (325 restarts) and backend (326 restarts), stale Docker containers missing routes, Anthropic model IDs returning 404.

### What was done
- Docker backend rebuilt to expose missing `/usage` and `/updates` routes
- MCP transport switched from HTTP-URL to stdio (`bridge/mcp-stdio.mjs`) — eliminates startup race condition
- Bridge hardened: atomic queue writes (write-to-tmp then rename), corrupted-queue backup
- Orchestrator model migrated: `claude-3-5-sonnet-20241022` → `claude-haiku-4-5-20251001`
- adhd-focus skill deduplicated: underscore → kebab-case naming

### Key findings
- Anthropic account only has Claude 4.x models — all 3.x IDs return 404
- HTTP-URL MCP is fragile: if bridge is down at startup, entire session loses MCP silently

---

## 2026-02-22 — Session 14: Full System Overhaul — Tool Calling + Claude Delegation

### Context
Bridge and backend crash loops (EADDRINUSE — 325+ restarts each) needed fixing. Julia needed tool calling and Claude delegation capabilities.

### What was done

**Infrastructure:**
- Backend removed from PM2 configs (Docker-only) — fixed 326-restart crash loop
- Rogue bridge process killed — fixed 325-restart crash loop
- `start-devops.sh` updated: starts Docker backend first, kills rogue port processes before PM2

**Tool calling:**
- `orchestrator/src/tools.ts` rewritten: Anthropic `Tool[]` format, `ask_claude` tool, dual-export for GPT-4o fallback
- `orchestrator/src/claude.ts` rewritten: full tool-use loop (tool_use blocks, executeTool, tool_result feedback, max 5 iterations)
- GPT-4o fallback added in `orchestrator/src/index.ts`
- `POST /task` REST endpoint added to `cowork-mcp/src/index.ts`

### Key decisions
- Backend = Docker-only; PM2 manages bridge + orchestrator + cowork-mcp + frontend
- Claude primary + GPT-4o fallback architecture
- Cowork-mcp uses plain REST `/task` endpoint (not MCP protocol) for delegation simplicity

### Files changed
- `ecosystem.dev.config.js`, `start-devops.sh`
- `orchestrator/src/tools.ts`, `claude.ts`, `openai.ts`, `index.ts`, `prompt.ts`
- `cowork-mcp/src/index.ts`

---

## 2026-02-22 — Session 15: Agent Self-Knowledge Fix (send_email + 1Password)

### Context
Julia sent an email successfully but when asked "did you use 1Password?", she denied it — confabulating because her tool description didn't mention the mechanism.

### What was done
- Updated `send_email` tool description in `tools.ts` to mention OpenClaw's email-aberer skill + 1Password CLI (`op run`)
- Updated system prompt email behaviour section in `prompt.ts` to describe the credential injection mechanism

### Key finding
Agent self-knowledge is bounded by tool descriptions and system prompts. If the description omits that 1Password is used, the agent will deny using it — not lying, but confabulating from an incomplete self-model. **Tool descriptions ARE the agent's self-knowledge about its capabilities.**

### Files changed
- `orchestrator/src/tools.ts` (description update)
- `orchestrator/src/prompt.ts` (email mechanism explanation)

---

## 2026-02-22 — Session 16: Frontend Chatbot — Architecture Rethink + Vercel AI SDK

### Context
The old ChatWindow polled the bridge every 3s — a Telegram pattern, not suitable for web (slow, no streaming, wrong architecture). User requested a fundamental rethink with reasoning ability and clear model separation.

### Architecture decision
Two completely independent paths:
- **Web**: Dashboard → `/api/chat` → GPT-4o (streaming SSE via Vercel AI SDK)
- **Telegram**: OpenClaw → Bridge → Julia/Orchestrator (unchanged)

Model selection by surface:
| Surface | Model | Rationale |
|---|---|---|
| Frontend chatbot | GPT-4o | Reasoning depth, streaming, works on current API key |
| Orchestrator/Telegram | Claude Haiku 4.5 | Fast, cheap, adequate for tool-calling |
| Cowork-MCP | Claude Haiku 4.5 | Sub-agent for delegated tasks |

### What was done

**New file: `frontend/app/api/chat/route.ts`**
- Streaming endpoint using `streamText()` from Vercel AI SDK v5 with `openai('gpt-4o')`
- Julia-web system prompt (adapted for web: markdown OK, no Telegram length limits)
- 3 tools: `ask_claude` (delegates to cowork-mcp `/task`), `get_tasks` (backend API), `get_memories` (backend API)
- `send_email` deliberately excluded from frontend (security — email stays Telegram-only)

**Rewritten: `frontend/components/ChatWindow.tsx`**
- Replaced bridge polling with `useChat()` hook from `@ai-sdk/react`
- Streaming token-by-token rendering, markdown via `react-markdown` + `remark-gfm`
- Tool invocation indicators (spinner while calling, checkmark when done)
- Error handling with regenerate button

**New dependencies:**
- `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, `zod`, `react-markdown`, `remark-gfm`

### Key findings
- AI SDK v5 breaking changes from v4: `sendMessage` replaces `handleSubmit`, messages use `parts[]` array, tool parts are flat (no `toolInvocation` wrapper), states are `input-streaming`/`output-available` (not `call`/`result`)
- Upgrade path to Claude Sonnet: when available, swap `@ai-sdk/openai` → `@ai-sdk/anthropic` in one line

### Files created
- `frontend/app/api/chat/route.ts`
- `frontend/.env.local`

### Files changed
- `frontend/components/ChatWindow.tsx` (complete rewrite)
- `frontend/package.json` (new dependencies)

---

## 2026-02-22 — Session 17: Documentation & Structure Cleanup

### Context
Full project structure audit to improve discoverability for both human developers and AI agents.

### What was done
- Audited the complete project tree — deleted 16 orphaned files (logs, stale scripts, superseded `dashboard/` prototype, redundant PM2 configs)
- Created missing READMEs (orchestrator, frontend rewrite), agent cards (`adhd_agent`, `julia_medium`), `.env.example` template
- Fixed root README (component count 4 to 7, updated directory tree), removed duplicate row in `agent_system_overview`, updated `.gitignore`

### Key decisions
- Project structure must be navigable by both human developers and AI agents — explicit READMEs and agent cards serve both audiences

### Files changed
- 16 orphaned files deleted
- `README.md` (component count, directory tree)
- `docs/agent_system_overview.md` (duplicate row removed)
- `.gitignore` (updated)
- New: `orchestrator/README.md`, `frontend/README.md`, `docs/agent_cards/adhd_agent.md`, `docs/agent_cards/julia_medium.md`, `.env.example`

---

## 2026-02-22 — Session 18: JuliaFrontEnd Identity & System Prompt Overhaul

### Context
The frontend chatbot and the orchestrator Julia both used the name "Julia" in all UI elements, creating confusion about which agent the user was interacting with.

### What was done
- Renamed frontend chatbot from "Julia" to "JuliaFrontEnd" in all UI labels (header, role label, thinking indicator, placeholders)
- Rewrote system prompt to be project-aware: explains multi-agent architecture, thesis context, specific tools (`ask_claude`, `get_tasks`, `get_memories`), and Telegram counterpart
- Chatbot still calls itself "Julia" in conversation but UI chrome distinguishes it as the frontend agent

### Key decisions
- Identity separation at UI chrome level, not conversation level — user experience remains natural
- System prompt now carries architectural context so the frontend agent can accurately describe its place in the system

### Files changed
- `frontend/components/ChatWindow.tsx` (UI labels)
- `frontend/app/api/chat/route.ts` (system prompt rewrite)

---

## 2026-02-22 — Session 19: /dev Slash Command — Self-Modification via Claude Code CLI

### Context
Julia's first self-modification capability: users can send `/dev <instruction>` via Telegram to trigger code changes directly.

### What was done

**New file: `orchestrator/src/dev-runner.ts`**
- Spawns Claude Code CLI (`claude -p`) asynchronously with full permissions
- Auth gate: restricted to Raphael's chatId (8519931474)
- Mutex: one task at a time, 15-minute timeout
- Reports result back to Telegram when done

**New command: `/dev-status`**
- Shows whether a dev task is currently running and its elapsed time

### Architecture
Telegram message → Bridge → Orchestrator detects `/dev` prefix → spawns Claude Code CLI → reports result back to Telegram

### Key decisions
- Claude Code CLI as execution layer — full codebase access but gated by auth and mutex
- Asynchronous execution: user gets immediate "task started" confirmation, result arrives when done

### Files created
- `orchestrator/src/dev-runner.ts`

### Files changed
- `orchestrator/src/index.ts` (command routing)

---

## 2026-02-22 — Session 20: Code Review — dev-runner.ts

### Context
Brief review session of the newly created `/dev` module.

### What was done
- Reviewed `orchestrator/src/dev-runner.ts` — confirmed security layers (auth gate, mutex, timeout), spawn logic, and error handling

---

## 2026-02-22 — Session 21: /dev Rewrite — Git-Pull Deploy

### Context
The Claude Code CLI approach from Session 19 was replaced with a simpler, more reliable git-pull-and-restart mechanism.

### What was done

**Rewrote `orchestrator/src/dev-runner.ts`:**
- Replaced Claude Code CLI spawning with git-pull-and-restart workflow
- New flow: Raphael edits code on phone (Claude app on GitHub) → pushes to main → sends `/dev` via Telegram → orchestrator pulls, installs deps, restarts Docker + PM2
- Uses `spawnSync` for sequential shell commands (safe, no injection risk)
- Uses detached `spawn` for `pm2 restart all` (survives self-kill — the orchestrator is one of the processes being restarted)

### Key insight
The orchestrator must report success BEFORE restarting itself, because `pm2 restart all` kills the orchestrator process. If it reports after restart, the message is lost. This is a concrete race condition in self-modifying agent systems.

### Key decisions
- Git-pull over Claude Code CLI: simpler, works from mobile, no CLI dependency issues
- Result message sent before restart — race-condition-aware design
- `spawnSync` for safety (no shell injection), detached `spawn` only for the final pm2 restart

### Files changed
- `orchestrator/src/dev-runner.ts` (complete rewrite)

---

## 2026-02-22 — Session 22: Frontend Chatbot — Persistence, Model Selection & Best Practices

### Context
The frontend chatbot lost all messages on page refresh or orb toggle — no state persistence. This session added localStorage persistence, multi-model support, and documented production best practices.

### What was done

**Enhanced `ChatWindow.tsx`:**
- Added localStorage persistence — messages survive page refresh and orb toggle
- Implemented model selector (GPT-4o / Claude Sonnet) with context percentage indicator
- Added "New Chat" reset button

**Updated `page.tsx`:**
- ChatWindow is now always-mounted (CSS visibility toggle instead of conditional rendering) — useChat hook state survives orb interactions

**Updated `route.ts`:**
- Multi-model backend support via model registry with `getModel()`
- Installed `@ai-sdk/anthropic` for Claude Sonnet support

**Best practices:**
- 10 production chatbot best practices documented as TODO comments

### Key decisions
- Always-mount with CSS visibility instead of conditional rendering — React hook state preserved across parent re-renders
- Model registry pattern for easy extension to new models

### Files changed
- `frontend/components/ChatWindow.tsx` (persistence, model selector, context indicator)
- `frontend/app/page.tsx` (always-mount pattern)
- `frontend/app/api/chat/route.ts` (model registry)
- `frontend/package.json` (new dependency: @ai-sdk/anthropic)

---

## 2026-02-22 — Session 23: Schreiber Agent — 5 Core SKILL.md Files

### Context
The Schreiber (Master Thesis Agent) needed formalized skills for academic writing of the master's thesis.

### What was done

**5 SKILL.md files created** at `thesis-agent/skills/`:

| Skill | Purpose |
|---|---|
| `thesis-structure` | Chapter architecture, section headers, page targets |
| `draft-writer` | German academic prose, LaTeX formatting, TODO markers |
| `research-scout` | Source discovery → `pending-papers.json` |
| `citation-gatekeeper` | Source approval → `approved-papers.json` + `references.bib` |
| `code-to-thesis` | Code extraction from project into thesis-ready descriptions |

**Citation pipeline** enforces strict separation:
1. `research-scout` discovers sources → writes to `pending-papers.json`
2. `citation-gatekeeper` reviews and approves → moves to `approved-papers.json` + `references.bib`
3. `draft-writer` uses only approved sources; unknown sources become `\cite{TODO:topic}` placeholders

### Key decisions
- Three-stage citation pipeline prevents unvetted sources from entering the thesis
- Skills as standalone SKILL.md files — modular, independently updatable
- German academic writing rules embedded directly in skill definitions

### Files created
- `thesis-agent/skills/thesis-structure/SKILL.md`
- `thesis-agent/skills/draft-writer/SKILL.md`
- `thesis-agent/skills/research-scout/SKILL.md`
- `thesis-agent/skills/citation-gatekeeper/SKILL.md`
- `thesis-agent/skills/code-to-thesis/SKILL.md`

---

## 2026-02-22 — Session 24: Schreiber Agent — 5 Additional SKILL.md Files (Batch 2)

### Context
Second batch of skills for the Schreiber agent — focus on synthesis, argumentation, visualization, and build automation.

### What was done

**5 additional SKILL.md files created**:

| Skill | Purpose |
|---|---|
| `session-synthesizer` | Convert session logs/protocols into thesis-ready German academic prose; three-way distinction (planned/built/learned) |
| `argument-advisor` | 7 review dimensions (logical gaps, unsupported claims, overclaiming, circular reasoning, missing definitions), Betreuer simulation, defense Q&A generation |
| `figure-architect` | TikZ/PGF diagram templates for system architecture, sequence diagrams, timelines, skill hierarchies with German labels and consistent color scheme |
| `latex-builder` | Full Mac Mini compilation setup (latexmk/biber), German package config, error handling, validation checks |
| `thesis-tracker` | `progress.json` schema with chapter statuses and warning system |

### Key decisions
- 10 skills form the complete Schreiber skill set (5 core + 5 batch 2)
- Betreuer simulation as a standalone review dimension — prepares for thesis defense
- `argument-advisor` catches common academic writing pitfalls before human review

### Files created
- `thesis-agent/skills/session-synthesizer/SKILL.md`
- `thesis-agent/skills/argument-advisor/SKILL.md`
- `thesis-agent/skills/figure-architect/SKILL.md`
- `thesis-agent/skills/latex-builder/SKILL.md`
- `thesis-agent/skills/thesis-tracker/SKILL.md`

---

## 2026-02-22 — Session 25: Schreiber Agent — LaTeX Skeleton, Citation Workflow & Master Prompt

### Context
The Schreiber agent needed the physical LaTeX files and the infrastructure for the citation approval workflow.

### What was done

**LaTeX thesis skeleton:**
- `main.tex` — German academic setup with BibLaTeX/Biber, fancyhdr, geometry
- 7 chapter files (`01-einleitung` through `07-zusammenfassung`) with section headers and TODO markers

**Citation approval infrastructure:**
- `pending-papers.json` — staging area for discovered papers
- `approved-papers.json` — human-approved papers only
- `references.bib` — BibTeX entries for approved papers
- `structure.json` — chapter outline with page targets
- `progress.json` — tracker with word count targets totaling 25,000 words

**Master prompt document:**
- `docs/plans/2026-02-22-thesis-agent-design.md` — comprehensive prompt for recreating the Schreiber on the Mac Mini
- Includes all 10 skills, setup instructions, and workflow examples
- Designed as a portable document: enables agent recreation without session context

### Key decisions
- 25,000 words as total thesis target
- Master prompt as a portable reproduction document — any machine can bootstrap the Schreiber
- Citation infrastructure enforces human approval at every stage

### Files created
- `thesis/latex/main.tex`
- `thesis/latex/chapters/01-einleitung.tex` through `07-zusammenfassung.tex`
- `thesis/latex/pending-papers.json`, `approved-papers.json`, `references.bib`
- `thesis/latex/structure.json`, `thesis/progress.json`
- `docs/plans/2026-02-22-thesis-agent-design.md`

---

## 2026-02-22 — Session 26: Frontend Migration — Next.js 16 to Vite + React Router + Hono

### Context
Analysis of the frontend codebase revealed 0% SSR usage, 0 server components, and only 6 Next.js-specific imports — the framework was pure overhead for what was essentially a single-page application.

### What was done

**Complete frontend migration:**
- Replaced Next.js 16 with Vite 6 (build tool) + React Router 7 (client-side routing) + Hono (API server)
- Created Hono `server.ts` combining both API routes: `/api/chat` (streaming) + `/api/devops` (PM2 control)
- All 9 components moved to `src/` unchanged — only `next/link` to `react-router Link` swaps needed in 2 route files

**Performance results:**

| Metric | Next.js | Vite + Hono |
|---|---|---|
| Build time | ~15-30s | 2.1s |
| Dev server start | several seconds | 133ms |
| Framework errors (EISDIR etc.) | frequent | eliminated |

### Key decisions
- Vite + React Router + Hono as lightweight alternative — no SSR/SSG overhead for a pure SPA
- Hono as API layer: lightweight, Express-compatible, TypeScript-first
- Migration confirmed principle: choose framework based on actual usage, not theoretical features
- Data-driven decision: usage analysis before migration (0% SSR → no need for SSR framework)

### Files created
- `frontend/src/` directory structure (migrated from `frontend/app/`)
- `frontend/server.ts` (Hono API server)
- `frontend/vite.config.ts`

### Files changed
- `frontend/package.json` (dependencies: removed next, added vite/react-router/hono)
- All route files (next/link → react-router Link)
- `ecosystem.config.js` (frontend start command updated)

---

## 2026-03-08 — Ambient Agent Intelligence Overhaul (Cowork Session)

### Context
The five ambient agents (Health Checker, Sentinel, Task Manager, ADHD Agent, Docs Agent) were audited for technical quality and intelligence. The audit revealed critical gaps: the Health Checker was sending identical Telegram alerts every 15 minutes for 2+ hours without deduplication or escalation; Sentinel's reports were being duplicated when running twice on the same day; agents had no cross-communication; and no self-healing was attempted for the most common failure states.

### Problem Evidence
Health Checker logs from 18:00–20:00 showed 8 consecutive identical alerts for the same 3 issues (Backend API down, PM2 `backend-docker` in `waiting restart`, OpenClaw degraded). Each alert was word-for-word identical — no escalation, no deduplication, no self-healing attempted.

### What was done

**Health Checker (`health-checker/scripts/health_check.sh`) — Complete Rewrite**
- **Alert deduplication**: Issues are fingerprinted and tracked in `memory/alert_state.json`. Identical issues are not re-alerted.
- **Escalation tiers**: NEW (1st detection) → PERSISTENT (3× / ~45min) → CRITICAL (6× / ~1.5h) → SILENT (12× / ~3h, daily digest only). Each tier change triggers one notification.
- **Issue correlation**: Multiple failures in the same service group (e.g., `backend-docker` waiting restart + Backend API HTTP 000) are merged into one correlated `[BACKEND]` incident instead of two separate alerts.
- **`waiting restart` handling**: Now a recognized PM2 state. If restarts < 5, lets PM2 retry. If ≥ 5 (stuck), force-deletes and recreates the process from `ecosystem.config.js`.
- **Self-healing upgrades**: Attempts `pm2 restart` for errored processes (threshold: < 15 restarts), attempts `docker compose up -d` for dead containers, verifies restart success with a 3-second probe.
- **Recovery detection**: When a previously-escalated issue resolves, sends a "✅ RESOLVED" Telegram notification.
- **Cross-agent communication**: Writes active incidents to `shared-findings/incidents.json` so Sentinel and Docs Agent know what's currently broken.

**Sentinel (`security-agent/scripts/daily-report.sh`) — Bug Fix + Intelligence**
- **Duplicate report bug fixed**: Report is now built in a temp file and atomically moved (`mv`) to the final path. Running twice on the same day (boot + cron) overwrites cleanly instead of appending.
- **Known-safe port registry** (`memory/known_safe.json`): macOS system ports (5000/ControlCenter, 7000/AirPlay, 49152/rapportd) pre-classified as safe. No more false positives flagged daily.
- **Known-safe file filtering**: `playwright-skill/lib/helpers.js` (contains test password patterns) suppressed from credential scan.
- **Incident awareness**: Reads `shared-findings/incidents.json`. If Health Checker already tracks a service as down, Sentinel marks the port as "known incident" instead of creating a separate finding.
- **Day-over-day diff**: Compares today's findings against yesterday's report. Telegram message highlights `🆕 New` findings separately from recurring ones.
- **Real self-learning**: `baseline.json` now stores 30 days of trend data (not just a counter). Report shows whether findings are "improving," "degrading," or "stable."
- **Learnings journal dedup**: Only one entry per day (fixed: previously had 2–6 duplicate entries per date).

**Docs Agent (`docs-agent/scripts/docs_drift_check.sh`) — Intelligence Upgrade**
- **Incident awareness**: Reads `shared-findings/incidents.json`. Skips drift checks for services that Health Checker is already tracking as active incidents.
- **Drift memory** (`memory/drift_state.json`): Tracks previously reported drift. Only alerts on NEW drift, stays silent for known issues.
- **New checks added**: Verifies PM2 process count matches `ecosystem.config.js`; validates cron schedules match documentation.
- **Cross-agent data sharing**: Writes docs-drift count and status to `shared-findings/incidents.json`.

**Shared Findings Layer (`shared-findings/incidents.json`) — Activated**
- Previously empty and unused by all agents.
- Now serves as the cross-agent communication backbone: Health Checker writes active incidents, Sentinel reads them to skip known-down services, Docs Agent reads them to suppress irrelevant drift.
- Schema: `incidents` (active), `resolved` (last 50), `docs_drift` (from Docs Agent), `last_updated`, `updated_by`.

### Key decisions
- **Escalation state machine over threshold checks**: The escalation tiers (NEW → PERSISTENT → CRITICAL → SILENT) are tracked per-issue in a JSON state file, not computed from raw counts. This allows the system to reset escalation when an issue resolves and comes back.
- **Correlation groups**: Each check assigns a `group` label (e.g., "backend", "bridge"). Multiple failures in the same group are merged into one incident for alerting. This prevents Raphael from receiving 3 separate alerts for what is one root cause.
- **Atomic writes for Sentinel**: The duplicate report bug was caused by `>>` (append) to a file that was initialized with `>` (overwrite) only once. Solution: write to temp, `mv` at end. This is idempotent regardless of how many times the script runs.
- **Known-safe registries are editable JSON files**: Both `known_safe.json` (Sentinel) and `exceptions.json` (ADHD Agent) follow the same pattern — human-editable JSON that suppresses false positives. Sentinel can now learn to stop flagging things.
- **Shared findings as a coordination bus**: Rather than having agents directly call each other, the `shared-findings/incidents.json` file acts as an asynchronous message board. Any agent can write, any agent can read. No coupling between agent schedules.

### Files rewritten
- `health-checker/scripts/health_check.sh` (complete rewrite — dedup, escalation, correlation, self-healing)
- `security-agent/scripts/daily-report.sh` (atomic write, known-safe filtering, incident awareness, trend tracking)
- `docs-agent/scripts/docs_drift_check.sh` (incident awareness, drift memory, new checks)

### Files created
- `security-agent/memory/known_safe.json` (known-safe ports and files registry — created on first run)
- `docs-agent/memory/drift_state.json` (drift memory — created on first run)
- `health-checker/memory/alert_state.json` (escalation state — created on first run)

### Files updated
- `shared-findings/incidents.json` (schema upgraded, now actively used by 3 agents)

---

## 2026-03-08 — Auto-Documentation Pipeline Complete

> Auto-logged by cowork session at 19:20

Completed the 3-layer auto-documentation system:
- **Layer 1** (Docs Agent): Added git-based gap detection (check 8) to docs_drift_check.sh — detects undocumented commits and alerts via Telegram
- **Layer 2** (Git Hook): Created .git/hooks/post-commit that auto-appends commit entries to project_log.md and commit_log.md
- **Layer 3** (Session Hook): Created thesis/scripts/log_session.sh for session-level logging, plus CLAUDE.md at project root to enforce the ritual
- Updated thesis/MEMORY.md with auto-documentation system documentation
- All three layers target the same project_log.md, creating a comprehensive paper trail

---

## 2026-03-08 — Architecture Agent Created

> Auto-logged by cowork session at 19:42

Built the Architecture Agent — Julia's 6th ambient agent. This agent scans the actual running system (PM2, Docker, ports, agent dirs, skills) every 6 hours and generates `architectureGraph.json`, which powers the frontend's interactive neural map at `/architecture`.

### What it does
1. **Ground-truth scanner**: Collects PM2 processes, Docker containers, listening ports, agent directories, skill folders, OpenClaw status
2. **Graph generator**: Produces full node+edge topology JSON for the ReactFlow frontend
3. **Change detector**: Diffs against previous scan — flags new/removed nodes, health transitions
4. **Telegram alerter**: Sends structural change notifications (silent when stable)
5. **Cross-agent writer**: Writes topology metadata to shared-findings for other agents

### Frontend changes
- Rewrote `ArchitectureDiagram.tsx` to consume dynamic `architectureGraph.json` instead of hardcoded nodes
- Added 3 new node types: AgentNode (emerald), InfraNode (amber), HealthDot (live health indicators)
- Added MetadataOverlay showing live topology stats (process count, agent count, scan timestamp)
- Falls back to static layout if no graph file exists (backward compatible)
- Updated legend with new node categories

### Files created
- `architecture-agent/scripts/architecture_scan.sh` — main scanner
- `architecture-agent/SOUL.md`, `IDENTITY.md`, `HEARTBEAT.md` — identity files
- `docs/agent_cards/architecture_agent.md` — agent card

### Files modified
- `ecosystem.config.js` — added architecture-agent (10 apps total)
- `frontend/src/components/ArchitectureDiagram.tsx` — dynamic graph + new node types
- `docs/agent_system_overview.md` — added Architecture Agent section + updated to Update 6

---

## 2026-03-08 — Offline Migration Guide Completed

> Auto-logged by cowork session at 21:05

Updated `docs/OFFLINE_MIGRATION_GUIDE.md` from 612 lines to 1017 lines, filling in all identified gaps:

### Architecture corrections applied
- Fixed component naming: Julia-Web, Julia-Orchestrator, Julia-Bridge (not "openclaw-bridge")
- Clarified Julia-Web has its own AI brain (GPT-4o / Claude Sonnet via streamText)
- Clarified Julia-Bridge connects BOTH Julia-Web and OpenClaw (not OpenClaw-specific)
- Clarified "Julia-Telegram" is a user experience, not a component

### New sections added
- **System Architecture** diagram with correct naming and component table
- **Offline Communication Strategy** — Julia-Web becomes sole interface, OFFLINE_MODE env var, message outbox queuing
- **Step 5: Grader + optimizer rewire** — full before/after code for holistic-strategy.ts, result-integration.ts, optimizer.ts
- **Step 9: Ollama PM2 management** — ecosystem.config.js entry + health checker monitoring
- **Step 10: Model warm-up** — VRAM loading on boot, OLLAMA_KEEP_ALIVE setting
- **Rollback Plan** — three options (hybrid cloud fallback, per-component migration, full rollback)
- **Ambient Agents in Offline Mode** — local alert sink pattern, Telegram fallback
- **Known Risks** expanded — cold start, concurrent requests, model eviction

### Files modified
- `docs/OFFLINE_MIGRATION_GUIDE.md` — comprehensive update

---

## 2026-03-08 — Architecture Neural Map Tooltip Coverage

> Auto-logged by manual session at 21:01

Added tooltip descriptions to every node type on the /architecture page. Fixed SkillNode, InfraNode, and AgentNode components to show animated tooltips on hover. Expanded architectureData.json from 7 to 22 entries covering all skills, agents, and infrastructure. Added new static nodes (Frontend, Cowork-MCP, Health Checker, Security Agent, Docs Agent, PM2, Shared Findings) with proper edges. Added tooltip hover to SkillPalette sidebar items. Rebuilt and restarted frontend via PM2.
