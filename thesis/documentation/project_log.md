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
