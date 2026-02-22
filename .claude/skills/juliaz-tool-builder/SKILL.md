---
name: juliaz-tool-builder
description: "Expert guidance for designing and implementing tools for Julia's agents. Trigger when adding a new tool to the orchestrator, frontend, or any agent. Also trigger for: 'add tool', 'new tool', 'tool schema', 'tool not working', 'agent can't use tool', 'function calling', or any tool design question."
---

# juliaz-tool-builder — Tool Design for Julia's Agents

> Tools are how Julia's agents interact with the world. A well-designed tool is the difference between an agent that works and one that hallucinates. Adapted from `agent-tool-builder`.

## Core Insight

**The LLM never sees your code. It only sees the schema and description.** A perfectly implemented tool with a vague description will fail. A simple tool with crystal-clear documentation will succeed.

## Use this skill when

- Adding a new tool to the orchestrator (`orchestrator/src/tools.ts`)
- Adding a new tool to the frontend (`frontend/server.ts` chatTools)
- Fixing a tool that agents misuse or ignore
- Designing tool schemas for any agent in the system

## Tool Description Checklist

Every tool description MUST answer these 5 questions for the LLM:

1. **WHAT does this tool do?** (one clear sentence)
2. **WHEN should the LLM use it?** (specific triggers: "Use when the user asks to...")
3. **WHEN should the LLM NOT use it?** (prevent misuse: "Do NOT use for...")
4. **WHAT inputs does it need?** (with examples in the parameter descriptions)
5. **WHAT does it return?** (so the LLM knows how to summarize the result)

### Good Example (from orchestrator)

```typescript
{
    name: 'send_email',
    description: [
        'Send an email from raphael@aberer.ch via SMTP.',
        'Use this when the user asks Julia to send, write, or draft-and-send an email.',
        'If the recipient, subject, and body are all clear from context, call this immediately.',
        'If any detail is missing, ask one concise question first.',
    ].join(' '),
    input_schema: {
        properties: {
            to: { type: 'string', description: 'Recipient email address (or comma-separated list).' },
            subject: { type: 'string', description: 'Email subject line.' },
            body: { type: 'string', description: 'Plain-text body of the email.' },
        },
        required: ['to', 'subject', 'body'],
    },
}
```

### Bad Example (don't do this)

```typescript
{
    name: 'send_email',
    description: 'Sends an email.',  // Too vague — when? to whom? what format?
    input_schema: {
        properties: {
            data: { type: 'string', description: 'Email data.' },  // What format?
        },
    },
}
```

## Anti-Patterns

### 1. Vague Descriptions
The #1 cause of tool misuse. If the description doesn't tell the LLM exactly when to use it, it will guess wrong.

### 2. Silent Failures
Tools that return empty strings or generic "error" on failure. Always return a clear error message that helps the LLM recover.

### 3. Too Many Tools
More tools = more confusion for the LLM. Keep the tool set focused. In juliaz: orchestrator has 2-4 tools, frontend has 3-5 tools.

### 4. Overlapping Descriptions
Two tools with similar descriptions → agent picks randomly. Make descriptions mutually exclusive.

## juliaz Tool Implementation Patterns

### Orchestrator Tools (`orchestrator/src/tools.ts`)

Tools are defined in two formats (Anthropic + OpenAI) from a single source:

```typescript
// Define once in Anthropic format
export const TOOLS: Tool[] = [{ name, description, input_schema }];

// Auto-convert to OpenAI format
export const OPENAI_TOOLS = TOOLS.map(tool => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
}));

// Single dispatcher for both paths
export async function executeTool(name: string, rawArgs: string): Promise<string> {
    const args = JSON.parse(rawArgs);
    switch (name) {
        case 'tool_name': return await toolImpl(args);
        default: return `Error: unknown tool "${name}"`;
    }
}
```

### Frontend Tools (`frontend/server.ts`)

Uses Vercel AI SDK `tool()` helper with Zod schemas:

```typescript
const chatTools = {
    tool_name: tool({
        description: '...',
        inputSchema: z.object({ ... }),
        execute: async (args) => { ... },
    }),
};
```

### Error Handling Pattern

Always return a string (never throw) — the LLM needs to see the error:

```typescript
try {
    // ... tool logic
    return `Success: did the thing.`;
} catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`;
}
```

## Key Files

| Location | Format | Used by |
|----------|--------|---------|
| `orchestrator/src/tools.ts` | Anthropic `Tool[]` + OpenAI auto-convert | Claude Haiku + GPT-4o fallback |
| `frontend/server.ts` | Vercel AI SDK `tool()` + Zod | GPT-4o / Claude Sonnet |
| `bridge/src/index.ts` | MCP `server.tool()` | MCP clients (orchestrator, OpenClaw) |
| `cowork-mcp/src/index.ts` | MCP `server.tool()` | Claude delegation |
