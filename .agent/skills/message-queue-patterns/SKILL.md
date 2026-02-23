---
name: message-queue-patterns
description: Queue design, polling vs push, persistence, dead-letter handling. Use when working with the bridge's queue.json or designing message flow between agents.
---

# Message Queue Patterns

## Julia's Bridge Queue Pattern
```ts
// Simple file-backed queue (bridge/data/queue.json)
interface Message { id: string; chatId: string; text: string; ts: number; processed: boolean; }

const load = (): Message[] => JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8') || '[]');
const save = (q: Message[]) => fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));

function enqueue(msg: Omit<Message, 'id' | 'ts' | 'processed'>) {
  const q = load();
  q.push({ ...msg, id: crypto.randomUUID(), ts: Date.now(), processed: false });
  save(q);
}

function dequeue(): Message[] {
  const q = load();
  const pending = q.filter(m => !m.processed);
  save(q.map(m => ({ ...m, processed: true })));
  return pending;
}
```

## Polling vs Push
| Approach | Pros | Cons | Use for |
|----------|------|------|---------|
| **Polling** | Simple, no infra | Latency, waste | Julia orchestrator (3s interval) |
| **SSE/WebSocket** | Real-time | Complex | Dashboard updates |
| **Webhook** | Instant | Needs public URL | External APIs |

## Stale Message Cleanup
```ts
// Remove messages older than 24h
function cleanup() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const q = load().filter(m => m.ts > cutoff);
  save(q);
}
```

## Dead-Letter Handling
```ts
// Messages that failed to process go to DLQ
function moveToDeadLetter(msg: Message, reason: string) {
  const dlq = JSON.parse(fs.readFileSync(DLQ_FILE, 'utf-8') || '[]');
  dlq.push({ ...msg, failedAt: Date.now(), reason });
  fs.writeFileSync(DLQ_FILE, JSON.stringify(dlq, null, 2));
}
```
