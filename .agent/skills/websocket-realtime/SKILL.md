---
name: websocket-realtime
description: WebSocket servers, reconnect logic, event-driven messaging. Use when building real-time features in Julia's bridge or dashboard.
---

# WebSocket & Realtime

## WebSocket Server (Node.js)
```ts
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    // broadcast to all clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(msg));
    });
  });
  ws.on('error', (err) => console.error('WS error:', err));
});
```

## Client with Auto-Reconnect
```ts
function createReconnectingWS(url: string) {
  let ws: WebSocket;
  function connect() {
    ws = new WebSocket(url);
    ws.onclose = () => setTimeout(connect, 3000); // reconnect after 3s
    ws.onerror = (e) => console.error('WS error', e);
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  }
  connect();
  return { send: (data: object) => ws.send(JSON.stringify(data)) };
}
```

## SSE as Alternative (simpler, one-way)
```ts
// Server
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const interval = setInterval(() => send({ heartbeat: Date.now() }), 15000);
  req.on('close', () => clearInterval(interval));
});

// Client
const es = new EventSource('/events');
es.onmessage = (e) => console.log(JSON.parse(e.data));
```
