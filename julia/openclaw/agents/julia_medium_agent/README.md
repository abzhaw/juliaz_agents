# Julia Medium Agent Workspace — DEPRECATED

> **Moved to OpenClaw**: This agent is now an OpenClaw skill at `openclaw/skills/medium-research/`.
> The agent definition lives at `openclaw/agents/julia_medium.yml`.
>
> This standalone directory is kept for reference only. All future development
> should happen in the OpenClaw skill directory.

## Why it moved

The julia_medium_agent was designed as an ambient research agent but never needed
its own runtime or process — it's a capability of the OpenClaw gateway, not an
independent agent. Moving it into OpenClaw as a skill means:

- No extra process to manage
- Reuses OpenClaw's existing bridge connection and Telegram integration
- Follows the gateway pattern (OpenClaw = communication + skills)
- Consistent with how email-aberer, notion, and other integrations work

## Original Structure
- `AGENTS.md` -- operating guide
- `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`
- `memory/` -- daily logs
- `skills/` -- medium-specific scripts/skills (was empty)
