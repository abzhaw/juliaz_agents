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
    status: 'pending' | 'processing' | 'replied';
    reply?: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

let messages: TelegramMessage[] = [];

async function loadQueue(): Promise<void> {
    try {
        const raw = await fs.readFile(QUEUE_FILE, 'utf8');
        messages = JSON.parse(raw) as TelegramMessage[];
        log(`Loaded ${messages.length} messages from queue`);
    } catch {
        messages = [];
    }
}

async function saveQueue(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(QUEUE_FILE, JSON.stringify(messages, null, 2));
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
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, bridge: 'julia-openclaw', version: '1.0.0' });
});

// OpenClaw → POST incoming Telegram message
app.post('/incoming', async (req: Request, res: Response) => {
    const { chatId, userId, username, text } = req.body as Record<string, unknown>;
    if (!chatId || !text) { res.status(400).json({ error: 'chatId and text required' }); return; }
    const message: TelegramMessage = {
        id: `msg-${randomUUID()}`,
        chatId: String(chatId), userId: String(userId ?? ''),
        username: String(username ?? 'unknown'), text: String(text),
        timestamp: new Date().toISOString(), status: 'pending',
    };
    messages.push(message);
    await saveQueue();
    log(`Incoming from ${message.username} (${message.chatId}): "${message.text.slice(0, 60)}"`);
    res.json({ ok: true, messageId: message.id });
});

// OpenClaw → GET Julia's reply
app.get('/pending-reply/:chatId', async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const replied = messages.filter((m) => m.chatId === chatId && m.status === 'replied' && m.reply);
    if (replied.length === 0) { res.json({ reply: null }); return; }
    const latest = replied[replied.length - 1]!;
    messages = messages.filter((m) => m.id !== latest.id);
    await saveQueue();
    log(`Reply consumed for ${chatId}: "${(latest.reply ?? '').slice(0, 60)}"`);
    res.json({ reply: latest.reply });
});

// Orchestrator → POST a reply for a chatId (direct REST, no MCP needed)
app.post('/reply', async (req: Request, res: Response) => {
    const { chatId, text, messageId } = req.body as Record<string, unknown>;
    if (!chatId || !text) { res.status(400).json({ error: 'chatId and text required' }); return; }
    const msg = messages.find(
        (m) => m.chatId === String(chatId) && (m.status === 'pending' || m.status === 'processing') && (!messageId || m.id === String(messageId)),
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
    await saveQueue();
    log(`[REST] Reply stored for ${String(chatId)}: "${String(text).slice(0, 60)}"`);
    res.json({ ok: true });
});

// Debug — all messages
app.get('/messages', (_req: Request, res: Response) => { res.json(messages); });

// MCP over Streamable HTTP — Julia connects here
// Stateless mode: new transport per request
app.all('/mcp', async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        onsessioninitialized: undefined,
    });

    res.on('close', () => { transport.close(); });

    const server = new McpServer({ name: 'julia-openclaw-bridge', version: '1.0.0' });

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
});

// ─── Start ────────────────────────────────────────────────────────────────────

await loadQueue();

app.listen(PORT, () => {
    log(`Bridge running on http://localhost:${PORT}`);
    log(`  MCP endpoint:   http://localhost:${PORT}/mcp`);
    log(`  POST /incoming  ← OpenClaw sends Telegram messages here`);
    log(`  GET  /pending-reply/:chatId ← OpenClaw polls for replies`);
});
