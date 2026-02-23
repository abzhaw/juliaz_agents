---
name: streaming-api-design
description: Server-sent events, chunked transfer, backpressure. Use when building streaming endpoints in Julia's Next.js or bridge servers.
---

# Streaming API Design

## When to Stream
- LLM responses (token-by-token output)
- Long-running operations (progress updates)
- Real-time logs/events

## Node.js Chunked Transfer
```ts
app.get('/stream/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let closed = false;
  req.on('close', () => { closed = true; });

  // Send data as it arrives
  const send = (event: string, data: object) => {
    if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Heartbeat to keep connection alive
  const hb = setInterval(() => send('heartbeat', { ts: Date.now() }), 15_000);
  req.on('close', () => clearInterval(hb));

  // Attach to log emitter
  logEmitter.on('log', (line) => send('log', { line }));
});
```

## Next.js App Router Streaming
```ts
// app/api/stream-task/route.ts
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Start async work
  (async () => {
    for await (const chunk of longRunningTask()) {
      await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    }
    await writer.write(encoder.encode('data: [DONE]\n\n'));
    await writer.close();
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  });
}
```

## Backpressure Handling
```ts
// Only write when client is ready (web streams)
const writer = stream.writable.getWriter();
while (hasMoreData()) {
  await writer.ready;  // wait if buffer is full
  await writer.write(nextChunk());
}
```
