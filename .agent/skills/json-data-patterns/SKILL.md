---
name: json-data-patterns
description: JSON persistence, schema validation, migration patterns. Use when working with JSON files in the bridge queue, memory files, or any file-based agent storage.
---

# JSON Data Patterns

## Safe Read/Write Pattern
```ts
import fs from 'fs';
import path from 'path';

function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function writeJson(filePath: string, data: unknown, pretty = true): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, pretty ? 2 : 0));
  fs.renameSync(tmp, filePath);  // atomic write (avoids corrupt files on crash)
}
```

## Schema Validation (Zod)
```ts
import { z } from 'zod';

const MessageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string(),
  text: z.string(),
  ts: z.number(),
  processed: z.boolean().default(false),
});

type Message = z.infer<typeof MessageSchema>;

function loadMessages(file: string): Message[] {
  const raw = readJson(file, []);
  return z.array(MessageSchema).parse(raw);  // throws if invalid
}
```

## Migration Pattern
```ts
interface V1Message { text: string; chatId: string; }
interface V2Message { text: string; chatId: string; id: string; ts: number; }

function migrate(data: unknown): V2Message[] {
  const messages = data as V1Message[];
  return messages.map((m, i) => ({
    ...m,
    id: crypto.randomUUID(),  // add new field
    ts: Date.now() - (messages.length - i) * 1000,  // backfill
  }));
}
```

## Julia Usage
- `bridge/data/queue.json` — message queue (read/write every 3s)
- `security-agent/memory/baseline.json` — security scan baselines
- `adhd-agent/memory/state.json` — structural drift tracking
- Always use atomic writes to avoid partial writes on crash
