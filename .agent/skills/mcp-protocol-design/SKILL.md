---
name: mcp-protocol-design
description: MCP server authoring, tool registration, Streamable HTTP transport, stateless vs stateful sessions. Use when building or extending Julia's bridge, cowork-mcp, or any MCP-based component.
---

# MCP Protocol Design

## Setup (TypeScript)
```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Stateless: new server per request (recommended for HTTP)
app.all('/mcp', async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,  // stateless
    enableJsonResponse: true,
  });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

## Tool Registration
```ts
function createMcpServer() {
  const server = new McpServer({ name: 'my-server', version: '1.0.0' });

  server.registerTool('my_tool', {
    title: 'My Tool',
    description: 'What this tool does and when to use it.',
    inputSchema: z.object({
      input: z.string().describe('The input to process'),
    }),
  }, async ({ input }) => {
    return { content: [{ type: 'text', text: `Result: ${input}` }] };
  });

  return server;
}
```

## Health Endpoint (always add one)
```ts
app.get('/health', (_req, res) => res.json({
  ok: true, server: 'my-mcp', version: '1.0.0', uptime: process.uptime()
}));
```

## MCP Client (connecting to an MCP server)
```ts
// From an orchestrator, calling an MCP tool over HTTP
const response = await fetch('http://localhost:3003/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'claude_task', arguments: { task: 'Summarize this' } }
  })
});
```

## Julia's MCP Servers
| Server | Port | Purpose |
|--------|------|---------|
| `bridge` | 3001 | Agent ↔ UI message relay |
| `cowork-mcp` | 3003 | Claude sub-agent |
