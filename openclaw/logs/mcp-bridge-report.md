# MCP Bridge Incident Report
**Date:** 2026-02-21

## Summary
While bringing up the Julia ↔ OpenClaw MCP bridge, repeated restarts and HTTP errors (404/400) surfaced. Root causes were an initial import path bug, then a design issue where a single `McpServer` instance was shared across multiple session transports, causing "Already connected" failures and HTTP 400 responses. Refactoring to create a per-session MCP server resolved the errors; `mcporter call julia-bridge.bridge_health` now returns structured JSON and the bridge is stable.

## Timeline
| Time (CET) | Event |
| --- | --- |
| 16:45–16:50 | Built `skills/julia-bridge` suite, `agents/juliamcp.yml`, and initial `bridge/server.js`. |
| 16:52 | First `npm start` run failed: `ERR_MODULE_NOT_FOUND` for bare module imports → fixed by appending `.js` extensions. |
| 16:55–16:59 | Configured `mcporter` – initial calls returned HTTP 404 because `/mcp` routes were SSE-only. Switched to Streamable HTTP transport. |
| 17:00–17:04 | Multiple restarts while tweaking routes; logs show `[bridge] POST /` (mcporter hitting `/`). Added route aliases for `/` and `/mcp`. |
| 17:05 | After `mcporter call`, received `Output validation error: no structured content`. Added `structuredContent` to tool responses. |
| 17:08 | New error: `Invalid tools/call result… expected "text"` because output schema with JSON content triggered union validation; replaced human content with `type: text` stringified JSON. |
| 17:10 | HTTP 400 from `mcporter` plus log stack: `Already connected to a transport` — root cause: single `McpServer` instance reused for multiple sessions. |
| 17:12–17:14 | Refactored `bridge/server.js` to instantiate a new `McpServer` per session (`createServer()`), storing `{ transport, server }` in the `transports` map and closing both on disconnect. |
| 17:14 | Restarted bridge; `mcporter call julia-bridge.bridge_health` now succeeds (status `down` until heartbeats fire). |

## Root Causes
1. **Module import path error:** ESM requires explicit `.js` extensions for local imports; without them, Node threw `ERR_MODULE_NOT_FOUND`.
2. **Route mismatch:** mcporter attempted HTTP Streamable connections, but the server was only exposing `/mcp` SSE handlers, leading to 404s/400s.
3. **Structured output enforcement:** Tools declared `outputSchema` but returned only `content` (or non-JSON content). The MCP SDK demanded `structuredContent` matching the schema.
4. **Shared MCP server instance:** A single `McpServer` was connected to multiple Streamable HTTP transports. The SDK forbids reconnecting a server without closing; each session needs its own server instance.

## Impact
- Bridge unavailable for ~30 minutes while testing (no production traffic yet).
- Users saw HTTP 404/400 errors via `mcporter` and log spam from repeated restarts.

## Fixes Implemented
- Added `.js` suffixes to all SDK imports in `bridge/server.js`.
- Replaced SSE-only routes with Streamable HTTP handlers and route aliases for `/`.
- Updated `toJsonResult` helper to emit both `content` (`type: text`) and `structuredContent`.
- Refactored server creation: `createServer()` returns a fresh `McpServer` per session; `transports` map stores `{ transport, server }`, closing both on disconnect/SIGINT.
- Added request logging middleware (`[bridge] METHOD PATH`).
- Confirmed `mcporter call julia-bridge.bridge_health` returns valid JSON.

## TODO / Follow-ups
- Wire heartbeat calls from Julia/OpenClaw so `bridge_health` reflects `status: ok`.
- Package the bridge as a background service (pm2, launch agent) to avoid manual restarts.
- Expand automated tests for `send/receive` flows (possible npm test script).

## Files Touched
- `bridge/server.js`
- `skills/julia-bridge/README.md`, `SKILL.md`, `send.yml`, `receive.yml`, `health.yml`
- `agents/juliamcp.yml`
- `skills/mcp/SKILL.md`, `skills/agents/SKILL.md`, `skills/agents-system/SKILL.md`
- `memory/2026-02-21.md`
