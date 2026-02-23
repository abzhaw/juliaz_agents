---
name: anthropic-claude-integration
description: Integrate Anthropic's Claude API including Messages API, vision/multimodal inputs, tool use, and streaming. Use when building or debugging cowork-mcp or any Claude-powered component.
---

# Anthropic Claude Integration

## Setup
```ts
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

## Basic Message
```ts
const response = await client.messages.create({
  model: 'claude-opus-4-5',
  max_tokens: 4096,
  system: 'You are Julia, a helpful agent.',
  messages: [{ role: 'user', content: 'What is 2+2?' }]
});
const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
```

## Multimodal (Vision)
```ts
messages: [{
  role: 'user',
  content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64str } },
    { type: 'text', text: 'What is in this screenshot?' }
  ]
}]
```

## Tool Use
```ts
const tools = [{
  name: 'get_weather',
  description: 'Get weather for a city',
  input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }
}];
const response = await client.messages.create({ model, max_tokens, messages, tools });
// Check response.stop_reason === 'tool_use'
const toolUse = response.content.find(b => b.type === 'tool_use');
```

## Streaming
```ts
const stream = client.messages.stream({ model, max_tokens, messages });
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## Error Handling
- `401` → Invalid API key
- `429` → Rate limit — exponential backoff
- `529` → Overloaded — retry after delay
- Always wrap in try/catch; log `e.status` and `e.message`

## Cowork-MCP Pattern
- Model: `claude-opus-4-5` (default, override via env `CLAUDE_MODEL`)
- CHARACTER_LIMIT: 25,000 chars on output
- Stateless: new server + transport per `/mcp` request
