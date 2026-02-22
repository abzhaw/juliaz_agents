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
