# Memory — OpenClaw

OpenClaw is a stateless Telegram gateway. It does not persist conversation state internally — all message routing flows through the bridge (port 3001).

## Operational Notes

- Gateway runs as a persistent macOS LaunchAgent
- Restart with: `openclaw gateway start --force`
- Health check: `openclaw health`
- Julia relay skill forwards messages to `POST http://localhost:3001/incoming`
