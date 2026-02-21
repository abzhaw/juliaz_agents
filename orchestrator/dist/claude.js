/**
 * Claude API client — sends conversation history and returns a reply.
 */
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompt.js';
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
    if (block?.type !== 'text') {
        throw new Error(`Unexpected response type from Claude: ${block?.type}`);
    }
    return block.text;
}
