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
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';

// ─── Task Manager Paths ─────────────────────────────────────────────────────

const PROJECT_DIR = process.env.PROJECT_DIR ?? '/Users/raphael/Documents/Devs/juliaz_agents';
const TODO_DIR = join(PROJECT_DIR, 'todo');

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
    {
        name: 'manage_tasks',
        description: [
            'Manage the shared TODO task queue for juliaz_agents.',
            'Actions: "list" (show open tasks), "get" (read a specific task),',
            '"create" (add a new task), "update" (change status/priority/notes),',
            '"next" (suggest highest-priority task to work on).',
            'Use when Raphael asks about tasks, says /tasks, asks "what should I work on",',
            '"create a task for X", "mark TASK-001 done", "what\'s open", or anything task-related.',
        ].join(' '),
        input_schema: {
            type: 'object' as const,
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'get', 'create', 'update', 'next'],
                    description: 'The action to perform on the task queue.',
                },
                task_id: {
                    type: 'string',
                    description: 'Task ID (e.g., "TASK-001"). Required for "get" and "update".',
                },
                title: {
                    type: 'string',
                    description: 'Task title. Required for "create".',
                },
                description: {
                    type: 'string',
                    description: 'Task description. Used with "create".',
                },
                status: {
                    type: 'string',
                    enum: ['open', 'in_progress', 'blocked', 'done', 'cancelled'],
                    description: 'New status. Used with "update".',
                },
                priority: {
                    type: 'string',
                    enum: ['critical', 'high', 'medium', 'low'],
                    description: 'Priority level. Used with "create" or "update".',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Tags for the task. Used with "create".',
                },
                note: {
                    type: 'string',
                    description: 'Note to append. Used with "update".',
                },
                assigned_to: {
                    type: 'string',
                    description: 'Who the task is assigned to. Used with "create" or "update".',
                },
            },
            required: ['action'],
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

interface ManageTasksArgs {
    action: 'list' | 'get' | 'create' | 'update' | 'next';
    task_id?: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    tags?: string[];
    note?: string;
    assigned_to?: string;
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
            case 'manage_tasks':
                return manageTasks(args as ManageTasksArgs);
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

// ─── Task Manager Implementation ─────────────────────────────────────────────

function readYamlSimple(filepath: string): Record<string, any> {
    // Simple YAML parser for our task format — handles key: value, arrays, multiline |
    const content = readFileSync(filepath, 'utf8');
    const result: Record<string, any> = {};
    let currentKey = '';
    let multilineMode = false;
    let multilineValue = '';

    for (const line of content.split('\n')) {
        if (multilineMode) {
            if (line.startsWith('  ') || line.trim() === '') {
                multilineValue += (multilineValue ? '\n' : '') + line.replace(/^  /, '');
                continue;
            } else {
                result[currentKey] = multilineValue.trim();
                multilineMode = false;
            }
        }

        const match = line.match(/^(\w[\w_]*)\s*:\s*(.*)/);
        if (match) {
            const [, key, value] = match;
            currentKey = key;
            const trimmed = value.trim();

            if (trimmed === '|') {
                multilineMode = true;
                multilineValue = '';
            } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                // Inline array: [tag1, tag2]
                result[key] = trimmed.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
            } else if (trimmed === 'null' || trimmed === '') {
                result[key] = null;
            } else {
                result[key] = trimmed.replace(/^["']|["']$/g, '');
            }
        }
    }

    if (multilineMode) {
        result[currentKey] = multilineValue.trim();
    }

    return result;
}

function writeTaskYaml(filepath: string, task: Record<string, any>): void {
    const lines: string[] = [];
    const fields = ['id', 'title', 'status', 'priority', 'created', 'updated',
                     'created_by', 'assigned_to', 'tags', 'depends_on', 'due',
                     'description', 'plan', 'notes'];

    for (const key of fields) {
        const val = task[key];
        if (val === undefined) continue;

        if (val === null) {
            lines.push(`${key}: null`);
        } else if (Array.isArray(val)) {
            lines.push(`${key}: [${val.join(', ')}]`);
        } else if (typeof val === 'string' && val.includes('\n')) {
            lines.push(`${key}: |`);
            for (const l of val.split('\n')) {
                lines.push(`  ${l}`);
            }
        } else {
            lines.push(`${key}: "${String(val)}"`);
        }
    }

    writeFileSync(filepath, lines.join('\n') + '\n', 'utf8');
}

function getTaskFiles(): string[] {
    if (!existsSync(TODO_DIR)) return [];
    return readdirSync(TODO_DIR).filter(f => f.match(/^TASK-\d+\.yml$/)).sort();
}

function readIndex(): Record<string, any> {
    const indexPath = join(TODO_DIR, 'index.yml');
    if (!existsSync(indexPath)) return { next_id: 1, summary: { open: 0, in_progress: 0, blocked: 0, done: 0, total: 0 }, tasks: [] };
    return readYamlSimple(indexPath);
}

function updateIndex(tasks: Record<string, any>[]): void {
    const counts = { open: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0 };
    for (const t of tasks) {
        const s = t.status as keyof typeof counts;
        if (s in counts) counts[s]++;
    }

    const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
    const nextId = tasks.length > 0
        ? Math.max(...tasks.map(t => parseInt(String(t.id).replace('TASK-', ''), 10))) + 1
        : 1;

    const lines = [
        '# TODO Index — juliaz_agents',
        '# Auto-maintained by task-manager.',
        '',
        `next_id: ${nextId}`,
        '',
        'summary:',
        `  open: ${counts.open}`,
        `  in_progress: ${counts.in_progress}`,
        `  blocked: ${counts.blocked}`,
        `  done: ${counts.done}`,
        `  total: ${tasks.length}`,
        '',
        'tasks:',
    ];

    for (const t of activeTasks) {
        lines.push(`  - id: ${t.id}`);
        lines.push(`    title: "${t.title}"`);
        lines.push(`    status: ${t.status}`);
        lines.push(`    priority: ${t.priority}`);
        lines.push(`    assigned_to: ${t.assigned_to || 'system'}`);
    }

    writeFileSync(join(TODO_DIR, 'index.yml'), lines.join('\n') + '\n', 'utf8');
}

function manageTasks(args: ManageTasksArgs): string {
    console.log(`[tools] manage_tasks → action=${args.action}`);

    try {
        switch (args.action) {
            case 'list': {
                const files = getTaskFiles();
                if (files.length === 0) return 'No tasks found. The TODO queue is empty.';

                const tasks = files.map(f => readYamlSimple(join(TODO_DIR, f)));
                const open = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');

                if (open.length === 0) return 'All tasks are done or cancelled. Queue is clear!';

                const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                open.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

                const emoji: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
                const lines = [`📋 Tasks: ${open.length} active\n`];
                for (const t of open) {
                    const e = emoji[t.priority] ?? '⚪';
                    const status = t.status === 'in_progress' ? ' [IN PROGRESS]' : t.status === 'blocked' ? ' [BLOCKED]' : '';
                    lines.push(`${e} ${t.id} [${t.priority}] ${t.title}${status}`);
                }
                return lines.join('\n');
            }

            case 'get': {
                if (!args.task_id) return 'Error: task_id is required for "get" action.';
                const filepath = join(TODO_DIR, `${args.task_id}.yml`);
                if (!existsSync(filepath)) return `Error: ${args.task_id} not found.`;
                return readFileSync(filepath, 'utf8');
            }

            case 'create': {
                if (!args.title) return 'Error: title is required for "create" action.';

                const allTasks = getTaskFiles().map(f => readYamlSimple(join(TODO_DIR, f)));
                const nextNum = allTasks.length > 0
                    ? Math.max(...allTasks.map(t => parseInt(String(t.id).replace('TASK-', ''), 10))) + 1
                    : 1;
                const id = `TASK-${String(nextNum).padStart(3, '0')}`;
                const today = new Date().toISOString().split('T')[0];

                const task: Record<string, any> = {
                    id,
                    title: args.title,
                    status: 'open',
                    priority: args.priority ?? 'medium',
                    created: today,
                    updated: today,
                    created_by: 'julia',
                    assigned_to: args.assigned_to ?? 'system',
                    tags: args.tags ?? [],
                    depends_on: [],
                    due: null,
                    description: args.description ?? args.title,
                    plan: null,
                    notes: `[${today}] Task created.`,
                };

                writeTaskYaml(join(TODO_DIR, `${id}.yml`), task);

                // Update index
                allTasks.push(task);
                updateIndex(allTasks);

                console.log(`[tools] manage_tasks → created ${id}: "${args.title}"`);
                return `📋 Created ${id}: "${args.title}" [${task.priority}]`;
            }

            case 'update': {
                if (!args.task_id) return 'Error: task_id is required for "update" action.';
                const filepath = join(TODO_DIR, `${args.task_id}.yml`);
                if (!existsSync(filepath)) return `Error: ${args.task_id} not found.`;

                const task = readYamlSimple(filepath);
                const today = new Date().toISOString().split('T')[0];
                const changes: string[] = [];

                if (args.status && args.status !== task.status) {
                    changes.push(`status: ${task.status} → ${args.status}`);
                    task.status = args.status;
                }
                if (args.priority && args.priority !== task.priority) {
                    changes.push(`priority: ${task.priority} → ${args.priority}`);
                    task.priority = args.priority;
                }
                if (args.assigned_to && args.assigned_to !== task.assigned_to) {
                    changes.push(`assigned: ${task.assigned_to} → ${args.assigned_to}`);
                    task.assigned_to = args.assigned_to;
                }
                if (args.note) {
                    const existingNotes = task.notes ?? '';
                    task.notes = `[${today}] ${args.note}\n${existingNotes}`;
                    changes.push('note added');
                }

                if (changes.length === 0) return `No changes made to ${args.task_id}.`;

                task.updated = today;
                writeTaskYaml(filepath, task);

                // Update index
                const allTasks = getTaskFiles().map(f => readYamlSimple(join(TODO_DIR, f)));
                updateIndex(allTasks);

                console.log(`[tools] manage_tasks → updated ${args.task_id}: ${changes.join(', ')}`);
                return `📋 Updated ${args.task_id}: ${changes.join(', ')}`;
            }

            case 'next': {
                const files = getTaskFiles();
                const tasks = files.map(f => readYamlSimple(join(TODO_DIR, f)));
                const open = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');

                if (open.length === 0) return '📋 Nothing to do — all tasks are done or blocked!';

                // Score tasks
                const priorityScore: Record<string, number> = { critical: 100, high: 40, medium: 20, low: 10 };
                const scored: Array<{ task: Record<string, any>; score: number }> = open.map(t => {
                    let score = priorityScore[t.priority] ?? 10;
                    // Age bonus
                    const created = new Date(t.created);
                    const days = Math.floor((Date.now() - created.getTime()) / 86400000);
                    score += Math.min(days, 30);
                    // In-progress tasks get a small boost (continue what you started)
                    if (t.status === 'in_progress') score += 15;
                    return { task: t, score };
                });

                scored.sort((a, b) => b.score - a.score);
                const top = scored[0].task;
                const topScore = scored[0].score;

                return `📋 Next up: ${top.id} — ${top.title} [${top.priority}]\nReason: Score ${topScore} (priority + age + status). ${top.status === 'in_progress' ? 'Already in progress.' : 'Ready to start.'}`;
            }

            default:
                return `Error: unknown action "${args.action}". Use: list, get, create, update, next.`;
        }
    } catch (err: any) {
        return `Error in manage_tasks: ${err.message}`;
    }
}
