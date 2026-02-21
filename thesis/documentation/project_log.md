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
