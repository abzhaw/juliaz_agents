/**
 * Julia-OpenClaw MCP Bridge Server
 *
 * Architecture:
 *   - MCP server over stdio → Julia (Antigravity) connects as a tool source
 *   - HTTP server on port 3001 → OpenClaw POSTs incoming Telegram messages here
 *
 * Flow:
 *   User → Telegram → OpenClaw → POST /incoming → queue
 *   Julia → MCP tool telegram_get_pending_messages → processes
 *   Julia → MCP tool telegram_send_reply → stored reply
 *   OpenClaw → GET /pending-reply/:chatId → sends via Telegram → User
 */

import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

// ─── Queue (in-memory + file persistence) ────────────────────────────────────

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

// ─── Logging (stderr so stdout stays clean for MCP) ──────────────────────────

function log(msg: string): void {
    process.stderr.write(`[bridge] ${msg}\n`);
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const mcp = new McpServer({
    name: 'julia-openclaw-bridge',
    version: '1.0.0',
});

mcp.tool(
    'telegram_get_pending_messages',
    'Get all pending Telegram messages that are waiting for Julia to respond to. Returns an array of messages with chatId, userId, username, text, and timestamp.',
    {},
    async () => {
        const pending = messages.filter((m) => m.status === 'pending');
        pending.forEach((m) => {
            m.status = 'processing';
        });
        await saveQueue();

        if (pending.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No pending Telegram messages.' }] };
        }
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `${pending.length} pending message(s):\n\n${JSON.stringify(pending, null, 2)}`,
                },
            ],
        };
    },
);

mcp.tool(
    'telegram_send_reply',
    'Send a reply to a Telegram user via OpenClaw. OpenClaw will pick up this reply and send it to the user on Telegram.',
    {
        chatId: z.string().describe('Telegram chat ID to reply to (from the pending message)'),
        text: z.string().describe('The reply text to send to the user'),
        messageId: z.string().optional().describe('The original message ID (optional, for tracking)'),
    },
    async ({ chatId, text, messageId }) => {
        const msg = messages.find(
            (m) => m.chatId === chatId && (m.status === 'processing' || m.id === messageId),
        );

        if (msg) {
            msg.status = 'replied';
            msg.reply = text;
        } else {
            // Standalone reply (e.g., Julia initiating a message)
            messages.push({
                id: `reply-${randomUUID()}`,
                chatId,
                userId: '',
                username: '',
                text: '',
                timestamp: new Date().toISOString(),
                status: 'replied',
                reply: text,
            });
        }

        await saveQueue();
        log(`Reply queued for chat ${chatId}: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);
        return { content: [{ type: 'text' as const, text: `✅ Reply queued for chat ${chatId}` }] };
    },
);

mcp.tool(
    'telegram_bridge_status',
    'Check the status of the Julia-OpenClaw bridge — how many messages are pending, processing, or replied.',
    {},
    async () => {
        const pending = messages.filter((m) => m.status === 'pending').length;
        const processing = messages.filter((m) => m.status === 'processing').length;
        const replied = messages.filter((m) => m.status === 'replied').length;
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({ bridge: 'online', pending, processing, replied, total: messages.length }, null, 2),
                },
            ],
        };
    },
);

// ─── HTTP Server (for OpenClaw to POST and poll) ──────────────────────────────

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, bridge: 'julia-openclaw', version: '1.0.0' });
});

// OpenClaw → POST incoming Telegram message
app.post('/incoming', async (req: Request, res: Response) => {
    const { chatId, userId, username, text } = req.body as {
        chatId?: unknown;
        userId?: unknown;
        username?: unknown;
        text?: unknown;
    };

    if (!chatId || !text) {
        res.status(400).json({ error: 'chatId and text are required' });
        return;
    }

    const message: TelegramMessage = {
        id: `msg-${randomUUID()}`,
        chatId: String(chatId),
        userId: String(userId ?? ''),
        username: String(username ?? 'unknown'),
        text: String(text),
        timestamp: new Date().toISOString(),
        status: 'pending',
    };

    messages.push(message);
    await saveQueue();
    log(`Incoming from ${message.username} (${message.chatId}): "${message.text.slice(0, 60)}"`);
    res.json({ ok: true, messageId: message.id });
});

// OpenClaw → GET Julia's reply for a chatId
app.get('/pending-reply/:chatId', async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const replied = messages.filter((m) => m.chatId === chatId && m.status === 'replied' && m.reply);

    if (replied.length === 0) {
        res.json({ reply: null });
        return;
    }

    const latest = replied[replied.length - 1]!;
    // Consume the reply
    messages = messages.filter((m) => m.id !== latest.id);
    await saveQueue();
    log(`Reply consumed for chat ${chatId}: "${(latest.reply ?? '').slice(0, 60)}"`);
    res.json({ reply: latest.reply });
});

// All messages (for debugging)
app.get('/messages', (_req: Request, res: Response) => {
    res.json(messages);
});

// ─── Start ────────────────────────────────────────────────────────────────────

await loadQueue();

// Start HTTP server
app.listen(PORT, () => {
    log(`HTTP server running on http://localhost:${PORT}`);
    log(`  POST /incoming      ← OpenClaw sends Telegram messages here`);
    log(`  GET  /pending-reply/:chatId ← OpenClaw polls for Julia's replies`);
    log(`  GET  /health        ← health check`);
});

// Start MCP server (stdio)
const transport = new StdioServerTransport();
await mcp.connect(transport);
log('MCP server connected via stdio — Julia can now use Telegram tools');
