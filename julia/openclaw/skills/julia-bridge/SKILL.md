---
name: julia-bridge
description: Operate and maintain the Julia MCP bridge server (start/stop, health checks, send/receive flows, queue inspection) so OpenClaw and Julia stay in sync.
---

# Julia MCP Bridge Operations

The Julia bridge lives in `bridge/` and exposes `telegram_send`, `telegram_receive`, and `bridge_health` via MCP on `http://127.0.0.1:3001`. Use the steps below whenever you need to debug, restart, or exercise the bridge.

## Prerequisites
- `node`/`npm` available locally (Node ≥18)
- `mcporter` installed (`npm i -g mcporter`)
- `config/mcporter.json` (project scope) includes:
  ```json
  {
    "mcpServers": {
      "julia-bridge": {
        "transport": "http",
        "url": "http://127.0.0.1:3001"
      }
    }
  }
  ```
- `julia` agent definition (`agents/juliamcp.yml`) already references the `julia-bridge/*` skills.

## Health + Status Checks
1. From repo root run:
   ```bash
   mcporter call julia-bridge.bridge_health
   ```
2. Interpret the JSON payload:
   - `status: ok` → Julia heartbeat seen in the last 15 s
   - `status: degraded` → bridge alive but Julia heartbeat missing (OpenClaw heartbeat still present)
   - `status: down` → no peers (restart bridge or check heartbeats)
   - `queue` sizes show pending messages for each side.
3. If the call errors with HTTP 404/connection refused, the server is not running — restart it (see below).
4. For quick queue inspection (without MCP):
   ```bash
   curl -s http://127.0.0.1:3001/queues/openclaw | jq
   curl -s http://127.0.0.1:3001/queues/julia | jq
   ```

## Sending Messages (OpenClaw → Julia)
1. Always generate a deterministic `correlationId` so replies can be matched (e.g., `uuidgen` or hash of source message).
2. Invoke the `julia-bridge/send` skill with:
   ```json
   {
     "correlationId": "julia-20260221-001",
     "text": "<payload>",
     "context": "optional metadata",
     "target": "julia"
   }
   ```
3. Inspect the response fields:
   - `success` should be `true`
   - `queueDepth` indicates how many OpenClaw→Julia messages are waiting.
4. The skill automatically updates the OpenClaw heartbeat; if it fails, run the health workflow above.

## Receiving Replies (Julia → OpenClaw)
1. Poll with `julia-bridge/receive`. Provide a `correlationId` to fetch a single reply or omit to drain everything for `target: "openclaw"`.
2. Use the `timeout` field (milliseconds) to long-poll:
   ```json
   { "target": "openclaw", "correlationId": "julia-20260221-001", "timeout": 5000 }
   ```
3. If nothing arrives within the timeout, check the `/queues/openclaw` endpoint or confirm Julia is enqueueing messages (see `/inbound`).

## Starting / Restarting the Bridge Server
1. In a dedicated terminal:
   ```bash
   cd bridge
   npm install   # only needed after dependency changes
   npm start
   ```
   This runs `node server.js` and logs requests prefixed with `[bridge]`.
2. Stop with `Ctrl+C` and restart if you change the server code.
3. For background runs, consider `nodemon` or `pm2` (not configured by default).
4. After restart, re-run the health check to verify connectivity.

## Inbound Hooks (Julia → Bridge)
- HTTP endpoint for Julia to push responses:
  ```bash
  curl -X POST http://127.0.0.1:3001/inbound \
       -H 'Content-Type: application/json' \
       -d '{"correlationId":"...","text":"...","context":"..."}'
  ```
- Heartbeat endpoint (updates `bridge_health` peer status):
  ```bash
  curl -X POST http://127.0.0.1:3001/heartbeat/julia
  curl -X POST http://127.0.0.1:3001/heartbeat/openclaw
  ```

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| `SSE error: 404` from `mcporter` | Bridge not bound to `/mcp` — ensure server uses the Streamable HTTP routes defined in `server.js`. |
| `Output validation error: no structured content` | Ensure helper `toJsonResult` returns both `content` (human-readable) and `structuredContent` (raw JSON). Already baked into `server.js`. |
| `queueDepth` never drains | Confirm `julia-bridge/receive` is called with correct `target` and correlation ID. Use `/queues/<target>` endpoint for visibility. |
| Julia heartbeat stuck in `down` | Hit `/heartbeat/julia`, or ensure Julia pushes via `/inbound`. |
| `mcporter` can’t resolve server | Re-run `mcporter config add julia-bridge http://127.0.0.1:3001 --transport http`. |

## Related Files
- `bridge/server.js` – MCP server implementation
- `bridge/package.json` – scripts (`npm start`)
- `skills/julia-bridge/*.yml` – OpenClaw callable tool wrappers
- `agents/juliamcp.yml` – agent definition that wires these tools together
