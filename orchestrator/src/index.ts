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

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 5000);

function log(msg: string): void {
    console.log(`[orchestrator] ${new Date().toISOString()} — ${msg}`);
}

async function processMessage(chatId: string, messageId: string, username: string, text: string): Promise<void> {
    log(`Processing message from @${username} (${chatId}): "${text.slice(0, 80)}"`);

    // Handle special commands
    if (text.trim().toLowerCase() === '/start') {
        await postReply(chatId, `Hey! I'm Julia 👋 — Raphael's AI agent. Ask me anything.`);
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

    // Get the full conversation history and generate a reply
    const history = getHistory(chatId);
    const reply = await generateReply(history);

    // Store the assistant's reply in history
    addAssistantMessage(chatId, reply);

    // Post the reply back to the bridge → OpenClaw delivers it
    await postReply(chatId, reply);

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
            } catch (err) {
                log(`Error processing message ${msg.id}: ${err}`);
                // Post an error reply so the user knows something went wrong
                try {
                    await postReply(msg.chatId, '⚠️ Something went wrong on my end. Try again in a moment.');
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

    // Start polling loop
    const loop = async () => {
        await poll();
        setTimeout(loop, POLL_INTERVAL);
    };

    await loop();
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
