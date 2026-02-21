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

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

interface ExtractResult {
    save: boolean;
    category?: string;
    memory?: string;
}

async function extract(text: string): Promise<ExtractResult> {
    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You decide if a message contains something worth preserving as a memory.
Save it if it contains: a story from her life (STORY), a meaningful feeling (FEELING), a specific memory or experience (MOMENT), a hope or wish (WISH), or a reflection on life (REFLECTION).
Do NOT save casual chat, questions, small talk, or short replies.
Respond with JSON only — no other text.
If worth saving: {"save":true,"category":"STORY|FEELING|MOMENT|WISH|REFLECTION","memory":"distilled in 1-2 warm sentences"}
If not: {"save":false}`,
        messages: [{ role: 'user', content: text }]
    });

    const block = response.content[0];
    if (block?.type !== 'text') return { save: false };

    try {
        return JSON.parse(block.text.trim());
    } catch {
        return { save: false };
    }
}

async function saveMemory(chatId: string, category: string, content: string, originalText: string): Promise<void> {
    await fetch(`${BACKEND}/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, category, content, originalText })
    });
}

/**
 * Call this after every user message. Runs silently in the background.
 * Errors are swallowed — this must never interrupt the main conversation.
 */
export async function maybeCapture(chatId: string, userMessage: string): Promise<void> {
    // Skip very short messages — not worth analysing
    if (userMessage.trim().length < 30) return;

    try {
        const result = await extract(userMessage);
        if (result.save && result.category && result.memory) {
            await saveMemory(chatId, result.category, result.memory, userMessage);
            console.log(`[memory-keeper] Captured ${result.category}: "${result.memory.slice(0, 60)}..."`);
        }
    } catch (err) {
        // Silent fail — memory capture must never crash the main loop
        console.error('[memory-keeper] Error (non-fatal):', err);
    }
}
