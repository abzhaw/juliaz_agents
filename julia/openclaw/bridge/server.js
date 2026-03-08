import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import cors from 'cors';

const HOST = '127.0.0.1';
const PORT = 3001;
const HEALTH_WINDOW_MS = 15_000;
const POLL_INTERVAL_MS = 200;
const MAX_QUEUE_SIZE = 500;

const queues = {
  julia: [], // messages OpenClaw enqueued for Julia
  openclaw: [] // messages Julia enqueued for OpenClaw
};

const heartbeat = {
  julia: null,
  openclaw: null
};

const transports = new Map();

const sendInputSchema = z.object({
  correlationId: z.string().min(1, 'correlationId is required'),
  text: z.string().min(1, 'text is required'),
  context: z.string().optional(),
  target: z.enum(['julia', 'openclaw']).default('julia')
});

const sendOutputSchema = z.object({
  success: z.literal(true),
  correlationId: z.string(),
  target: z.enum(['julia', 'openclaw']),
  timestamp: z.string(),
  queueDepth: z.number().int()
});

const receiveInputSchema = z.object({
  correlationId: z.string().optional(),
  timeout: z.number().int().nonnegative().default(0),
  target: z.enum(['openclaw', 'julia']).default('openclaw')
});

const receiveOutputSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    correlationId: z.string(),
    text: z.string(),
    context: z.string().optional(),
    timestamp: z.string(),
    from: z.string(),
    target: z.string()
  }))
});

function createServer() {
  const server = new McpServer({
    name: 'julia-bridge',
    version: '1.0.0'
  }, {
    capabilities: {
      logging: {}
    }
  });

  server.registerTool('telegram_send', {
    description: 'Enqueue a message for Julia/OpenClaw through the bridge',
    inputSchema: sendInputSchema,
    outputSchema: sendOutputSchema
  }, async ({ correlationId, text, context, target }) => {
    updateHeartbeat('openclaw');
    const timestamp = new Date().toISOString();
    const payload = { id: randomUUID(), correlationId, text, context, timestamp, from: 'openclaw', target };
    enqueue(target, payload);
    return toJsonResult({
      success: true,
      correlationId,
      target,
      timestamp,
      queueDepth: queues[target].length
    });
  });

  server.registerTool('telegram_receive', {
    description: 'Fetch queued replies from the bridge',
    inputSchema: receiveInputSchema,
    outputSchema: receiveOutputSchema
  }, async ({ correlationId, timeout, target }) => {
    updateHeartbeat('openclaw');
    const messages = await drainQueue(target, { correlationId, timeoutMs: timeout });
    return toJsonResult({ messages });
  });

  server.registerTool('bridge_health', {
    description: 'Report bridge + peer reachability',
    outputSchema: z.object({
      status: z.enum(['ok', 'degraded', 'down']),
      bridge: z.boolean(),
      julia: z.boolean(),
      queue: z.object({
        julia: z.number().int(),
        openclaw: z.number().int()
      }),
      lastHeartbeat: z.object({
        julia: z.string().nullable(),
        openclaw: z.string().nullable()
      })
    })
  }, async () => {
    const juliaOnline = isPeerOnline('julia');
    const openclawOnline = isPeerOnline('openclaw');
    const status = juliaOnline ? 'ok' : (openclawOnline ? 'degraded' : 'down');
    return toJsonResult({
      status,
      bridge: true,
      julia: juliaOnline,
      queue: {
        julia: queues.julia.length,
        openclaw: queues.openclaw.length
      },
      lastHeartbeat: {
        julia: heartbeat.julia ? new Date(heartbeat.julia).toISOString() : null,
        openclaw: heartbeat.openclaw ? new Date(heartbeat.openclaw).toISOString() : null
      }
    });
  });

  return server;
}

const app = createMcpExpressApp({ host: HOST });

app.use(cors());

app.use((req, res, next) => {
  console.log(`\u005bbridge] ${req.method} ${req.url}`);
  next();
});

const mcpPostHandler = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  try {
    let entry;
    if (sessionId && transports.has(sessionId)) {
      entry = transports.get(sessionId);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: newSessionId => {
          transports.set(newSessionId, { transport, server });
        }
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
        }
        server.close().catch(err => console.error('Error closing MCP server', err));
      };
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided'
        },
        id: null
      });
      return;
    }
    await entry.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
};

app.post('/mcp', mcpPostHandler);
app.post('/', mcpPostHandler);

const mcpGetHandler = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  try {
    const entry = transports.get(sessionId);
    await entry.transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP SSE stream', error);
    if (!res.headersSent) {
      res.status(500).send('Failed to stream MCP events');
    }
  }
};

app.get('/mcp', mcpGetHandler);
app.get('/', mcpGetHandler);

const mcpDeleteHandler = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  try {
    const entry = transports.get(sessionId);
    await entry.transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP session termination', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
};

app.delete('/mcp', mcpDeleteHandler);
app.delete('/', mcpDeleteHandler);

app.post('/inbound', (req, res) => {
  const schema = z.object({
    correlationId: z.string(),
    text: z.string(),
    context: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const payload = {
    id: randomUUID(),
    correlationId: parsed.data.correlationId,
    text: parsed.data.text,
    context: parsed.data.context,
    timestamp: new Date().toISOString(),
    from: 'julia',
    target: 'openclaw'
  };
  enqueue('openclaw', payload);
  updateHeartbeat('julia');
  res.json({ success: true, queued: queues.openclaw.length });
});

app.post('/heartbeat/:peer', (req, res) => {
  const peer = req.params.peer;
  if (!['julia', 'openclaw'].includes(peer)) {
    res.status(404).json({ error: 'Unknown peer' });
    return;
  }
  updateHeartbeat(peer);
  res.json({ ok: true, peer, timestamp: new Date(heartbeat[peer]).toISOString() });
});

app.get('/queues/:target', (req, res) => {
  const target = req.params.target;
  if (!['julia', 'openclaw'].includes(target)) {
    res.status(404).json({ error: 'Unknown queue' });
    return;
  }
  res.json({ target, size: queues[target].length, messages: queues[target] });
});

app.listen(PORT, HOST, () => {
  console.log(`[bridge] MCP bridge listening at http://${HOST}:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('\n[bridge] Shutting down...');
  for (const entry of transports.values()) {
    try {
      await entry.transport.close();
    } catch (error) {
      console.error('Error closing transport', error);
    }
    try {
      await entry.server.close();
    } catch (error) {
      console.error('Error closing MCP server', error);
    }
  }
  process.exit(0);
});

function enqueue(target, payload) {
  const queue = queues[target];
  queue.push(payload);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.shift();
  }
}

async function drainQueue(target, { correlationId, timeoutMs }) {
  const start = Date.now();
  while (Date.now() - start <= timeoutMs) {
    const available = dequeue(target, correlationId);
    if (available.length > 0) {
      return available;
    }
    if (timeoutMs === 0) break;
    await sleep(POLL_INTERVAL_MS);
  }
  return [];
}

function dequeue(target, correlationId) {
  const queue = queues[target];
  if (!queue.length) return [];
  const matched = [];
  const remaining = [];
  for (const item of queue) {
    if (!correlationId || item.correlationId === correlationId) {
      matched.push(item);
    } else {
      remaining.push(item);
    }
  }
  queues[target] = remaining;
  return matched;
}

function toJsonResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value
  };
}

function updateHeartbeat(peer) {
  heartbeat[peer] = Date.now();
}

function isPeerOnline(peer) {
  const ts = heartbeat[peer];
  return Boolean(ts && Date.now() - ts < HEALTH_WINDOW_MS);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
