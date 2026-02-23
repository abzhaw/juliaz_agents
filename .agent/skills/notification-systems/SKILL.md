---
name: notification-systems
description: Push notifications, alerting, escalation chains, multi-channel delivery. Use when Julia needs to alert Raphael via Telegram, or when designing escalation paths for agent failures.
---

# Notification Systems

## Escalation Chain Design
```
Level 1: Log to file          (always — silent)
Level 2: Dashboard warning    (PM2 status + frontend)
Level 3: Telegram message     (via julia-relay or direct bot)
Level 4: Repeat + urgent tag  (3x in 10 min → URGENT prefix)
```

## Julia's Notification Pattern
```ts
// Notify Raphael via bridge → OpenClaw → Telegram
async function notify(message: string, level: 'info' | 'warn' | 'alert' = 'info') {
  const prefix = level === 'alert' ? '🚨 ALERT' : level === 'warn' ? '⚠️ Warning' : 'ℹ️ Info';
  await fetch('http://localhost:3001/incoming', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: process.env.RAPHAEL_CHAT_ID,
      text: `${prefix}: ${message}`,
      source: 'julia-system'
    })
  });
}
```

## Deduplication (avoid alert storms)
```ts
const recentAlerts = new Map<string, number>();
function shouldAlert(key: string, cooldownMs = 600_000): boolean {
  const last = recentAlerts.get(key) ?? 0;
  if (Date.now() - last < cooldownMs) return false;
  recentAlerts.set(key, Date.now());
  return true;
}
```

## Notification Rules for Julia
- **On service down** → alert Raphael immediately
- **On service recovered** → info message (resolved)  
- **On security finding** → warn (daily) or alert (critical)
- **On task completed** → info (optional, user preference)
- **Rate limit**: max 1 alert per 10min per service
