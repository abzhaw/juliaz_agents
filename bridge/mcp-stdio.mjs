#!/usr/bin/env node
/**
 * Julia Bridge — Stdio MCP Proxy
 *
 * This script exposes the bridge's functionality as an MCP server over stdio.
 * Claude Code launches it as a child process (via .mcp.json), so the connection
 * is always fresh and never depends on the bridge's HTTP endpoint being up at
 * Claude Code startup time.
 *
 * Tools:
 *   talk_to_julia(text, chatId?)   → POST /incoming
 *   get_julia_reply(chatId?)       → GET /pending-reply/:chatId
 *   bridge_status()                → GET /health
 *
 * Usage (from .mcp.json):
 *   {
 *     "mcpServers": {
 *       "julia-bridge": {
 *         "command": "node",
 *         "args": ["bridge/mcp-stdio.mjs"]
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:3001';

const server = new McpServer({
    name: 'julia-bridge-stdio',
    version: '1.0.0',
});

// ─── Tool: talk_to_julia ──────────────────────────────────────────────────────

server.tool(
    'talk_to_julia',
    'Send a message to Julia (the AI agent). Julia will process it and generate a reply. ' +
    'After sending, wait a few seconds and then call get_julia_reply to retrieve her response.',
    {
        text: z.string().describe('The message to send to Julia'),
        chatId: z.string().optional().default('claude-code')
            .describe('Chat session identifier (default: claude-code)'),
        username: z.string().optional().default('Claude')
            .describe('Sender name shown to Julia (default: Claude)'),
    },
    async ({ text, chatId, username }) => {
        try {
            const res = await fetch(`${BRIDGE_URL}/incoming`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, text, username, userId: 'claude-code-agent' }),
            });
            if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
            const data = await res.json();
            return {
                content: [{
                    type: 'text',
                    text: `Message sent to Julia.\n` +
                          `Message ID: ${data.messageId}\n` +
                          `Chat ID: ${chatId}\n\n` +
                          `Julia is processing your message. Call get_julia_reply("${chatId}") in a few seconds.`,
                }],
            };
        } catch (err) {
            return {
                content: [{ type: 'text', text: `Error sending to Julia: ${err.message}` }],
                isError: true,
            };
        }
    },
);

// ─── Tool: get_julia_reply ────────────────────────────────────────────────────

server.tool(
    'get_julia_reply',
    'Get Julia\'s latest reply for a given chat session. ' +
    'Returns null if Julia hasn\'t replied yet — wait and try again.',
    {
        chatId: z.string().optional().default('claude-code')
            .describe('Chat session identifier (must match what was used in talk_to_julia)'),
    },
    async ({ chatId }) => {
        try {
            const res = await fetch(`${BRIDGE_URL}/pending-reply/${chatId}`);
            if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
            const data = await res.json();
            if (data.reply === null) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Julia has not replied yet. Wait a few seconds and try again.',
                    }],
                };
            }
            return {
                content: [{
                    type: 'text',
                    text: `Julia says:\n\n${data.reply}`,
                }],
            };
        } catch (err) {
            return {
                content: [{ type: 'text', text: `Error fetching reply: ${err.message}` }],
                isError: true,
            };
        }
    },
);

// ─── Tool: bridge_status ──────────────────────────────────────────────────────

server.tool(
    'bridge_status',
    'Check the health of the Julia bridge and see current message queue counts. ' +
    'Shows when Julia (orchestrator) and OpenClaw (Telegram gateway) last connected.',
    {},
    async () => {
        try {
            const res = await fetch(`${BRIDGE_URL}/health`);
            if (!res.ok) throw new Error(`Bridge returned ${res.status}: is the bridge running on ${BRIDGE_URL}?`);
            const data = await res.json();

            const juliaAlive = data.heartbeats?.julia
                ? `last seen ${new Date(data.heartbeats.julia).toLocaleTimeString()}`
                : 'never connected';
            const openclawAlive = data.heartbeats?.openclaw
                ? `last seen ${new Date(data.heartbeats.openclaw).toLocaleTimeString()}`
                : 'never connected';

            return {
                content: [{
                    type: 'text',
                    text: [
                        '=== Julia Bridge Status ===',
                        `Bridge:   ${data.ok ? '✅ online' : '❌ offline'}`,
                        `Julia:    ${juliaAlive}`,
                        `OpenClaw: ${openclawAlive}`,
                        '',
                        '=== Message Queue ===',
                        `Pending:    ${data.counts?.pending ?? 0}  (waiting for Julia)`,
                        `Processing: ${data.counts?.processing ?? 0} (Julia is replying)`,
                        `Replied:    ${data.counts?.replied ?? 0}  (ready for pickup)`,
                    ].join('\n'),
                }],
            };
        } catch (err) {
            return {
                content: [{
                    type: 'text',
                    text: `Bridge unreachable: ${err.message}\n` +
                          `Make sure the bridge is running: cd bridge && npm run dev`,
                }],
                isError: true,
            };
        }
    },
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
