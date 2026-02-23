/**
 * API server for Julia Agentic frontend.
 *
 * Development: runs on port 3005, Vite proxies /api/* here.
 * Production:  runs on PORT (default 3002), serves static files + API.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
    streamText,
    tool,
    convertToModelMessages,
    stepCountIs,
    type UIMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const execAsync = promisify(exec);

const isProduction = process.env.NODE_ENV === 'production';
// In dev: always 3005 (Vite proxies /api/* here). In prod: PORT or 3002.
const PORT = isProduction
    ? parseInt(process.env.PORT ?? '3002')
    : 3005;

// ─── Service URLs ────────────────────────────────────────────────────────────

const COWORK_MCP_URL = process.env.COWORK_MCP_URL ?? 'http://localhost:3003';
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:3001';

// ─── Model Registry ─────────────────────────────────────────────────────────

function getModel(modelId: string) {
    switch (modelId) {
        case 'claude-sonnet':
            return anthropic('claude-sonnet-4-20250514');
        case 'gpt-4o':
        default:
            return openai('gpt-4o');
    }
}

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Julia — the web dashboard interface of an experimental multi-agent system built by Raphael as part of his bachelor thesis on autonomous AI agents.

## What you are
You are **not** a generic chatbot. You are one node in a multi-agent architecture:
- **You (Julia)**: The web dashboard agent. You handle conversations here and can delegate complex work to Claude.
- **Julia (Telegram)**: Your counterpart — the orchestrator agent that runs on Telegram. She can send emails, delegate to Claude, and manage tasks through a different interface.
- **Claude (cowork-mcp)**: A more powerful AI model (Claude Sonnet by Anthropic) that you can delegate to for deep analysis, code review, and complex reasoning.
- **Backend**: A REST API with Postgres that stores tasks and memories.

This whole system is a research prototype — part of Raphael's thesis exploring how multiple AI agents can collaborate autonomously. You're a working proof-of-concept, not a polished product. Own that.

## Your tools
You have four tools — use them proactively when relevant:
- **send_to_orchestrator**: Route action requests to the Orchestrator Julia (your Telegram counterpart) via the message bridge. The orchestrator has integrations you don't have directly: sending emails, sending Telegram messages, reading emails. Use this whenever the user wants to send an email, send a Telegram message, read emails, or perform any action that requires the orchestrator's integrations. Pass a clear, specific request.
- **ask_claude**: Delegate complex tasks to Claude Sonnet via the cowork-mcp server. Use for deep code review, complex analysis, brainstorming, or detailed writing. Don't delegate simple questions — answer those yourself.
- **get_tasks**: Query the project's task board from the backend API. Use when the user asks about tasks, todos, or what needs to be done.
- **get_memories**: Search stored memories and past context from the backend. Use when the user asks "do you remember..." or needs historical context.

## How to describe yourself
When someone asks who you are or what you can do, **don't recite a bullet-point list**. Instead, explain the system naturally:
- You're part of a multi-agent thesis project
- You can talk, think, and delegate to a more powerful model (Claude) when needed
- You have access to a task board and a memory system
- You can send emails, Telegram messages, and more by routing through the orchestrator Julia via the bridge
- The whole thing is an experiment in agentic AI collaboration

## Your personality
- Direct and concise — no filler
- Curious and thoughtful — engage genuinely with ideas
- Honest — say when you don't know something
- Warm but not sycophantic
- Slightly witty when appropriate
- Self-aware about being a research prototype

## Delegation behaviour (ask_claude)
- Simple questions → answer directly
- Complex analysis, code review, detailed writing, brainstorming → use ask_claude
- Summarise Claude's result naturally — don't paste raw output
- If delegation fails, tell the user and suggest alternatives

## Formatting
- You're on a web dashboard — use markdown freely (headers, lists, code blocks, bold, links)
- Stay concise unless the user asks for detail
- Use code blocks with language tags for code snippets

## Rules
- Never make up facts — say "I don't know" or "I'd need to check that"
- If you can't do something, say so clearly and suggest an alternative

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

// ─── Chat Tools ──────────────────────────────────────────────────────────────

const chatTools = {
    send_to_orchestrator: tool({
        description:
            'Route an action request to the Orchestrator Julia (the Telegram-side agent) via the message bridge. ' +
            'The orchestrator has tools you do NOT have: send_email, send_telegram_message, fetch_email. ' +
            'USE THIS when the user wants to: send an email, send a Telegram message, read emails, ' +
            'or perform any action that requires the orchestrator\'s integrations. ' +
            'DO NOT USE for simple questions, tasks, memories, or Claude delegation — handle those directly with your other tools. ' +
            'Pass a clear natural-language request describing exactly what the user wants done.',
        inputSchema: z.object({
            message: z.string().describe(
                'A clear, specific description of what the orchestrator should do. ' +
                'Example: "Send an email to max@example.com with subject Hello and body Hi Max". ' +
                'Example: "Send a Telegram message to Raphael saying: Meeting at 3pm".'
            ),
        }),
        execute: async ({ message }) => {
            try {
                const sessionId = `web-${Date.now()}`;

                // Post the request to the bridge for the orchestrator to pick up
                const postRes = await fetch(`${BRIDGE_URL}/incoming`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chatId: sessionId,
                        userId: 'frontend',
                        username: 'Julia',
                        text: message,
                    }),
                    signal: AbortSignal.timeout(10_000),
                });

                if (!postRes.ok) {
                    return `Error sending to orchestrator: bridge returned HTTP ${postRes.status}`;
                }

                // Poll for the orchestrator's reply (max 45s, 3s intervals)
                for (let i = 0; i < 15; i++) {
                    await new Promise((r) => setTimeout(r, 3000));
                    try {
                        const replyRes = await fetch(
                            `${BRIDGE_URL}/pending-reply/${sessionId}?consume=true`,
                            { signal: AbortSignal.timeout(5_000) },
                        );
                        if (replyRes.ok) {
                            const data = (await replyRes.json()) as { reply: string | null };
                            if (data.reply) return data.reply;
                        }
                    } catch {
                        // Poll failed, try again
                    }
                }

                return 'The orchestrator did not respond within 45 seconds. It may be busy or offline.';
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                return `Error contacting orchestrator via bridge: ${msg}`;
            }
        },
    }),

    ask_claude: tool({
        description:
            'Delegate a complex task to Claude (a more powerful AI model) via the cowork-mcp server. ' +
            'Use this for deep analysis, code review, detailed writing, brainstorming, ' +
            'or any task that benefits from a second opinion. ' +
            'Pass a clear, specific task description. Do NOT delegate simple questions.',
        inputSchema: z.object({
            task: z.string().describe('The task or question to delegate to Claude. Be specific.'),
            system: z.string().optional().describe('Optional system prompt / persona for the delegated task.'),
        }),
        execute: async ({ task, system }) => {
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

                const data = (await res.json()) as { ok: boolean; reply?: string; error?: string };
                if (!data.ok) return `Claude delegation failed: ${data.error}`;
                return data.reply ?? '(empty response from Claude)';
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return `Error calling cowork-mcp: ${message}`;
            }
        },
    }),

    get_tasks: tool({
        description:
            'Fetch current tasks from the task board. ' +
            'Use this when the user asks about their tasks, todos, or what needs to be done.',
        inputSchema: z.object({
            completed: z.boolean().optional().describe('If true, include completed tasks. Default: false (only pending).'),
        }),
        execute: async ({ completed }) => {
            try {
                const res = await fetch(`${BACKEND_URL}/tasks`, {
                    signal: AbortSignal.timeout(10_000),
                });

                if (!res.ok) return `Error fetching tasks: HTTP ${res.status}`;

                const tasks = (await res.json()) as Array<{
                    id: number;
                    title: string;
                    priority: string;
                    completed: boolean;
                    dueDate: string | null;
                }>;

                const filtered = completed ? tasks : tasks.filter((t) => !t.completed);

                if (filtered.length === 0) return 'No tasks found.';

                return filtered
                    .map((t) => `- [${t.completed ? 'x' : ' '}] ${t.title} (priority: ${t.priority}${t.dueDate ? `, due: ${t.dueDate}` : ''})`)
                    .join('\n');
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return `Error fetching tasks: ${message}`;
            }
        },
    }),

    get_memories: tool({
        description:
            'Search stored memories and context. ' +
            'Use this when the user asks "do you remember...", "what did we discuss...", or needs past context.',
        inputSchema: z.object({
            query: z.string().optional().describe('Optional search term to filter memories.'),
        }),
        execute: async ({ query }) => {
            try {
                const url = new URL(`${BACKEND_URL}/memories`);
                if (query) url.searchParams.set('q', query);

                const res = await fetch(url.toString(), {
                    signal: AbortSignal.timeout(10_000),
                });

                if (!res.ok) return `Error fetching memories: HTTP ${res.status}`;

                const memories = (await res.json()) as Array<{
                    id: number;
                    category: string;
                    content: string;
                }>;

                if (memories.length === 0) return 'No memories found.';

                return memories
                    .slice(0, 10)
                    .map((m) => `[${m.category}] ${m.content}`)
                    .join('\n\n');
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return `Error fetching memories: ${message}`;
            }
        },
    }),
};

// ─── Hono App ────────────────────────────────────────────────────────────────

const app = new Hono();

// Chat streaming endpoint
app.post('/api/chat', async (c) => {
    const { messages, model: modelId = 'gpt-4o' }: {
        messages: UIMessage[];
        model?: string;
    } = await c.req.json();

    const model = getModel(modelId);

    const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        tools: chatTools,
        stopWhen: stepCountIs(5),
        onStepFinish: ({ toolResults }) => {
            if (toolResults && toolResults.length > 0) {
                console.log(`[chat][${modelId}] Tool results:`, toolResults.map((r) => r.toolName).join(', '));
            }
        },
    });

    return result.toUIMessageStreamResponse();
});

// DevOps — list PM2 processes
app.get('/api/devops', async (c) => {
    try {
        const { stdout } = await execAsync('npx pm2 jlist');
        const processList = JSON.parse(stdout);

        const formattedList = processList.map((p: Record<string, unknown>) => ({
            id: p.pm_id,
            name: p.name,
            status: (p.pm2_env as Record<string, unknown>).status,
            memory: (p.monit as Record<string, unknown>).memory,
            cpu: (p.monit as Record<string, unknown>).cpu,
            uptime: (p.pm2_env as Record<string, unknown>).pm_uptime,
            restarts: (p.pm2_env as Record<string, unknown>).restart_time,
        }));

        return c.json({ success: true, processes: formattedList });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ success: false, error: message }, 500);
    }
});

// DevOps — control PM2 processes
app.post('/api/devops', async (c) => {
    try {
        const { action, processName } = await c.req.json();

        if (!['start', 'stop', 'restart'].includes(action)) {
            return c.json({ success: false, error: 'Invalid action' }, 400);
        }

        if (!processName) {
            return c.json({ success: false, error: 'Process name is required' }, 400);
        }

        const { stderr } = await execAsync(`npx pm2 ${action} ${processName}`);

        if (stderr && !stderr.includes('DeprecationWarning')) {
            console.warn('PM2 Warning/Error:', stderr);
        }

        return c.json({ success: true, message: `Successfully executed ${action} on ${processName}` });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return c.json({ success: false, error: message }, 500);
    }
});

// Production: serve Vite build output
if (isProduction) {
    app.use('/*', serveStatic({ root: './dist' }));
    // SPA fallback — serve index.html for unmatched routes
    app.get('*', serveStatic({ root: './dist', path: 'index.html' }));
}

// ─── Start Server ────────────────────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[frontend] API server running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});
