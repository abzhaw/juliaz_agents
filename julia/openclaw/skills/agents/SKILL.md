---
name: agents
description: Design, create, and update OpenClaw agent manifests in `agents/` (skills, transports, behaviors).
---

# Agents Skill – Creating & Updating Agent Manifests

Use this skill whenever you need to onboard a new agent or modify an existing one under `agents/`.

## Checklist Before Editing
- Read `AGENTS.md` (session rules) and the current `memory/YYYY-MM-DD.md`.
- Identify which skills the agent needs (each must exist under `skills/<name>/`).
- Confirm transport requirements (MCP endpoint, direct channel, etc.).

## Creating a New Agent
1. **Copy a template:**
   ```bash
   cp agents/juliamcp.yml agents/<new-agent>.yml
   ```
2. **Set metadata:**
   - `name`: short handle (used in UI)
   - `kind`: usually `mcp-agent`
   - `metadata.description`: one-line summary
3. **Configure transport:**
   ```yaml
   transport:
     type: mcp
     endpoint: http://127.0.0.1:3001
   ```
   Adjust endpoint/transport as needed.
4. **Wire skills:**
   ```yaml
   skills:
     required:
       - julia-bridge/send
       - julia-bridge/receive
       - julia-bridge/health
   ```
5. **Behaviors:** define retries, correlation IDs, pre-flight health checks, logging.
6. **Logging:** point to a file in `logs/` if you need persistent traces.

## Updating an Existing Agent
1. Locate the YAML under `agents/`.
2. Make the edit (add/remove skills, adjust behaviors, change endpoint).
3. Re-run any dependent MCP server to pick up config changes.
4. Test via the OpenClaw UI or CLI (trigger the agent and watch logs).
5. Record the change in `memory/YYYY-MM-DD.md`.

## Validation Steps
- `yamllint agents/<agent>.yml` (if available).
- Trigger the agent once; ensure required skills resolve (no “skill not found” errors).
- If agent uses MCP, run `mcporter call <server>.bridge_health` first.

## Common Patterns
- **Health preflight:** run a health skill before sending user messages.
- **Retry:** allow one automatic retry with a short delay for MCP send failures.
- **Correlation IDs:** enforce a prefix per agent (`correlationIdPrefix`).

## Troubleshooting
| Issue | Fix |
| --- | --- |
| Agent missing in UI | File not saved in `agents/` or YAML invalid – re-open and validate. |
| Skill not found | Ensure the skill folder + tool YAML exist, and the name matches. |
| MCP errors | Bridge down or config mismatch – follow `skills/mcp/SKILL.md`. |
| Duplicate correlation IDs | Adjust `correlationIdPrefix` or generate UUIDs. |

## Related Skills
- `skills/agents-system` – bigger-picture maintenance
- `skills/mcp` – MCP server operations
- `skills/julia-bridge` – specific to the Julia bridge
