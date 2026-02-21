# Julia Bridge Skills

These skills let OpenClaw talk to Julia (the Antigravity IDE agent) exclusively through the local MCP bridge running on `http://127.0.0.1:3001`.

## Available skills

| Skill | MCP Method | Purpose |
| --- | --- | --- |
| `julia-bridge/send` | `telegram_send` | Push outbound messages to Julia with correlation tracking |
| `julia-bridge/receive` | `telegram_receive` | Poll replies from Julia (optionally scoped by `correlationId`) |
| `julia-bridge/health` | `bridge_health` | Verify the bridge + Julia are reachable and responsive |

## Usage pattern

1. Call `julia-bridge/health`
2. Use `julia-bridge/send` with a unique `correlationId`
3. Poll with `julia-bridge/receive` until matching reply arrives (or time out)

All skills invoke the MCP bridge via [`mcporter`](https://mcporter.dev) and expect the server to be registered as `julia-bridge` in `~/.config/mcporter/config.json`:

```json
{
  "servers": {
    "julia-bridge": {
      "transport": "http",
      "url": "http://127.0.0.1:3001"
    }
  }
}
```

Register the MCP server once:

```bash
mcporter config add julia-bridge --url http://127.0.0.1:3001
```

Each skill file below documents the exact CLI call and expected payloads. Log files are written to `logs/julia-bridge.log` for troubleshooting.
