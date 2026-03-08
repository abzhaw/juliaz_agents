# Cowork MCP Server

> **Claude as a Multimodal Sub-Agent inside Julia's agentic system.**

This server wraps the Anthropic Claude API as an MCP server (Streamable HTTP, port 3003).
It allows Julia's orchestrator — and any other agent in the system — to delegate tasks to Claude.

---

## Architecture Position

```
Julia Orchestrator  ──→  cowork-mcp (port 3003)  ──→  Anthropic Claude API
                           │
                           └── serves MCP tools via http://localhost:3003/mcp
```

---

## Available MCP Tools

| Tool | Description |
|---|---|
| `claude_task` | Send any text task to Claude; general-purpose delegation |
| `claude_multimodal_task` | Text + image(s) — base64 or URL; vision tasks |
| `claude_code_review` | Structured code review with severity ratings |
| `claude_summarize` | Summarize content in bullets, paragraph, or TL;DR |
| `claude_brainstorm` | Generate ideas, steps, or alternatives for a goal |
| `cowork_status` | Health check — returns server state and available tools |

---

## Quick Start

```bash
# 1. Install dependencies
cd cowork-mcp
npm install

# 2. Set your Anthropic API key (or add to root .env.secrets)
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Build and start
npm run build
npm start

# Or for dev with auto-reload:
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `CLAUDE_MODEL` | `claude-sonnet-4-6-20251101` | Default Claude model |
| `COWORK_MCP_PORT` | `3003` | HTTP port |

---

## Connecting Julia's Orchestrator

Add `http://localhost:3003/mcp` to the orchestrator's MCP client config.

Example Claude Code / MCP client config:
```json
{
  "mcpServers": {
    "cowork": {
      "url": "http://localhost:3003/mcp"
    }
  }
}
```

For the Julia orchestrator, the recommended integration is via the MCP SDK client:
```typescript
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost:3003/mcp')
);
const client = new Client({ name: 'julia-orchestrator', version: '1.0.0' });
await client.connect(transport);

// Call a tool
const result = await client.callTool({
    name: 'claude_task',
    arguments: { task: 'Translate this to French: Hello World' }
});
```

---

## PM2 / Ecosystem

This server is registered in `ecosystem.config.js` as `cowork-mcp`.
```bash
pm2 start ecosystem.config.js --only cowork-mcp
pm2 logs cowork-mcp
```

---

*Part of the Julia multiagent system. Maintained by Antigravity.*
