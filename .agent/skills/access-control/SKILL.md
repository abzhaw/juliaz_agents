---
name: access-control
description: Role-based access, allowlists, Telegram pairing security. Use when securing Julia's communication channels or implementing authorization for multi-user scenarios.
---

# Access Control

## Telegram Allowlist Pattern
```ts
// Only allow messages from known Telegram chat IDs
const ALLOWED_CHAT_IDS = new Set([
  process.env.RAPHAEL_CHAT_ID,
]);

function isAuthorized(chatId: string): boolean {
  return ALLOWED_CHAT_IDS.has(chatId);
}

// In message handler
if (!isAuthorized(msg.chatId)) {
  console.warn(`Unauthorized access attempt from chatId: ${msg.chatId}`);
  return; // silently ignore
}
```

## API Bearer Token Auth
```ts
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

## OpenClaw Pairing Security
- OpenClaw uses device pairing (interactive approval via Telegram)
- Only paired devices can send messages through the gateway
- Re-pair via `openclaw onboard` if device.json is corrupted
- Never share the pairing code or gateway WebSocket URL externally

## Bridge Security
```ts
// Bridge is localhost-only — verify origin in production
const TRUSTED_ORIGINS = ['http://localhost:3002', 'http://localhost:4000'];
app.use((req, res, next) => {
  const origin = req.headers.origin ?? req.headers.referer ?? '';
  if (!TRUSTED_ORIGINS.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```
