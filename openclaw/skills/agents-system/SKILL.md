---
name: agents-system
description: Manage the OpenClaw agent system end-to-end (agents/, skills/, MCP servers) so the workspace stays healthy.
---

# Agent System Maintenance Playbook

Use this skill whenever you need to add or modify OpenClaw agents, update skill packages, or verify MCP integrations inside this repo (`/Users/raphael/Documents/Devs/juliaz_agents/openclaw`).

## Repository Layout Cheat Sheet
| Path | Purpose |
| --- | --- |
| `agents/` | YAML manifests (e.g., `agents/juliamcp.yml`) describing transports, skills, behaviors |
| `skills/<name>/` | Each skill folder contains `SKILL.md`, optional references, and any tool definitions (`*.yml`) |
| `skills/julia-bridge/*.yml` | MCP tool wrappers for the Julia bridge (`send`, `receive`, `health`) |
| `bridge/` | Local MCP server source (Node) for Julia↔︎OpenClaw relay |
| `memory/` | Session notes/logs required by AGENTS.md workflow |

## Workflow: Adding or Updating an Agent
1. **Create/Update manifest:** Add `agents/<agent>.yml` with `name`, `transport`, `skills`, and behaviors. Use `agents/juliamcp.yml` as a template.
2. **Validate structure:** Ensure YAML lists `skills.required` entries that exist under `skills/`. Keep correlation/behavior settings explicit (`requireCorrelationId`, retries, etc.).
3. **Link MCP transport:** For MCP-based agents, set:
   ```yaml
   transport:
     type: mcp
     endpoint: http://127.0.0.1:3001
   ```
   Adjust host/port if deploying elsewhere.
4. **Smoke-test:** (a) restart any affected MCP servers, (b) run `mcporter call <server>.list_tools` (if exposed) or the relevant tool to confirm connectivity.
5. **Document changes:** Update or create `skills/<related-skill>/SKILL.md` so future runs know how/when to use the agent.

## Workflow: Creating or Updating a Skill Package
1. **Directory scaffolding:** `mkdir -p skills/<skill>/` then add:
   - `SKILL.md` (instructions)
   - Optional helper docs (`README.md`, references)
   - Tool definitions (`*.yml`) when the skill wraps a CLI/API (see `skills/julia-bridge/send.yml`).
2. **Frontmatter discipline:** Keep `name` + `description` short but descriptive so OpenClaw’s skill loader can match user intents.
3. **Procedural clarity:** In `SKILL.md`, include:
   - When to trigger the skill
   - Required tools/dependencies
   - Step-by-step procedures with exact commands
   - Troubleshooting tips
4. **Testing:** Execute each defined tool at least once (e.g., `mcporter call ...`) and confirm expected JSON. Capture quirks in the Troubleshooting section.

## Workflow: MCP Server Maintenance (Bridge or Others)
1. Follow `skills/julia-bridge/SKILL.md` for the existing bridge.
2. New server? Add a folder under `bridge/` (or another path) with `package.json`, `server.js`, etc.
3. Register it with `mcporter`:
   ```bash
   mcporter config add <name> http://127.0.0.1:<port> --transport http
   ```
4. Reference the new tools in an agent manifest, then add matching `skills/<name>/*.yml` definitions.

## Workflow: Verifying End-to-End Wiring
1. **Health checks:**
   - `openclaw health`
   - `openclaw channels status`
   - `mcporter call <server>.bridge_health`
2. **Skill invocation:** Use `skills/<skill>/<tool>.yml` definitions via OpenClaw to ensure they trigger the MCP server correctly.
3. **Logs:**
   - Bridge server logs to stdout with `[bridge]` prefix.
   - For OpenClaw issues, check `~/.openclaw/logs/` and follow `skills/openclaw-self-manage`.
4. **Queues:** Inspect `bridge` queues (`/queues/openclaw`, `/queues/julia`) if messages stall.

## Workflow: Memory + Documentation Hygiene
1. Update `memory/YYYY-MM-DD.md` after significant maintenance work.
2. When a new repeatable lesson emerges, add it to `HEURISTICS.md` per AGENTS.md instructions.
3. Ensure `SOUL.md`/`USER.md` reflect any long-term preference changes uncovered during maintenance.

## Troubleshooting Tips
| Issue | Checklist |
| --- | --- |
| Agent fails to load skills | Confirm `skills/<skill>/SKILL.md` exists and `skills/<skill>/*.yml` names match the references in `agents/<agent>.yml`. |
| `mcporter` cannot reach server | Is the server running on the expected port? Run `lsof -i :3001`. Update `config/mcporter.json` if the base URL changed. |
| Output validation errors | Ensure MCP tools return both human-readable `content` and structured JSON (`structuredContent`) when an `outputSchema` is declared. |
| Persistent pairing issues | Run `skills/openclaw-self-manage` workflow (`openclaw health`, repair script, etc.) before editing configs. |

## Related Skills + Files
- `skills/julia-bridge/SKILL.md` – bridge-specific ops
- `skills/openclaw-self-manage/SKILL.md` – gateway/CLI troubleshooting
- `AGENTS.md` – daily operating doctrine
- `HEURISTICS.md` – accumulated rules from incidents
