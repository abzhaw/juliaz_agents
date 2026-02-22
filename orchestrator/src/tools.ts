/**
 * Tool definitions and executor for Julia's function-calling capabilities.
 *
 * TOOLS is passed verbatim to the OpenAI API as `tools`.
 * executeTool() is called by the tool-use loop in openai.ts when OpenAI
 * requests a function call. It never throws — errors become result strings
 * so OpenAI can relay them to the user naturally.
 */

import { spawnSync } from 'child_process';
import { join } from 'path';
import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';

// ─── Paths ────────────────────────────────────────────────────────────────────

const EMAIL_SKILL_DIR = '/Users/raphael/Documents/Devs/juliaz_agents/openclaw/skills/email-aberer';
const EMAIL_SCRIPT    = join(EMAIL_SKILL_DIR, 'scripts/email_send.py');
const EMAIL_ENV_FILE  = join(EMAIL_SKILL_DIR, 'env-smtp.env');

// ─── Tool Schema ─────────────────────────────────────────────────────────────

export const TOOLS: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'send_email',
            description: [
                'Send an email from raphael@aberer.ch via SMTP.',
                'Use this when the user asks Julia to send, write, or draft-and-send an email.',
                'If the recipient, subject, and body are all clear from context, call this immediately.',
                'If any detail is missing, ask one concise question first.',
            ].join(' '),
            parameters: {
                type: 'object',
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
                additionalProperties: false,
            },
        },
    },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendEmailArgs {
    to: string;
    subject: string;
    body: string;
    cc?: string;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

/**
 * Dispatch a tool call by name. Returns a plain string result (success or error)
 * that OpenAI incorporates into its next reply.
 */
export async function executeTool(name: string, rawArgs: string): Promise<string> {
    try {
        const args = JSON.parse(rawArgs);
        switch (name) {
            case 'send_email':
                return await sendEmail(args as SendEmailArgs);
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
        env: { ...process.env }, // inherit PATH so `op` and `python3` are found
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
