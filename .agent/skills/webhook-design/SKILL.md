---
name: webhook-design
description: Receiving webhooks, verification, idempotency, event routing. Use when Julia needs to receive events from external services.
---

# Webhook Design

## Receiving Webhooks (Express)
```ts
import crypto from 'crypto';

// Verify HMAC signature (common pattern — GitHub, Stripe, etc.)
function verifySignature(payload: Buffer, sig: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-hub-signature-256'] as string;
  if (!verifySignature(req.body, sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }
  const event = JSON.parse(req.body.toString());
  handleEvent(event);
  res.status(200).json({ ok: true });  // respond quickly, process async
});
```

## Idempotency (prevent duplicate processing)
```ts
const processedEvents = new Set<string>();

async function handleEvent(event: { id: string; type: string; data: unknown }) {
  if (processedEvents.has(event.id)) {
    console.log(`Duplicate event ${event.id} — skipping`);
    return;
  }
  processedEvents.add(event.id);
  // process event...
  // For persistence: store event ID in DB with TTL
}
```

## Event Router
```ts
const handlers: Record<string, (data: unknown) => Promise<void>> = {
  'message.received': handleMessage,
  'task.completed': handleTaskCompleted,
  'security.alert': handleSecurityAlert,
};

async function handleEvent(event: { type: string; data: unknown }) {
  const handler = handlers[event.type];
  if (handler) await handler(event.data);
  else console.warn(`Unhandled event type: ${event.type}`);
}
```
