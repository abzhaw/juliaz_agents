/**
 * Claude API client — sends conversation history and returns a reply.
 *
 * Supports a tool-use loop: if Claude requests a tool call, the tool is
 * executed locally and the result is fed back before getting the final reply.
 *
 * Resilience features:
 *   - 30-second AbortController timeout per API call
 *   - Up to 3 attempts per API call with exponential backoff (1s, 2s)
 *   - HTTP 429 rate-limit: honours Retry-After header
 *   - Tool-use loop: max 5 iterations before giving up
 *   - Accumulates token usage across all loop iterations
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompt.js';
import { TOOLS, executeTool } from './tools.js';
// Use absolute path so .env loads correctly regardless of CWD.
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env'), override: true });
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set. Check orchestrator/.env');
    process.exit(1);
}
const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const MAX_TOOL_ITERATIONS = 5;
/** Resolves after `ms` milliseconds. */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Make a single Claude API call with retry logic.
 * Retries up to MAX_ATTEMPTS times with exponential backoff.
 */
async function callWithRetry(params) {
    let lastError;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await client.messages.create(params, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (err) {
            clearTimeout(timeoutId);
            lastError = err;
            // Non-retryable errors
            if (err instanceof Anthropic.APIError && [400, 401, 403].includes(err.status)) {
                throw err;
            }
            const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
            if (isLastAttempt)
                break;
            let waitMs = Math.pow(2, attempt) * 1_000; // 1s, 2s
            if (err instanceof Anthropic.APIError && err.status === 429) {
                const retryAfter = err.headers?.['retry-after'];
                if (retryAfter) {
                    const parsed = Number(retryAfter);
                    if (!Number.isNaN(parsed))
                        waitMs = parsed * 1_000;
                }
                waitMs = Math.min(waitMs, 60_000);
                console.warn(`[claude] Rate-limited (429). Waiting ${waitMs}ms before attempt ${attempt + 2}/${MAX_ATTEMPTS}.`);
            }
            else if (err instanceof Error && err.name === 'AbortError') {
                console.warn(`[claude] Request timed out after ${TIMEOUT_MS}ms. Attempt ${attempt + 1}/${MAX_ATTEMPTS}.`);
            }
            else {
                console.warn(`[claude] Attempt ${attempt + 1}/${MAX_ATTEMPTS} failed: ${err instanceof Error ? err.message : String(err)}.`);
            }
            await sleep(waitMs);
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error(`Claude API failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`);
}
/**
 * Generate a reply from Claude given the full conversation history.
 * The latest user message should already be included in history.
 *
 * Runs a tool-use loop: tool calls are executed and results fed back
 * until Claude produces a final text reply. The caller sees no change —
 * the function signature is identical to the non-tool version.
 */
export async function generateReply(history) {
    const totalUsage = { input_tokens: 0, output_tokens: 0 };
    // Build a mutable message array. Tool protocol messages exist only within
    // this call's scope — the original history is never mutated.
    const messages = history.map((m) => ({
        role: m.role,
        content: m.content,
    }));
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const response = await callWithRetry({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages,
            tools: TOOLS,
            tool_choice: { type: 'auto' },
        });
        // Accumulate usage
        totalUsage.input_tokens += response.usage.input_tokens;
        totalUsage.output_tokens += response.usage.output_tokens;
        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
            // Append the full assistant response (may contain text + tool_use blocks)
            messages.push({
                role: 'assistant',
                content: response.content,
            });
            // Execute each tool_use block and build tool_result blocks
            const toolResults = [];
            for (const block of response.content) {
                if (block.type === 'tool_use') {
                    console.log(`[claude] Tool requested: ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`);
                    const result = await executeTool(block.name, JSON.stringify(block.input));
                    console.log(`[claude] Tool result: ${result.slice(0, 200)}`);
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: block.id,
                        content: result,
                    });
                }
            }
            // Feed tool results back as a user message
            messages.push({
                role: 'user',
                content: toolResults,
            });
            continue; // Loop back for Claude to process tool results
        }
        // Final text reply — extract text blocks
        const textBlocks = response.content.filter((b) => b.type === 'text');
        const reply = textBlocks.map((b) => b.text).join('\n');
        if (!reply) {
            throw new Error('Claude returned no text in final response');
        }
        return { reply, usage: totalUsage };
    }
    throw new Error('Tool-use loop exceeded maximum iterations without a final reply');
}
