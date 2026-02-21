/**
 * OpenAI API client — sends conversation history and returns a reply.
 */
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt.js';
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
        if (!reply) {
            throw new Error('Unexpected empty response from OpenAI');
        }
        return reply;
    }
    catch (error) {
        console.error('[openai] API Error:', error);
        if (error.response) {
            console.error('[openai] Response data:', error.response.data);
        }
        throw error;
    }
}
