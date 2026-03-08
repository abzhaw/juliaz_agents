/**
 * In-memory conversation history per chatId.
 * Keeps the last N turns so Claude has context.
 */

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

const MAX_HISTORY = 20; // max messages to keep per chat (10 turns)
const histories = new Map<string, Message[]>();

export function addUserMessage(chatId: string, text: string): void {
    const history = getOrCreate(chatId);
    history.push({ role: 'user', content: text });
    trim(chatId);
}

export function addAssistantMessage(chatId: string, text: string): void {
    const history = getOrCreate(chatId);
    history.push({ role: 'assistant', content: text });
    trim(chatId);
}

export function getHistory(chatId: string): Message[] {
    return histories.get(chatId) ?? [];
}

export function clearHistory(chatId: string): void {
    histories.delete(chatId);
    log(`Memory cleared for chat ${chatId}`);
}

function getOrCreate(chatId: string): Message[] {
    if (!histories.has(chatId)) histories.set(chatId, []);
    return histories.get(chatId)!;
}

function trim(chatId: string): void {
    const history = histories.get(chatId)!;
    if (history.length > MAX_HISTORY) {
        histories.set(chatId, history.slice(history.length - MAX_HISTORY));
    }
}

function log(msg: string): void {
    console.log(`[memory] ${msg}`);
}
