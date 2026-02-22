/**
 * Cowork MCP Server — Claude as a Multimodal Sub-Agent
 *
 * Exposes Claude (Anthropic API) as a set of MCP tools so Julia's orchestrator
 * and any other agent in the system can delegate tasks to Claude.
 *
 * Transport: Streamable HTTP on port 3003
 * MCP endpoint: http://localhost:3003/mcp
 * Health:       http://localhost:3003/health
 *
 * Tools:
 *   claude_task              — Send any text task to Claude, get a response
 *   claude_multimodal_task   — Send text + image(s) to Claude (base64 or URL)
 *   claude_code_review       — Ask Claude to review code with a specific lens
 *   claude_summarize         — Summarize a block of content
 *   claude_brainstorm        — Generate ideas or plans for a goal
 *   cowork_status            — Health check / capabilities
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { z } from 'zod';

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = Number(process.env.COWORK_MCP_PORT ?? 3003);
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6-20251101';
const MAX_TOKENS = 4096;
const CHARACTER_LIMIT = 25_000;
const SERVER_START_TIME = new Date().toISOString();

// ─── Anthropic Client ─────────────────────────────────────────────────────────

function getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error(
            'ANTHROPIC_API_KEY is not set. Add it to .env.secrets or environment.'
        );
    }
    return new Anthropic({ apiKey });
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function log(msg: string): void {
    console.log(`[cowork-mcp] ${new Date().toISOString()} — ${msg}`);
}

function truncate(text: string): string {
    if (text.length <= CHARACTER_LIMIT) return text;
    return text.slice(0, CHARACTER_LIMIT) + `\n\n[... truncated at ${CHARACTER_LIMIT} chars]`;
}

function handleError(error: unknown): string {
    if (error instanceof Anthropic.APIError) {
        if (error.status === 401) return 'Error: Invalid ANTHROPIC_API_KEY. Check your credentials.';
        if (error.status === 429) return 'Error: Rate limit exceeded. Please wait before retrying.';
        if (error.status === 529) return 'Error: Claude API is overloaded. Please retry shortly.';
        return `Error: Anthropic API error (${error.status}): ${error.message}`;
    }
    if (error instanceof Error) return `Error: ${error.message}`;
    return `Error: Unexpected failure — ${String(error)}`;
}

async function callClaude(
    messages: Anthropic.MessageParam[],
    system?: string,
    model: string = DEFAULT_MODEL
): Promise<string> {
    const client = getClient();
    const params: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: MAX_TOKENS,
        messages,
    };
    if (system) params.system = system;

    const response = await client.messages.create(params);

    const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

    log(`Tokens used — in: ${response.usage.input_tokens}, out: ${response.usage.output_tokens}`);
    return truncate(text);
}

// ─── MCP Server Factory ───────────────────────────────────────────────────────

function createMcpServer(): McpServer {
    const server = new McpServer({ name: 'cowork-mcp-server', version: '1.0.0' });

    // ── Tool: claude_task ──────────────────────────────────────────────────────
    server.registerTool(
        'claude_task',
        {
            title: 'Claude Task',
            description: `Send any text task or question to Claude (Anthropic) and receive a response.
Use this as a general-purpose delegation tool whenever you need Claude's reasoning, writing, analysis,
or knowledge capabilities.

Args:
  - task (string): The instruction or question for Claude. Be specific and detailed.
  - system (string, optional): A system-level persona or constraint (e.g. "You are a JSON formatter").
  - model (string, optional): Override the Claude model. Defaults to ${DEFAULT_MODEL}.

Returns:
  Claude's full text response.

Examples:
  - "Translate this paragraph to French: ..."
  - "Write a regex that matches ISO 8601 dates"
  - "Explain the difference between TCP and UDP"`,
            inputSchema: z.object({
                task: z.string().min(1).max(50_000).describe('The task or question to send to Claude'),
                system: z.string().max(5_000).optional().describe('Optional system prompt / persona'),
                model: z.string().optional().describe(`Claude model override (default: ${DEFAULT_MODEL})`),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        },
        async ({ task, system, model }) => {
            try {
                const reply = await callClaude(
                    [{ role: 'user', content: task }],
                    system,
                    model ?? DEFAULT_MODEL
                );
                return { content: [{ type: 'text' as const, text: reply }] };
            } catch (err) {
                return { content: [{ type: 'text' as const, text: handleError(err) }] };
            }
        }
    );

    // ── Tool: claude_multimodal_task ───────────────────────────────────────────
    server.registerTool(
        'claude_multimodal_task',
        {
            title: 'Claude Multimodal Task (Text + Images)',
            description: `Send a task to Claude that includes one or more images alongside text.
Supports base64-encoded image data or publicly accessible image URLs.

Args:
  - task (string): The question or instruction about the image(s).
  - images (array): List of images. Each image must have:
      - type: "base64" | "url"
      - data: base64 string (if type="base64") OR public URL (if type="url")
      - media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp" (required for base64)
  - system (string, optional): System prompt.
  - model (string, optional): Model override.

Returns:
  Claude's analysis or response to the visual content.

Examples:
  - Describe what's in a screenshot
  - Extract text from an image
  - Compare two diagrams`,
            inputSchema: z.object({
                task: z.string().min(1).max(50_000).describe('The question or instruction about the image(s)'),
                images: z.array(
                    z.union([
                        z.object({
                            type: z.literal('base64'),
                            data: z.string().describe('Base64-encoded image data (no data URI prefix)'),
                            media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
                                .describe('MIME type of the image'),
                        }),
                        z.object({
                            type: z.literal('url'),
                            data: z.string().url().describe('Publicly accessible image URL'),
                        }),
                    ])
                ).min(1).max(10).describe('Images to include'),
                system: z.string().max(5_000).optional(),
                model: z.string().optional(),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        },
        async ({ task, images, system, model }) => {
            try {
                const client = getClient();

                // Build the content array: images first, then the task text
                const content: Anthropic.ContentBlockParam[] = images.map((img): Anthropic.ImageBlockParam => {
                    if (img.type === 'base64') {
                        return {
                            type: 'image' as const,
                            source: {
                                type: 'base64' as const,
                                media_type: img.media_type,
                                data: img.data,
                            },
                        };
                    } else {
                        return {
                            type: 'image' as const,
                            source: {
                                type: 'url' as const,
                                url: img.data,
                            },
                        };
                    }
                });

                content.push({ type: 'text' as const, text: task });

                const params: Anthropic.MessageCreateParamsNonStreaming = {
                    model: model ?? DEFAULT_MODEL,
                    max_tokens: MAX_TOKENS,
                    messages: [{ role: 'user', content }],
                };
                if (system) params.system = system;

                const response = await client.messages.create(params);
                const reply = truncate(
                    response.content
                        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
                        .map((b) => b.text)
                        .join('\n')
                );

                log(`Multimodal — tokens in: ${response.usage.input_tokens}, out: ${response.usage.output_tokens}`);
                return { content: [{ type: 'text' as const, text: reply }] };
            } catch (err) {
                return { content: [{ type: 'text' as const, text: handleError(err) }] };
            }
        }
    );

    // ── Tool: claude_code_review ───────────────────────────────────────────────
    server.registerTool(
        'claude_code_review',
        {
            title: 'Claude Code Review',
            description: `Ask Claude to review a piece of code. Returns structured feedback.

Args:
  - code (string): The code to review.
  - language (string, optional): Programming language (e.g. "TypeScript", "Python"). Auto-detected if omitted.
  - focus (string, optional): Specific review focus. Options: "security", "performance", "readability",
      "correctness", "all" (default).
  - context (string, optional): Surrounding context about what the code does.

Returns:
  Markdown-formatted review with sections: Summary, Issues, Suggestions, Verdict.`,
            inputSchema: z.object({
                code: z.string().min(1).max(50_000).describe('The code to review'),
                language: z.string().max(50).optional().describe('Programming language (auto-detected if omitted)'),
                focus: z.enum(['security', 'performance', 'readability', 'correctness', 'all'])
                    .default('all').describe('Review focus area'),
                context: z.string().max(2_000).optional().describe('What this code does / surrounding context'),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async ({ code, language, focus, context }) => {
            try {
                const lang = language ? `${language} ` : '';
                const contextBlock = context ? `\n\nContext: ${context}` : '';
                const system = `You are an expert ${lang}code reviewer. Provide a structured review with these sections:
## Summary
## Issues (numbered list, with severity: 🔴 Critical / 🟡 Warning / 🟢 Minor)
## Suggestions
## Verdict (✅ Approve / ⚠️ Approve with changes / ❌ Request changes)
Be concise and actionable. Focus: ${focus}.`;

                const task = `Review this code:${contextBlock}\n\n\`\`\`${language ?? ''}\n${code}\n\`\`\``;
                const reply = await callClaude([{ role: 'user', content: task }], system);
                return { content: [{ type: 'text' as const, text: reply }] };
            } catch (err) {
                return { content: [{ type: 'text' as const, text: handleError(err) }] };
            }
        }
    );

    // ── Tool: claude_summarize ─────────────────────────────────────────────────
    server.registerTool(
        'claude_summarize',
        {
            title: 'Claude Summarize',
            description: `Ask Claude to produce a concise summary of any content: articles, docs, conversations, logs, etc.

Args:
  - content (string): The text to summarize.
  - format (string, optional): Output format — "bullets" | "paragraph" | "tldr" (default: "bullets").
  - max_words (number, optional): Target summary length in words (default: 150).
  - audience (string, optional): Intended reader, e.g. "technical team", "executive", "non-technical".

Returns:
  The summary in the requested format.`,
            inputSchema: z.object({
                content: z.string().min(10).max(100_000).describe('Content to summarize'),
                format: z.enum(['bullets', 'paragraph', 'tldr']).default('bullets').describe('Summary format'),
                max_words: z.number().int().min(20).max(1_000).default(150).describe('Target length in words'),
                audience: z.string().max(200).optional().describe('Intended audience (e.g. "technical team")'),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async ({ content, format, max_words, audience }) => {
            try {
                const audienceClause = audience ? ` for a ${audience}` : '';
                const formatInstruction =
                    format === 'bullets' ? 'Use a concise bulleted list.' :
                        format === 'tldr' ? 'Write a single TL;DR sentence of ≤ 30 words, then 2-3 bullets.' :
                            'Write a single, coherent paragraph.';

                const system = `You are a professional summarizer. Target ≈ ${max_words} words${audienceClause}. ${formatInstruction}`;
                const reply = await callClaude(
                    [{ role: 'user', content: `Summarize the following:\n\n${content}` }],
                    system
                );
                return { content: [{ type: 'text' as const, text: reply }] };
            } catch (err) {
                return { content: [{ type: 'text' as const, text: handleError(err) }] };
            }
        }
    );

    // ── Tool: claude_brainstorm ────────────────────────────────────────────────
    server.registerTool(
        'claude_brainstorm',
        {
            title: 'Claude Brainstorm',
            description: `Ask Claude to brainstorm ideas, approaches, or plans for a given goal.

Args:
  - goal (string): What you want to brainstorm about.
  - count (number, optional): Number of ideas to generate (default: 5, max: 20).
  - constraints (string, optional): Any constraints or requirements to consider.
  - output_type (string, optional): "ideas" | "steps" | "alternatives" (default: "ideas").

Returns:
  A numbered list of ideas or steps with brief explanations.`,
            inputSchema: z.object({
                goal: z.string().min(5).max(10_000).describe('The goal or problem to brainstorm'),
                count: z.number().int().min(1).max(20).default(5).describe('Number of ideas to generate'),
                constraints: z.string().max(2_000).optional().describe('Constraints or requirements'),
                output_type: z.enum(['ideas', 'steps', 'alternatives'])
                    .default('ideas').describe('Type of output to generate'),
            }),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        },
        async ({ goal, count, constraints, output_type }) => {
            try {
                const constraintClause = constraints ? `\n\nConstraints: ${constraints}` : '';
                const typeInstruction =
                    output_type === 'steps' ? `Generate ${count} concrete, actionable steps to achieve the goal.` :
                        output_type === 'alternatives' ? `Generate ${count} alternative approaches or solutions.` :
                            `Generate ${count} creative ideas related to the goal.`;

                const system = `You are a strategic thinker. ${typeInstruction} Format as a numbered list with a 1-2 sentence explanation for each.`;
                const task = `Goal: ${goal}${constraintClause}`;
                const reply = await callClaude([{ role: 'user', content: task }], system);
                return { content: [{ type: 'text' as const, text: reply }] };
            } catch (err) {
                return { content: [{ type: 'text' as const, text: handleError(err) }] };
            }
        }
    );

    // ── Tool: cowork_status ────────────────────────────────────────────────────
    server.registerTool(
        'cowork_status',
        {
            title: 'Cowork MCP Status',
            description: `Check the health and capabilities of the Cowork MCP server.
Returns server version, available tools, default model, and uptime.
Use this before delegating tasks to verify the server is reachable.`,
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        },
        async () => {
            const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
            const status = {
                server: 'cowork-mcp-server',
                version: '1.0.0',
                status: hasApiKey ? 'ready' : 'degraded — ANTHROPIC_API_KEY not set',
                model: DEFAULT_MODEL,
                uptime_since: SERVER_START_TIME,
                tools: [
                    'claude_task',
                    'claude_multimodal_task',
                    'claude_code_review',
                    'claude_summarize',
                    'claude_brainstorm',
                    'cowork_status',
                ],
                endpoint: `http://localhost:${PORT}/mcp`,
            };
            return {
                content: [{ type: 'text' as const, text: JSON.stringify(status, null, 2) }],
            };
        }
    );

    return server;
}

// ─── Express + MCP HTTP Transport ─────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check (no MCP needed)
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        ok: true,
        server: 'cowork-mcp-server',
        version: '1.0.0',
        model: DEFAULT_MODEL,
        uptime_since: SERVER_START_TIME,
        api_key_set: !!process.env.ANTHROPIC_API_KEY,
    });
});

// MCP endpoint — stateless: new server + transport per request
app.all('/mcp', async (req: Request, res: Response) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
    });

    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    log(`Cowork MCP Server running on http://localhost:${PORT}`);
    log(`  MCP endpoint: http://localhost:${PORT}/mcp`);
    log(`  Health:       http://localhost:${PORT}/health`);
    log(`  Model:        ${DEFAULT_MODEL}`);
    log(`  API key set:  ${!!process.env.ANTHROPIC_API_KEY}`);
});
