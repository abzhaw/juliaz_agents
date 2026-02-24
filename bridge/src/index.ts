/**
 * Julia-OpenClaw MCP Bridge Server
 *
 * Single Express app on port 3001:
 *   /mcp          ← MCP over Streamable HTTP — Julia connects here
 *   /incoming     ← REST POST — OpenClaw forwards Telegram messages
 *   /pending-reply/:chatId ← REST GET — OpenClaw polls for Julia's replies
 *   /health       ← health check
 */

import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// ─── Paths ───────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
const PORT = Number(process.env.BRIDGE_PORT ?? 3001);

// ─── Types ───────────────────────────────────────────────────────────────────

interface TelegramMessage {
    id: string;
    chatId: string;
    userId: string;
    username: string;
    text: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'replied' | 'consumed';
    reply?: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

let messages: TelegramMessage[] = [];
let heartbeats: Record<string, number | null> = { julia: null, openclaw: null };

function updateHeartbeat(peer: string) {
    if (heartbeats.hasOwnProperty(peer)) {
        heartbeats[peer] = Date.now();
    }
}

async function loadQueue(): Promise<void> {
    // Clean up any stale .tmp file from a previous crashed write
    try {
        await fs.unlink(QUEUE_FILE + '.tmp');
    } catch {
        // File doesn't exist — that's fine
    }

    try {
        const raw = await fs.readFile(QUEUE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Queue file is not an array');
        messages = parsed as TelegramMessage[];
        log(`Loaded ${messages.length} messages from queue`);
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            // First run — no queue file yet
            messages = [];
            return;
        }
        // Corrupted or invalid — back up the bad file
        log(`Queue file invalid (${err.message}). Backing up and starting fresh.`);
        try {
            await fs.rename(QUEUE_FILE, QUEUE_FILE + `.corrupted.${Date.now()}`);
        } catch (renameErr) {
            log(`Warning: could not back up corrupted queue file: ${renameErr}`);
        }
        messages = [];
    }
}

async function saveQueue(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = QUEUE_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(messages, null, 2));
    await fs.rename(tmp, QUEUE_FILE); // atomic on POSIX filesystems
}

function log(msg: string): void {
    console.log(`[bridge] ${msg}`);
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const mcp = new McpServer({ name: 'julia-openclaw-bridge', version: '1.0.0' });

mcp.tool(
    'telegram_get_pending_messages',
    'Get all pending Telegram messages waiting for Julia to respond to.',
    {},
    async () => {
        const pending = messages.filter((m) => m.status === 'pending');
        pending.forEach((m) => { m.status = 'processing'; });
        await saveQueue();
        return {
            content: [{
                type: 'text' as const,
                text: pending.length === 0
                    ? 'No pending messages.'
                    : `${pending.length} pending:\n\n${JSON.stringify(pending, null, 2)}`,
            }],
        };
    },
);

mcp.tool(
    'telegram_send_reply',
    'Send a reply to a Telegram user via OpenClaw. OpenClaw will deliver it on Telegram.',
    {
        chatId: z.string().describe('Telegram chat ID to reply to'),
        text: z.string().describe('The reply text'),
        messageId: z.string().optional().describe('Original message ID (optional)'),
    },
    async ({ chatId, text, messageId }) => {
        const msg = messages.find(
            (m) => m.chatId === chatId && (m.status === 'processing' || m.id === messageId),
        );
        if (msg) {
            msg.status = 'replied';
            msg.reply = text;
        } else {
            messages.push({
                id: `reply-${randomUUID()}`,
                chatId, userId: '', username: '', text: '',
                timestamp: new Date().toISOString(),
                status: 'replied', reply: text,
            });
        }
        await saveQueue();
        log(`Reply queued for ${chatId}: "${text.slice(0, 60)}"`);
        return { content: [{ type: 'text' as const, text: `✅ Reply queued for chat ${chatId}` }] };
    },
);

mcp.tool(
    'telegram_bridge_status',
    'Check status of the Julia-OpenClaw bridge.',
    {},
    async () => {
        const counts = {
            bridge: 'online',
            pending: messages.filter((m) => m.status === 'pending').length,
            processing: messages.filter((m) => m.status === 'processing').length,
            replied: messages.filter((m) => m.status === 'replied').length,
            total: messages.length,
        };
        return { content: [{ type: 'text' as const, text: JSON.stringify(counts, null, 2) }] };
    },
);

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        ok: true,
        bridge: 'julia-openclaw',
        version: '1.0.0',
        heartbeats: {
            julia: heartbeats.julia ? new Date(heartbeats.julia).toISOString() : null,
            openclaw: heartbeats.openclaw ? new Date(heartbeats.openclaw).toISOString() : null
        },
        counts: {
            pending: messages.filter((m) => m.status === 'pending').length,
            processing: messages.filter((m) => m.status === 'processing').length,
            replied: messages.filter((m) => m.status === 'replied').length
        }
    });
});

app.post('/heartbeat/:peer', (req, res) => {
    const { peer } = req.params;
    updateHeartbeat(peer);
    res.json({ ok: true, peer, timestamp: heartbeats[peer] ? new Date(heartbeats[peer]!).toISOString() : null });
});

// OpenClaw → POST incoming Telegram message
app.post('/incoming', async (req: Request, res: Response) => {
    const { chatId, userId, username, text } = req.body as Record<string, unknown>;
    if (!chatId || !text || String(chatId) === 'undefined') {
        res.status(400).json({ error: 'Valid chatId and text required' });
        return;
    }
    const message: TelegramMessage = {
        id: `msg-${randomUUID()}`,
        chatId: String(chatId), userId: String(userId ?? ''),
        username: String(username ?? 'unknown'), text: String(text),
        timestamp: new Date().toISOString(), status: 'pending',
    };
    messages.push(message);
    updateHeartbeat('openclaw');
    await saveQueue();
    log(`Incoming from ${message.username} (${message.chatId}): "${message.text.slice(0, 60)}"`);
    res.json({ ok: true, messageId: message.id });
});

// OpenClaw / Frontend → GET Julia's reply
app.get('/pending-reply/:chatId', async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const consume = req.query.consume === 'true';
    const replied = messages.filter((m) => m.chatId === chatId && m.status === 'replied' && m.reply);
    if (replied.length === 0) { res.json({ reply: null }); return; }
    const latest = replied[replied.length - 1]!;
    // Mark as consumed if requested (used by frontend polling to prevent stale replies)
    if (consume) {
        latest.status = 'consumed';
    }
    updateHeartbeat('openclaw');
    await saveQueue();
    log(`Reply served for ${chatId}${consume ? ' (consumed)' : ''}: "${(latest.reply ?? '').slice(0, 60)}"`);
    res.json({ reply: latest.reply });
});

// Orchestrator → POST a reply for a chatId (direct REST, no MCP needed)
app.post('/reply', async (req: Request, res: Response) => {
    const { chatId, text, messageId } = req.body as Record<string, unknown>;
    if (!chatId || !text || String(chatId) === 'undefined') {
        res.status(400).json({ error: 'Valid chatId and text required' });
        return;
    }
    const msgId = String(messageId || '');
    const msg = messages.find((m) =>
        (msgId && m.id === msgId) ||
        (!msgId && m.chatId === String(chatId) && (m.status === 'pending' || m.status === 'processing'))
    );
    if (msg) {
        msg.status = 'replied';
        msg.reply = String(text);
    } else {
        messages.push({
            id: `reply-${randomUUID()}`,
            chatId: String(chatId), userId: '', username: '', text: '',
            timestamp: new Date().toISOString(),
            status: 'replied', reply: String(text),
        });
    }
    updateHeartbeat('julia');
    await saveQueue();
    log(`[REST] Reply stored for ${String(chatId)}: "${String(text).slice(0, 60)}"`);
    res.json({ ok: true });
});

// For Dashboard compatibility with old endpoints
app.get('/queues/:target', (req, res) => {
    const { target } = req.params;
    const items = messages.filter(m => (m.status === 'pending' || m.status === 'processing' || m.status === 'replied') && m.chatId === 'dashboard-v2');
    res.json({ target, size: items.length, messages: items });
});

app.post('/inbound', async (req, res) => {
    const { chatId, text } = req.body;
    updateHeartbeat('julia');
    if (!chatId || String(chatId) === 'undefined') { res.status(400).json({ error: 'Valid chatId required' }); return; }
    // Save as reply
    const msg = messages.find(m => m.chatId === String(chatId) && (m.status === 'pending' || m.status === 'processing'));
    if (msg) {
        msg.status = 'replied';
        msg.reply = String(text);
    } else {
        messages.push({
            id: `reply-${randomUUID()}`,
            chatId: String(chatId), userId: '', username: '', text: '',
            timestamp: new Date().toISOString(),
            status: 'replied', reply: String(text),
        });
    }
    await saveQueue();
    res.json({ success: true, queued: messages.filter(m => m.status === 'replied').length });
});

// Debug — all messages
app.get('/messages', (_req: Request, res: Response) => {
    // Return all dashboard-v2 messages sorted by timestamp
    const hist = messages
        .filter(m => m.chatId === 'dashboard-v2')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json(hist);
});

// Atomic poll and consume
app.get('/consume', async (req: Request, res: Response) => {
    const { target } = req.query;
    const t = (target as string) || 'julia';
    updateHeartbeat(t === 'julia' ? 'julia' : 'openclaw');

    const statusMatch = (t === 'julia' ? 'pending' : 'replied');

    const available = messages.filter(m => m.status === statusMatch);

    if (t === 'julia') {
        available.forEach(m => { m.status = 'processing'; });
        if (available.length > 0) await saveQueue();
    }

    res.json({ messages: available });
});

// MCP over Streamable HTTP — Julia connects here
// Stateless mode: new transport per request
const mcpHandler = async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        onsessioninitialized: undefined,
    });

    res.on('close', () => { transport.close(); });

    const server = new McpServer({ name: 'julia-bridge', version: '1.0.0' });

    // --- Aliases for server.js Compatibility ---
    server.tool('telegram_receive', 'Fetch queued messages from the bridge. Messages are consumed (marked as delivered) by default.',
        { correlationId: z.string().optional(), timeout: z.number().optional(), target: z.enum(['julia', 'openclaw']).optional(), consume: z.boolean().optional().describe('Mark messages as consumed after reading (default: true)') },
        async ({ correlationId, target, consume }) => {
            const t = target ?? 'openclaw';
            const shouldConsume = consume ?? true;
            updateHeartbeat(t === 'julia' ? 'julia' : 'openclaw');
            const available = messages.filter((m) => {
                const statusMatch = (t === 'julia' ? m.status === 'pending' : m.status === 'replied');
                if (!statusMatch) return false;
                if (correlationId && m.chatId !== correlationId) return false;
                return true;
            });
            if (shouldConsume && available.length > 0) {
                available.forEach(m => { m.status = 'consumed'; });
                await saveQueue();
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify({ messages: available }) }] };
        });

    server.tool('telegram_send', 'Enqueue a message for Julia/OpenClaw.',
        { correlationId: z.string(), text: z.string(), target: z.enum(['julia', 'openclaw']).optional() },
        async ({ correlationId, text, target }) => {
            const t = target ?? 'julia';
            updateHeartbeat(t === 'julia' ? 'openclaw' : 'julia'); // sender is the other peer
            if (t === 'julia') {
                messages.push({
                    id: `msg-${randomUUID()}`, chatId: correlationId, userId: '', username: 'mcp-tool', text, timestamp: new Date().toISOString(), status: 'pending'
                });
            } else {
                messages.push({
                    id: `reply-${randomUUID()}`, chatId: correlationId, userId: '', username: 'mcp-tool', text: '', timestamp: new Date().toISOString(), status: 'replied', reply: text
                });
            }
            await saveQueue();
            return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, correlationId }) }] };
        });

    server.tool('bridge_health', 'Report bridge + peer reachability.', {},
        async () => {
            updateHeartbeat('openclaw'); // Assume MCP queries come from OpenClaw (or user)
            const now = Date.now();
            const juliaAlive = heartbeats.julia ? (now - heartbeats.julia < 30000) : false;
            const openclawAlive = heartbeats.openclaw ? (now - heartbeats.openclaw < 30000) : false;

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        status: 'ok',
                        bridge: true,
                        julia: juliaAlive,
                        openclaw: openclawAlive,
                        heartbeats: {
                            julia: heartbeats.julia ? new Date(heartbeats.julia).toISOString() : null,
                            openclaw: heartbeats.openclaw ? new Date(heartbeats.openclaw).toISOString() : null
                        },
                        queue: {
                            julia: messages.filter(m => m.status === 'pending').length,
                            openclaw: messages.filter(m => m.status === 'replied').length
                        }
                    }, null, 2)
                }]
            };
        });

    // --- Original Tools ---
    server.tool('telegram_get_pending_messages', 'Get pending Telegram messages waiting for Julia.', {},
        async () => {
            const pending = messages.filter((m) => m.status === 'pending');
            pending.forEach((m) => { m.status = 'processing'; });
            await saveQueue();
            return { content: [{ type: 'text' as const, text: pending.length === 0 ? 'No pending messages.' : JSON.stringify(pending, null, 2) }] };
        });

    server.tool('telegram_send_reply', 'Send a reply via OpenClaw to Telegram.',
        { chatId: z.string(), text: z.string(), messageId: z.string().optional() },
        async ({ chatId, text, messageId }) => {
            const msg = messages.find((m) => m.chatId === chatId && (m.status === 'processing' || m.id === messageId));
            if (msg) { msg.status = 'replied'; msg.reply = text; }
            else { messages.push({ id: `reply-${randomUUID()}`, chatId, userId: '', username: '', text: '', timestamp: new Date().toISOString(), status: 'replied', reply: text }); }
            await saveQueue();
            return { content: [{ type: 'text' as const, text: `✅ Reply queued for ${chatId}` }] };
        });

    server.tool('telegram_bridge_status', 'Status of the bridge.', {},
        async () => ({ content: [{ type: 'text' as const, text: JSON.stringify({ bridge: 'online', pending: messages.filter(m => m.status === 'pending').length, processing: messages.filter(m => m.status === 'processing').length, replied: messages.filter(m => m.status === 'replied').length }) }] }));

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
};

app.all('/mcp', mcpHandler);

// Root MCP for compatibility
app.all('/', mcpHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

await loadQueue();

app.listen(PORT, () => {
    log(`Bridge running on http://localhost:${PORT}`);
    log(`  MCP endpoint:   http://localhost:${PORT}/mcp`);
    log(`  POST /incoming  ← OpenClaw sends Telegram messages here`);
    log(`  GET  /pending-reply/:chatId ← OpenClaw polls for replies`);
});
