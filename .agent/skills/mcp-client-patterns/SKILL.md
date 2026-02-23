---
name: mcp-client-patterns
description: Connecting to MCP servers, tool invocation, session management. Use when the orchestrator or any agent needs to call tools on an MCP server (bridge, cowork-mcp).
---

# MCP Client Patterns

## HTTP JSON-RPC Call (simple, no SDK needed)
```ts
async function callMcpTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const response = await fetch(`${serverUrl}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    }),
    signal: AbortSignal.timeout(30_000),  // 30s timeout
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result?.content?.[0]?.text ?? '';
}

// Usage
const summary = await callMcpTool(
  'http://localhost:3003',
  'claude_summarize',
  { content: longText, format: 'bullets' }
);
```

## List Available Tools
```ts
const response = await fetch(`${serverUrl}/mcp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
});
const { result } = await response.json();
console.log(result.tools.map(t => t.name));
```

## Julia's MCP Call Map
| Caller | Server | Tool |
|--------|--------|------|
| Orchestrator | bridge:3001 | `telegram_get_pending`, `telegram_send_reply` |
| Orchestrator | cowork-mcp:3003 | `claude_task`, `claude_summarize` |
| Frontend | bridge:3001 | `get_messages`, `get_system_status` |
