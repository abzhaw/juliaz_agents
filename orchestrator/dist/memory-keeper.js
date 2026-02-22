/**
 * Memory Keeper — silently listens to Julia's messages and extracts moments worth preserving.
 *
 * Runs in the background after every user message. Uses a fast, cheap model
 * (haiku) so it never slows down the main conversation. Stores meaningful
 * moments to the backend DB where they persist permanently and appear on the website.
 *
 * Categories:
 *   STORY      — an anecdote or story from her life
 *   FEELING    — a meaningful emotional state she shared
 *   MOMENT     — a specific memory or experience
 *   WISH       — something she hopes for or wants
 *   REFLECTION — a thought or insight about life
 */
import OpenAI from 'openai';
import 'dotenv/config';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';
async function extract(text) {
    const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `You decide if a message contains something worth preserving as a memory.
Save it if it contains: a story from her life (STORY), a meaningful feeling (FEELING), a specific memory or experience (MOMENT), a hope or wish (WISH), or a reflection on life (REFLECTION).
Do NOT save casual chat, questions, small talk, or short replies.
Respond with JSON only — no other text.
If worth saving: {"save":true,"category":"STORY|FEELING|MOMENT|WISH|REFLECTION","memory":"distilled in 1-2 warm sentences"}
If not: {"save":false}`
            },
            { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' }
    });
    const reply = response.choices[0]?.message?.content;
    const usage = response.usage;
    if (!reply)
        return { save: false };
    try {
        const result = JSON.parse(reply.trim());
        return {
            ...result,
            usage: {
                promptTokens: usage?.prompt_tokens || 0,
                completionTokens: usage?.completion_tokens || 0
            }
        };
    }
    catch {
        return { save: false };
    }
}
async function reportUsage(model, promptTokens, completionTokens) {
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch(`${BACKEND}/usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, promptTokens, completionTokens }),
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok)
                return;
            throw new Error(`HTTP ${res.status}`);
        }
        catch (err) {
            if (i === 2) {
                console.error('[memory-keeper] Failed to report usage after 3 attempts:', err);
            }
            else {
                await sleep(1000 * Math.pow(2, i)); // 1s, 2s
            }
        }
    }
}
async function saveMemory(chatId, category, content, originalText) {
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch(`${BACKEND}/memories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, category, content, originalText }),
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok)
                return;
            throw new Error(`HTTP ${res.status}`);
        }
        catch (err) {
            if (i === 2) {
                console.error('[memory-keeper] Failed to save memory after 3 attempts:', err);
            }
            else {
                await sleep(1000 * Math.pow(2, i)); // 1s, 2s
            }
        }
    }
}
/**
 * Call this after every user message. Runs silently in the background.
 * Errors are swallowed — this must never interrupt the main conversation.
 */
export async function maybeCapture(chatId, userMessage) {
    // Skip very short messages — not worth analysing
    if (userMessage.trim().length < 30)
        return;
    try {
        const result = await extract(userMessage);
        if (result.usage) {
            await reportUsage('gpt-4o-mini', result.usage.promptTokens, result.usage.completionTokens);
        }
        if (result.save && result.category && result.memory) {
            await saveMemory(chatId, result.category, result.memory, userMessage);
            console.log(`[memory-keeper] Captured ${result.category}: "${result.memory.slice(0, 60)}..."`);
        }
    }
    catch (err) {
        // Silent fail — memory capture must never crash the main loop
        console.error('[memory-keeper] Error (non-fatal):', err);
    }
}
