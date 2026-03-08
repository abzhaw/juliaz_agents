/**
 * In-memory conversation history per chatId.
 * Keeps the last N turns so Claude has context.
 */
const MAX_HISTORY = 20; // max messages to keep per chat (10 turns)
const histories = new Map();
export function addUserMessage(chatId, text) {
    const history = getOrCreate(chatId);
    history.push({ role: 'user', content: text });
    trim(chatId);
}
export function addAssistantMessage(chatId, text) {
    const history = getOrCreate(chatId);
    history.push({ role: 'assistant', content: text });
    trim(chatId);
}
export function getHistory(chatId) {
    return histories.get(chatId) ?? [];
}
export function clearHistory(chatId) {
    histories.delete(chatId);
    log(`Memory cleared for chat ${chatId}`);
}
function getOrCreate(chatId) {
    if (!histories.has(chatId))
        histories.set(chatId, []);
    return histories.get(chatId);
}
function trim(chatId) {
    const history = histories.get(chatId);
    if (history.length > MAX_HISTORY) {
        histories.set(chatId, history.slice(history.length - MAX_HISTORY));
    }
}
function log(msg) {
    console.log(`[memory] ${msg}`);
}
