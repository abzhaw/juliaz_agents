/**
 * Claude API client — sends conversation history and returns a reply.
 *
 * Resilience features:
 *   - 30-second AbortController timeout per attempt
 *   - Up to 3 attempts with exponential backoff (1s, 2s, 4s)
 *   - HTTP 429 rate-limit: honours Retry-After header, falls back to backoff
 *   - Guards against empty response.content before destructuring
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompt.js';

// Use absolute path so .env loads correctly regardless of CWD.
// override:true forces the .env value even when the shell has pre-set the var to "".
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env'), override: true });

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set. Check orchestrator/.env');
    process.exit(1);
}

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface Turn {
    role: 'user' | 'assistant';
    content: string;
}

export interface Usage {
    input_tokens: number;
    output_tokens: number;
}

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

/** Resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a reply from Claude given the full conversation history.
 * The latest user message should already be included in history.
 *
 * Retries up to MAX_ATTEMPTS times with exponential backoff.
 * Each individual attempt is bounded by a 30-second AbortController timeout.
 */
export async function generateReply(history: Turn[]): Promise<{ reply: string; usage: Usage }> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await client.messages.create(
                {
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 1024,
                    system: SYSTEM_PROMPT,
                    messages: history.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                },
                { signal: controller.signal },
            );

            if (response.content.length === 0) {
                throw new Error('Claude returned an empty content array');
            }

            const block = response.content[0];
            const usage = response.usage;

            if (block?.type !== 'text') {
                throw new Error(`Unexpected response type from Claude: ${block?.type}`);
            }

            return {
                reply: block.text,
                usage: {
                    input_tokens: usage.input_tokens,
                    output_tokens: usage.output_tokens,
                },
            };
        } catch (err: unknown) {
            lastError = err;

            // Determine wait time before the next attempt.
            const isLastAttempt = attempt === MAX_ATTEMPTS - 1;
            if (isLastAttempt) break;

            let waitMs = Math.pow(2, attempt) * 1_000; // 1s, 2s, 4s

            // On HTTP 429, honour the Retry-After header if present.
            if (
                err instanceof Anthropic.APIError &&
                err.status === 429
            ) {
                const retryAfter =
                    (err.headers as Record<string, string> | undefined)?.['retry-after'];
                if (retryAfter) {
                    const parsed = Number(retryAfter);
                    if (!Number.isNaN(parsed)) {
                        waitMs = parsed * 1_000;
                    }
                }
                console.warn(
                    `[claude] Rate-limited (429). Waiting ${waitMs}ms before attempt ${attempt + 2}/${MAX_ATTEMPTS}.`,
                );
            } else if (err instanceof Error && err.name === 'AbortError') {
                console.warn(
                    `[claude] Request timed out after ${TIMEOUT_MS}ms. Attempt ${attempt + 1}/${MAX_ATTEMPTS}. Retrying in ${waitMs}ms.`,
                );
            } else {
                console.warn(
                    `[claude] Attempt ${attempt + 1}/${MAX_ATTEMPTS} failed: ${err instanceof Error ? err.message : String(err)}. Retrying in ${waitMs}ms.`,
                );
            }

            await sleep(waitMs);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`Claude API failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`);
}
