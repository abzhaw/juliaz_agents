---
name: agent-orchestration-patterns
description: Loop patterns, delegation strategies, retry logic, and multi-agent coordination. Use when designing or debugging Julia's orchestrator loop, sub-agent delegation, or inter-agent communication via bridge/MCP.
---

# Agent Orchestration Patterns

## The Core Orchestrator Loop

```ts
while (true) {
  try {
    // 1. Poll for new input
    const messages = await bridge.getPendingMessages();
    if (!messages.length) { await sleep(3000); continue; }

    // 2. Think (LLM call with tools)
    const response = await llm.chat({ messages: buildContext(messages), tools });

    // 3. Execute tool calls
    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        await executeTool(call);
      }
      continue; // loop again with tool results
    }

    // 4. Send reply
    if (response.content) await bridge.sendReply(response.content);

  } catch (err) {
    log.error(err);
    await sleep(5000); // backoff on error, never crash
  }
}
```

## Delegation Pattern (Julia → Claude via cowork-mcp)
```ts
// The orchestrator delegates heavy tasks to Claude
{
  name: 'claude_task',
  description: 'Delegate complex writing/analysis to Claude sub-agent'
}

// Usage in tool execution:
const result = await mcpClient.callTool('claude_task', {
  task: 'Summarize these 10 research papers in 3 bullets each',
  system: 'You are an academic research assistant'
});
```

## Retry with Backoff
```ts
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === maxAttempts - 1) throw err;
      await sleep(1000 * Math.pow(2, i)); // exponential backoff
    }
  }
}
```

## Multi-Agent Patterns in Julia

| Pattern | Implementation |
|---------|---------------|
| **Polling** | Orchestrator polls bridge every 3s |
| **Fan-out** | Orchestrator delegates to cowork-mcp |
| **Scheduled** | ADHD/security agents run on cron |
| **Event-driven** | LaunchAgent triggers on boot |

## Anti-Patterns
- ❌ Infinite loops without sleep → burns CPU
- ❌ Crashing on tool failure → use try/catch always
- ❌ No timeout on external calls → hangs the loop forever
- ❌ Blocking I/O in hot path → use async/await
