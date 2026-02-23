---
name: openai-api-integration
description: Integrate OpenAI's API including GPT-4o tool calling, streaming responses, function schemas, and error handling. Use when building or debugging Julia's orchestrator or any component that calls OpenAI.
---

# OpenAI API Integration

## Setup
```ts
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

## Tool Calling (Function Calling)
```ts
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'get_task_list',
    description: 'Fetch pending tasks from the backend',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['pending', 'done'] } },
      required: []
    }
  }
}];

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
  tools,
  tool_choice: 'auto',
});
```

## Handling Tool Calls
```ts
const msg = response.choices[0].message;
if (msg.tool_calls) {
  for (const call of msg.tool_calls) {
    const result = await executeTool(call.function.name, JSON.parse(call.function.arguments));
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
  }
  // Continue the loop with updated messages
}
```

## Streaming
```ts
const stream = await client.chat.completions.create({
  model: 'gpt-4o', messages, stream: true
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

## Error Handling
```ts
try {
  // API call
} catch (e) {
  if (e instanceof OpenAI.APIError) {
    if (e.status === 429) // rate limit — backoff
    if (e.status === 503) // overloaded — retry
    if (e.status === 401) // bad key — alert
  }
}
```

## Julia Orchestrator Pattern
- Model: `gpt-4o`
- Loop: poll bridge → build messages → call OpenAI → execute tools → repeat
- Always set a timeout (30s) per API call to avoid hangs
- Use `max_tokens: 4096` as a safe cap
