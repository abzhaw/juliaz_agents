---
name: mcp
description: Operate, debug, and extend local MCP servers (bridge, future services) using mcporter + Node tooling.
---

# MCP Skill – Server Operations

Use this when you need to stand up, restart, or debug MCP servers that live inside this workspace.

## Tooling
- `node` / `npm`
- `mcporter` CLI (`npm i -g mcporter`)
- `curl`, `jq` for quick HTTP checks
- Source lives under `bridge/` (Julia relay) or future `bridge-*/` folders

## Typical Workflow
1. **Install deps** (per server folder):
   ```bash
   cd bridge
   npm install
   ```
2. **Start the server:**
   ```bash
   npm start
   ```
   Logs appear with `[bridge]` prefixes.
3. **Register with mcporter:**
   ```bash
   mcporter config add julia-bridge http://127.0.0.1:3001 --transport http
   ```
4. **Health check:**
   ```bash
   mcporter call julia-bridge.bridge_health
   ```
5. **Expose tools:** ensure each MCP method is documented via a skill (`skills/julia-bridge/*.yml`).

## Adding a New MCP Server
1. `mkdir bridge-<name>` and `npm init -y`.
2. Add `server.js` using `@modelcontextprotocol/sdk` (StreamableHTTP or SSE transport).
3. Define tools with Zod schemas (`registerTool`). Always return structured content when specifying an `outputSchema`.
4. Provide HTTP helper endpoints (e.g., `/health`, `/queues`) if needed.
5. Document operations in a dedicated skill folder (`skills/<name>/`).
6. Update `agents/` to include the new skills.

## Debugging Checklist
| Symptom | Action |
| --- | --- |
| `HTTP 404` from mcporter | Server not routing `/mcp` correctly – verify Streamable HTTP handler. |
| `Output validation error` | Ensure tool response includes `structuredContent` matching the `outputSchema`. |
| Hang on start | Run `node server.js` directly to catch stack traces. |
| Multiple servers needed | Run each in its own terminal or use `tmux` (`skills/tmux`). |

## Heartbeats & Queues (Bridge Example)
- `/heartbeat/<peer>` to update status.
- `/queues/<target>` to inspect or debug stuck messages.
- `/inbound` for Julia → OpenClaw posts.

## Logging & Memory
- Capture major incidents in `memory/YYYY-MM-DD.md`.
- If a new pattern emerges, add a heuristic in `HEURISTICS.md` (e.g., “restart mcporter config when endpoint changes”).

## Related Skills
- `skills/julia-bridge` – specific procedures for the Julia relay
- `skills/agents` – wiring MCP tools into agent manifests
- `skills/agents-system` – fleet-wide maintenance
