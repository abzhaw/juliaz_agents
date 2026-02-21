/**
 * Claude API client — sends conversation history and returns a reply.
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
/**
 * Generate a reply from Claude given the full conversation history.
 * The latest user message should already be included in history.
 */
export async function generateReply(history) {
    const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: history.map((m) => ({
            role: m.role,
            content: m.content,
        })),
    });
    const block = response.content[0];
    const usage = response.usage;
    if (block?.type !== 'text') {
        throw new Error(`Unexpected response type from Claude: ${block?.type}`);
    }
    return {
        reply: block.text,
        usage: {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens
        }
    };
}
