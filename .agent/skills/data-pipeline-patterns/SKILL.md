---
name: data-pipeline-patterns
description: ETL patterns, agent data flows, transformation chains. Use when designing how data flows between Julia's components — from input (Telegram) through orchestration to output (backend/dashboard).
---

# Data Pipeline Patterns

## Julia's Data Flow Architecture
```
Telegram message
  └── OpenClaw gateway (receives, normalizes)
      └── bridge POST /incoming (queue.json)
          └── Orchestrator polls MCP (gets message)
              └── LLM processes (generates response + tool calls)
                  └── Tool executors (backend API, cowork-mcp)
                      └── bridge stores reply
                          └── OpenClaw polls reply
                              └── Telegram delivers to user
```

## ETL Pattern (Extract-Transform-Load)
```ts
// Extract: read raw data
async function extract(): Promise<RawMessage[]> {
  return readJson('./data/queue.json', []);
}

// Transform: normalize and enrich
function transform(raw: RawMessage[]): Message[] {
  return raw
    .filter(m => !m.processed)
    .map(m => ({
      id: m.id,
      text: m.text.trim(),
      chatId: String(m.chatId),
      receivedAt: new Date(m.ts),
    }));
}

// Load: write to destination
async function load(messages: Message[]): Promise<void> {
  for (const msg of messages) {
    await backendApi.post('/messages', msg);
  }
}

// Run pipeline
const raw = await extract();
const transformed = transform(raw);
await load(transformed);
```

## Fan-Out Pattern (one input → multiple outputs)
```ts
async function processMessage(message: Message) {
  await Promise.allSettled([
    logToBackend(message),        // persist
    updateDashboard(message),     // real-time UI
    checkSecurityFlags(message),  // security scan
    updateAnalytics(message),     // metrics
  ]);
}
```

## Error Isolation
```ts
// Use allSettled to prevent one failure from blocking others
const results = await Promise.allSettled(pipeline.map(step => step(data)));
results.forEach((r, i) => {
  if (r.status === 'rejected') log.error(`Step ${i} failed: ${r.reason}`);
});
```
