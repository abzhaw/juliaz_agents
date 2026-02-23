---
name: agent-memory-systems
description: Short/long-term memory for LLM agents — vector stores, context window management, memory consolidation. Use when Julia needs to remember user preferences, past decisions, or conversation history across sessions.
---

# Agent Memory Systems

## Memory Types

| Type | Duration | Storage | Use case |
|------|----------|---------|----------|
| **In-context** | Single session | Message array | Current conversation |
| **Working memory** | Loop iteration | JSON file / queue | Bridge queue, task state |
| **Long-term** | Persistent | DB / vector store | User preferences, learnings |
| **Episodic** | Event-based | Log files | Past actions, audit trail |

## Julia's Current Memory Architecture

```
Bridge queue.json          ← in-flight messages (working memory)
backend Postgres           ← task/log persistence (long-term)
orchestrator/src/prompt.ts ← static context injected each loop
.agent/skills/             ← Antigravity's knowledge base
adhd-agent/memory/         ← system health history
security-agent/memory/     ← security baselines and learnings
thesis/memory/             ← session buffer for thesis work
```

## Patterns

### Message Window Management
```ts
// Keep only last N turns to stay within context window
const MAX_MESSAGES = 20;
if (messages.length > MAX_MESSAGES) {
  // Always keep system message at index 0
  messages = [messages[0], ...messages.slice(-(MAX_MESSAGES - 1))];
}
```

### Memory Consolidation (for long-running agents)
```ts
// Summarize old messages when approaching token limit
if (estimatedTokens(messages) > 100_000) {
  const summary = await summarize(messages.slice(1, -10));
  messages = [messages[0], { role: 'assistant', content: summary }, ...messages.slice(-10)];
}
```

### Persistent Key-Value Memory
```ts
// Simple file-based memory for small agents
import fs from 'fs';
const MEMORY_FILE = './memory/state.json';
const load = () => JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8') || '{}');
const save = (data: object) => fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
```

## Best Practices
- Always namespace memory by agent name to avoid collisions
- Timestamp all memory entries for staleness detection
- Never store raw API keys or secrets in memory files
- Git-ignore memory directories with sensitive data
