---
name: agent-tool-design
description: Design reliable, well-documented tools for LLM agents — input schemas, error returns, idempotency, and naming conventions. Use when adding new MCP tools to bridge, cowork-mcp, or the orchestrator.
---

# Agent Tool Design

## Principles

1. **One tool, one responsibility** — don't combine unrelated actions
2. **Descriptive names** — `send_telegram_message` not `send_msg`
3. **Rich descriptions** — the LLM decides which tool to use based on the description
4. **Always return useful errors** — never throw silently
5. **Idempotent where possible** — safe to retry on failure

## MCP Tool Schema (Zod)
```ts
server.registerTool('create_task', {
  title: 'Create Task',
  description: `Create a new task in Julia's backend.
  Use when the user asks to add, remember, or track something.
  Returns the created task with its ID.
  Example: create_task({ title: "Buy groceries" })`,
  inputSchema: z.object({
    title: z.string().min(1).max(500).describe('Task title — be specific and actionable'),
    priority: z.enum(['low', 'medium', 'high']).default('medium').optional(),
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  }
}, async ({ title, priority }) => {
  try {
    const task = await backend.createTask({ title, priority });
    return { content: [{ type: 'text', text: JSON.stringify(task) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
  }
});
```

## Tool Description Template
```
[One sentence: what it does]
Use when [trigger condition].
[Args description if non-obvious]
Returns [what the agent gets back].
Example: tool_name({ param: "value" })
```

## Error Return Convention
```ts
// Always return errors as text content — never throw from a tool
// The LLM can read the error and decide what to do
return { content: [{ type: 'text', text: `Error: ${message}` }] };
```

## Julia's Tool Categories
| Category | Examples |
|----------|---------|
| Communication | `send_telegram_message`, `get_pending_messages` |
| Task management | `create_task`, `update_task`, `list_tasks` |
| System | `get_pm2_status`, `restart_service`, `check_health` |
| Delegation | `claude_task`, `claude_code_review` (cowork-mcp) |
