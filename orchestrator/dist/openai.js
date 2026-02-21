/**
 * OpenAI API client — sends conversation history and returns a reply.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env'), override: true });
if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY is not set. Check orchestrator/.env');
    process.exit(1);
}
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Generate a reply from OpenAI given the full conversation history.
 */
export async function generateReply(history) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            ],
        }, { signal: controller.signal });
        clearTimeout(timeoutId);
        const reply = response.choices[0]?.message?.content;
        const usage = response.usage;
        if (!reply) {
            throw new Error('Unexpected empty response from OpenAI');
        }
        return {
            reply,
            usage: {
                prompt_tokens: usage?.prompt_tokens || 0,
                completion_tokens: usage?.completion_tokens || 0,
                total_tokens: usage?.total_tokens || 0,
            }
        };
    }
    catch (error) {
        console.error('[openai] API Error:', error);
        if (error.response) {
            console.error('[openai] Response data:', error.response.data);
        }
        throw error;
    }
}
