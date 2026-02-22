/**
 * Julia Orchestrator — Main Loop
 *
 * Polls the bridge for pending Telegram messages every POLL_INTERVAL_MS,
 * generates replies using Claude, and posts them back through the bridge.
 * OpenClaw then delivers the replies to the Telegram user.
 */

import 'dotenv/config';
import { fetchPendingMessages, checkHealth, postReply } from './bridge.js';
import { generateReply } from './claude.js';
import { addUserMessage, addAssistantMessage, getHistory } from './memory.js';
import { maybeCapture } from './memory-keeper.js';
import { startLetterScheduler } from './letter-scheduler.js';

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 5000);

function log(msg: string, level: string = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[orchestrator] ${timestamp} — ${msg}`);

    // Fire and forget log to backend
    fetch('http://localhost:3000/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, source: 'orchestrator', message: msg })
    }).catch(() => { /* silent fail if backend is down */ });
}

async function reportUsage(model: string, promptTokens: number, completionTokens: number): Promise<void> {
    fetch('http://localhost:3000/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, promptTokens, completionTokens })
    }).catch(() => { });
}

async function processMessage(chatId: string, messageId: string, username: string, text: string): Promise<void> {
    log(`Processing message from @${username} (${chatId}): "${text.slice(0, 80)}"`);

    // Handle special commands
    if (text.trim().toLowerCase() === '/start') {
        await postReply(chatId, `Hi — I'm Julia. I'm here whenever you want to talk. About anything.`);
        return;
    }

    if (text.trim().toLowerCase() === '/clear') {
        const { clearHistory } = await import('./memory.js');
        clearHistory(chatId);
        await postReply(chatId, '🗑️ Conversation cleared. Fresh start!');
        return;
    }

    // Add the user message to history
    addUserMessage(chatId, text);

    // Silently check if this message contains something worth preserving as a memory
    maybeCapture(chatId, text); // fire-and-forget, never awaited

    // Get the full conversation history and generate a reply
    const history = getHistory(chatId);
    const { reply, usage } = await generateReply(history);

    // Report usage
    reportUsage('claude-3-5-sonnet-20241022', usage.input_tokens, usage.output_tokens);

    // Store the assistant's reply in history
    addAssistantMessage(chatId, reply);

    // Post the reply back to the bridge → OpenClaw delivers it
    await postReply(chatId, reply, messageId);

    log(`Reply sent to ${chatId}: "${reply.slice(0, 80)}"`);
}

async function poll(): Promise<void> {
    try {
        const pending = await fetchPendingMessages();
        if (pending.length > 0) {
            log(`Found ${pending.length} pending message(s)`);
        }

        for (const msg of pending) {
            try {
                await processMessage(msg.chatId, msg.id, msg.username, msg.text);
            } catch (err: any) {
                log(`Error processing message ${msg.id}: ${err.message}`);
                console.error(err);
                // Post an error reply so the user knows something went wrong
                try {
                    await postReply(msg.chatId, `⚠️ Error: ${err.message}. Please check logs.`);
                } catch {
                    // best effort
                }
            }
        }
    } catch (err) {
        log(`Poll error: ${err}`);
    }
}

async function main(): Promise<void> {
    log('Starting up...');

    // Wait for bridge to be ready
    let bridgeReady = false;
    for (let i = 0; i < 10; i++) {
        bridgeReady = await checkHealth();
        if (bridgeReady) break;
        log(`Bridge not ready, retrying in 3s... (attempt ${i + 1}/10)`);
        await new Promise((r) => setTimeout(r, 3000));
    }

    if (!bridgeReady) {
        log('ERROR: Bridge is not reachable at http://localhost:3001. Start the bridge first.');
        process.exit(1);
    }

    log(`✅ Bridge connected. Polling every ${POLL_INTERVAL}ms`);
    log('Julia is ready. Waiting for messages...\n');

    // Start daily letter scheduler (runs independently every 30 minutes)
    startLetterScheduler();

    // Start polling loop
    while (true) {
        try {
            await poll();
        } catch (err) {
            log(`Loop error: ${err}`);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
