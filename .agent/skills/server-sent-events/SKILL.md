---
name: server-sent-events
description: SSE streaming, useChat hook, streaming AI responses to UI. Use when building real-time streaming chat responses in Julia's Next.js frontend.
---

# Server-Sent Events (SSE)

## Server (Next.js Route Handler)
```ts
// app/api/stream/route.ts
export async function POST(req: Request) {
  const { message } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));

      // Stream from OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', messages: [{ role: 'user', content: message }], stream: true
      });
      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) send(text);
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
```

## Client (React)
```tsx
async function streamChat(message: string, onChunk: (text: string) => void) {
  const res = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        const { text } = JSON.parse(line.slice(6));
        onChunk(text);
      }
    }
  }
}
```

## Vercel AI SDK (easier alternative)
```tsx
import { useChat } from 'ai/react';
const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat'
});
```
