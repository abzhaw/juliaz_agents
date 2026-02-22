/**
 * Tool definitions and executor for Julia's function-calling capabilities.
 *
 * Exports:
 *   TOOLS          — Anthropic Tool[] format (used by claude.ts)
 *   OPENAI_TOOLS   — OpenAI ChatCompletionTool[] format (used by openai.ts fallback)
 *   executeTool()  — Model-agnostic dispatcher, called by both paths
 */

import { spawnSync } from 'child_process';
import { join } from 'path';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';

// ─── Paths ────────────────────────────────────────────────────────────────────

const EMAIL_SKILL_DIR = '/Users/raphael/Documents/Devs/juliaz_agents/openclaw/skills/email-aberer';
const EMAIL_SCRIPT    = join(EMAIL_SKILL_DIR, 'scripts/email_send.py');
const EMAIL_ENV_FILE  = join(EMAIL_SKILL_DIR, 'env-smtp.env');

const COWORK_MCP_URL = process.env.COWORK_MCP_URL ?? 'http://localhost:3003';
const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:3001';
const RAPHAEL_CHAT_ID = process.env.RAPHAEL_CHAT_ID ?? '';

const EMAIL_FETCH_SCRIPT = join(EMAIL_SKILL_DIR, 'scripts/email_fetch.py');

// ─── Anthropic Tool Definitions ───────────────────────────────────────────────

export const TOOLS: Tool[] = [
    {
        name: 'send_email',
        description: [
            'Send an email from raphael@aberer.ch via SMTP.',
            'Under the hood, this uses OpenClaw\'s email-aberer skill: 1Password CLI (op run) injects SMTP credentials, then a Python script sends the email.',
            'Use this when the user asks Julia to send, write, or draft-and-send an email.',
            'If the recipient, subject, and body are all clear from context, call this immediately.',
            'If any detail is missing, ask one concise question first.',
        ].join(' '),
        input_schema: {
            type: 'object' as const,
            properties: {
                to: {
                    type: 'string',
                    description: 'Recipient email address (or comma-separated list for multiple recipients).',
                },
                subject: {
                    type: 'string',
                    description: 'Email subject line.',
                },
                body: {
                    type: 'string',
                    description: 'Plain-text body of the email.',
                },
                cc: {
                    type: 'string',
                    description: 'Optional comma-separated CC addresses.',
                },
            },
            required: ['to', 'subject', 'body'],
        },
    },
    {
        name: 'ask_claude',
        description: [
            'Delegate a complex task to Claude Sonnet via the cowork-mcp server.',
            'Use this for deep analysis, code review, detailed writing, brainstorming,',
            'or any task that benefits from a more powerful model.',
            'Pass a clear, specific task description. Do NOT delegate simple questions —',
            'answer those directly.',
        ].join(' '),
        input_schema: {
            type: 'object' as const,
            properties: {
                task: {
                    type: 'string',
                    description: 'The task or question to delegate to Claude Sonnet. Be specific.',
                },
                system: {
                    type: 'string',
                    description: 'Optional system prompt / persona for the delegated task.',
                },
            },
            required: ['task'],
        },
    },
    {
        name: 'send_telegram_message',
        description: [
            'Send a proactive Telegram message to a specific user.',
            'Use this to INITIATE a message — not to reply to the current conversation.',
            'The message is delivered through the bridge queue, then OpenClaw sends it on Telegram.',
            'For Raphael, pass chatId "raphael" — it auto-resolves to his Telegram chat ID.',
            'For other users, pass their numeric Telegram chatId.',
        ].join(' '),
        input_schema: {
            type: 'object' as const,
            properties: {
                chatId: {
                    type: 'string',
                    description: 'Telegram chat ID of the recipient. Use "raphael" for Raphael (auto-resolved). Otherwise use the numeric Telegram chatId.',
                },
                text: {
                    type: 'string',
                    description: 'The message text to send on Telegram.',
                },
            },
            required: ['chatId', 'text'],
        },
    },
    {
        name: 'fetch_email',
        description: [
            'Fetch recent emails from the raphael@aberer.ch inbox.',
            'Returns subject, sender, date, and a snippet for each email.',
            'Use this when the user asks to check email, read inbox, or look for a specific email.',
        ].join(' '),
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of emails to fetch (default: 5, max: 20).',
                },
                unread: {
                    type: 'boolean',
                    description: 'If true, only fetch unread emails.',
                },
                search: {
                    type: 'string',
                    description: 'Optional search filter (e.g., "from:someone@example.com" or a keyword).',
                },
            },
            required: [],
        },
    },
];

// ─── OpenAI Tool Definitions (for GPT-4o fallback) ───────────────────────────

export const OPENAI_TOOLS: ChatCompletionTool[] = TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.input_schema,
    },
}));

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendEmailArgs {
    to: string;
    subject: string;
    body: string;
    cc?: string;
}

interface AskClaudeArgs {
    task: string;
    system?: string;
}

interface SendTelegramArgs {
    chatId: string;
    text: string;
}

interface FetchEmailArgs {
    limit?: number;
    unread?: boolean;
    search?: string;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a tool call by name. Returns a plain string result (success or error)
 * that the LLM incorporates into its next reply.
 */
export async function executeTool(name: string, rawArgs: string): Promise<string> {
    try {
        const args = JSON.parse(rawArgs);
        switch (name) {
            case 'send_email':
                return await sendEmail(args as SendEmailArgs);
            case 'ask_claude':
                return await askClaude(args as AskClaudeArgs);
            case 'send_telegram_message':
                return await sendTelegramMessage(args as SendTelegramArgs);
            case 'fetch_email':
                return await fetchEmail(args as FetchEmailArgs);
            default:
                return `Error: unknown tool "${name}"`;
        }
    } catch (err: any) {
        return `Error executing tool "${name}": ${err.message}`;
    }
}

// ─── Implementations ──────────────────────────────────────────────────────────

async function sendEmail({ to, subject, body, cc }: SendEmailArgs): Promise<string> {
    const args = [
        'run',
        `--env-file=${EMAIL_ENV_FILE}`,
        '--',
        'python3',
        EMAIL_SCRIPT,
        '--to', to,
        '--subject', subject,
        '--body', body,
        ...(cc ? ['--cc', cc] : []),
    ];

    console.log(`[tools] send_email → to=${to} subject="${subject}"`);

    const result = spawnSync('op', args, {
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env },
    });

    if (result.error) {
        return `Email failed — process error: ${result.error.message}`;
    }

    if (result.status !== 0) {
        const stderr = result.stderr?.trim() || '(no stderr)';
        return `Email failed (exit ${result.status}): ${stderr}`;
    }

    console.log(`[tools] send_email → sent successfully to ${to}`);
    return `Email sent successfully to ${to} with subject "${subject}".`;
}

async function askClaude({ task, system }: AskClaudeArgs): Promise<string> {
    console.log(`[tools] ask_claude → delegating task (${task.length} chars)`);

    try {
        const res = await fetch(`${COWORK_MCP_URL}/task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task, system }),
            signal: AbortSignal.timeout(60_000),
        });

        if (!res.ok) {
            const body = await res.text();
            return `Error from cowork-mcp: HTTP ${res.status} — ${body}`;
        }

        const data = await res.json() as { ok: boolean; reply?: string; error?: string };
        if (!data.ok) return `Claude delegation failed: ${data.error}`;

        console.log(`[tools] ask_claude → got response (${(data.reply ?? '').length} chars)`);
        return data.reply ?? '(empty response from Claude)';
    } catch (err: any) {
        return `Error calling cowork-mcp: ${err.message}`;
    }
}

async function sendTelegramMessage({ chatId, text }: SendTelegramArgs): Promise<string> {
    const targetChatId = chatId === 'raphael'
        ? (RAPHAEL_CHAT_ID || chatId)
        : chatId;

    console.log(`[tools] send_telegram_message → chatId=${targetChatId} text="${text.slice(0, 60)}"`);

    try {
        const res = await fetch(`${BRIDGE_URL}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: targetChatId, text }),
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
            return `Failed to send Telegram message: bridge returned HTTP ${res.status}`;
        }

        console.log(`[tools] send_telegram_message → queued for delivery to ${targetChatId}`);
        return `Telegram message queued for delivery to chat ${targetChatId}.`;
    } catch (err: any) {
        return `Error sending Telegram message: ${err.message}`;
    }
}

async function fetchEmail({ limit = 5, unread, search }: FetchEmailArgs): Promise<string> {
    const args = [
        'run',
        `--env-file=${EMAIL_ENV_FILE}`,
        '--',
        'python3',
        EMAIL_FETCH_SCRIPT,
        '--limit', String(Math.min(limit, 20)),
        ...(unread ? ['--unread'] : []),
        ...(search ? ['--search', search] : []),
    ];

    console.log(`[tools] fetch_email → limit=${limit} unread=${!!unread} search="${search ?? ''}"`);

    const result = spawnSync('op', args, {
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env },
    });

    if (result.error) {
        return `Email fetch failed — process error: ${result.error.message}`;
    }

    if (result.status !== 0) {
        const stderr = result.stderr?.trim() || '(no stderr)';
        return `Email fetch failed (exit ${result.status}): ${stderr}`;
    }

    const output = result.stdout?.trim();
    if (!output) return 'No emails found.';

    console.log(`[tools] fetch_email → got ${output.split('\n').length} lines`);
    return output;
}
