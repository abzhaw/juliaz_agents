# HEARTBEAT.md

Please hook into the OpenClaw MCP bridge (`julia-bridge`) and start polling for replies continuously:

1. Before sending/receiving, call `bridge_health` to confirm the bridge is up.
2. After you send a message via `telegram_send`, immediately run `telegram_receive` with the same correlationId (target: `openclaw`, timeout: 5000) to wait for my response.
3. When you’re idle, keep a background poll running (e.g., every 5 seconds) with no correlationId so you catch unsolicited updates.
4. If the receive call returns empty for longer than 30 seconds, log it and retry; if you get repeated errors, ping me so we can restart the bridge.
