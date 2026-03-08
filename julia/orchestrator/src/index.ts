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
import { generateReply as generateReplyGpt } from './openai.js';
import { addUserMessage, addAssistantMessage, getHistory } from './memory.js';
import { maybeCapture } from './memory-keeper.js';
import { startLetterScheduler } from './letter-scheduler.js';
import { startDeploy, getStatus as getDevStatus } from './dev-runner.js';
import { loadActivePrompt, getCurrentVersion } from './prompt.js';
import { maybeEvaluate } from './evaluator.js';
import { startEvolutionScheduler } from './evolution-scheduler.js';
import type { InteractionRecord } from './graders/types.js';

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 5000);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch('http://localhost:3000/usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, promptTokens, completionTokens }),
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) return;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === 2) {
                console.error('[orchestrator] Failed to report usage after 3 attempts:', err);
            } else {
                await sleep(1000 * Math.pow(2, i)); // 1s, 2s
            }
        }
    }
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

    // ── /dev — pull from GitHub and restart all services ──────────────
    if (text.trim().toLowerCase() === '/dev') {
        const RAPHAEL_CHAT_ID = process.env.RAPHAEL_CHAT_ID;
        if (!RAPHAEL_CHAT_ID) {
            log('ERROR: /dev used but RAPHAEL_CHAT_ID is not set in .env');
            await postReply(chatId, '⚠️ Dev mode not configured.');
            return;
        }
        if (chatId !== RAPHAEL_CHAT_ID) {
            log(`Unauthorized /dev attempt from chatId ${chatId}`);
            await postReply(chatId, '⚠️ Not authorized.');
            return;
        }
        await startDeploy(chatId);
        return;
    }

    // ── /dev-status — check if a deploy is running ─────────────────
    if (text.trim().toLowerCase() === '/dev-status') {
        const RAPHAEL_CHAT_ID = process.env.RAPHAEL_CHAT_ID;
        if (chatId !== RAPHAEL_CHAT_ID) {
            await postReply(chatId, '⚠️ Not authorized.');
            return;
        }
        const status = getDevStatus();
        if (!status.running) {
            await postReply(chatId, '💤 No deploy running.');
        } else {
            await postReply(chatId, `🚀 Deploy in progress\nStarted: ${status.startedAt}\nElapsed: ${status.elapsedSeconds}s`);
        }
        return;
    }

    // ── /evolution — self-evolution status ─────────────────────────
    if (text.trim().toLowerCase() === '/evolution') {
        const RAPHAEL_CHAT_ID = process.env.RAPHAEL_CHAT_ID;
        if (chatId !== RAPHAEL_CHAT_ID) {
            await postReply(chatId, '⚠️ Not authorized.');
            return;
        }
        try {
            const statsRes = await fetch('http://localhost:3000/evolution-stats', {
                signal: AbortSignal.timeout(5000),
            });
            if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);
            const stats = await statsRes.json();

            const activeVersion = stats.promptVersions.find((v: any) => v.isActive);
            const graderLines = Object.entries(stats.graderStats as Record<string, any>)
                .map(([name, g]: [string, any]) => {
                    const passRate = g.total > 0 ? ((g.passed / g.total) * 100).toFixed(0) : 'N/A';
                    return `  ${name}: ${passRate}% pass (${g.total} evals)`;
                })
                .join('\n');

            const lastRun = stats.recentOptimizationRuns[0];
            const lastRunStr = lastRun
                ? `${lastRun.decision} (v${lastRun.fromVersion}→v${lastRun.toVersion ?? 'same'})`
                : 'None yet';

            const msg = [
                `🧬 Self-Evolution Status`,
                ``,
                `Prompt: v${activeVersion?.version ?? '?'} (score: ${activeVersion?.avgScore !== null ? (activeVersion.avgScore * 100).toFixed(0) + '%' : 'N/A'})`,
                `Total versions: ${stats.promptVersions.length}`,
                `Total interactions evaluated: ${stats.totalInteractions}`,
                `Total evaluations: ${stats.totalEvaluations}`,
                ``,
                `Grader pass rates:`,
                graderLines || '  (no data yet)',
                ``,
                `Last optimization: ${lastRunStr}`,
            ].join('\n');

            await postReply(chatId, msg);
        } catch (err: any) {
            await postReply(chatId, `⚠️ Could not fetch evolution stats: ${err.message}`);
        }
        return;
    }

    // ── /tasks — shortcut commands for task management ─────────────
    const trimmedLower = text.trim().toLowerCase();
    if (trimmedLower === '/tasks') {
        // Fast path: list tasks without going through LLM
        const { executeTool } = await import('./tools.js');
        const result = await executeTool('manage_tasks', JSON.stringify({ action: 'list' }));
        await postReply(chatId, result);
        return;
    }
    if (trimmedLower === '/tasks next') {
        const { executeTool } = await import('./tools.js');
        const result = await executeTool('manage_tasks', JSON.stringify({ action: 'next' }));
        await postReply(chatId, result);
        return;
    }
    if (trimmedLower.startsWith('/tasks done ')) {
        const taskId = text.trim().split(/\s+/)[2]?.toUpperCase();
        if (taskId) {
            const { executeTool } = await import('./tools.js');
            const result = await executeTool('manage_tasks', JSON.stringify({ action: 'update', task_id: taskId, status: 'done', note: 'Marked done via Telegram.' }));
            await postReply(chatId, result);
        } else {
            await postReply(chatId, '⚠️ Usage: /tasks done TASK-001');
        }
        return;
    }
    if (trimmedLower.startsWith('/tasks add ')) {
        const title = text.trim().slice('/tasks add '.length).trim();
        if (title) {
            const { executeTool } = await import('./tools.js');
            const result = await executeTool('manage_tasks', JSON.stringify({ action: 'create', title }));
            await postReply(chatId, result);
        } else {
            await postReply(chatId, '⚠️ Usage: /tasks add My new task title');
        }
        return;
    }
    if (trimmedLower.startsWith('/tasks status')) {
        const { executeTool } = await import('./tools.js');
        const result = await executeTool('manage_tasks', JSON.stringify({ action: 'list' }));
        await postReply(chatId, result);
        return;
    }

    // Add the user message to history
    addUserMessage(chatId, text);

    // Silently check if this message contains something worth preserving as a memory
    maybeCapture(chatId, text); // fire-and-forget, never awaited

    // Get the full conversation history and generate a reply
    // Primary: Claude Haiku — Fallback: GPT-4o (if Claude fails with non-retryable error)
    const history = getHistory(chatId);
    let reply: string;
    let model: string;
    let toolCalls: import('./graders/types.js').ToolCall[] = [];

    try {
        const result = await generateReply(history);
        reply = result.reply;
        model = 'claude-haiku-4-5-20251001';
        toolCalls = result.toolCalls;
        reportUsage(model, result.usage.input_tokens, result.usage.output_tokens);
    } catch (claudeErr: any) {
        log(`Claude failed (${claudeErr.message}), falling back to GPT-4o`);
        try {
            const result = await generateReplyGpt(history);
            reply = result.reply;
            model = 'gpt-4o';
            toolCalls = result.toolCalls;
            reportUsage(model, result.usage.prompt_tokens, result.usage.completion_tokens);
        } catch (gptErr: any) {
            throw new Error(`Both Claude and GPT-4o failed. Claude: ${claudeErr.message} | GPT-4o: ${gptErr.message}`);
        }
    }

    // Store the assistant's reply in history
    addAssistantMessage(chatId, reply);

    // Post the reply back to the bridge → OpenClaw delivers it
    await postReply(chatId, reply, messageId);

    log(`Reply sent to ${chatId}: "${reply.slice(0, 80)}"`);

    // ── Self-evolution: evaluate tool usage (fire-and-forget, dev mode only) ──
    if (process.env.DEV_MODE === 'true' && toolCalls.length > 0) {
        const interaction: InteractionRecord = {
            chatId,
            userMessage: text,
            conversationContext: history.slice(-6).map(m => m.content),
            toolCalls,
            finalReply: reply,
            model,
            promptVersion: getCurrentVersion(),
        };
        maybeEvaluate(interaction); // fire-and-forget, never awaited
    }
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
        throw err;
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

    // Load active prompt version from DB (or seed baseline)
    await loadActivePrompt();

    log('Julia is ready. Waiting for messages...\n');

    // Start daily letter scheduler (runs independently every 30 minutes)
    startLetterScheduler();

    // Start self-evolution scheduler (runs every 6 hours) — dev mode only
    if (process.env.DEV_MODE === 'true') {
        startEvolutionScheduler();
        log('Self-evolution scheduler started (DEV_MODE=true)');
    } else {
        log('Self-evolution scheduler disabled (set DEV_MODE=true to enable)');
    }

    // Start polling loop
    let consecutiveErrors = 0;

    while (true) {
        try {
            await poll();
            consecutiveErrors = 0;
        } catch (err) {
            consecutiveErrors++;
            log(`Loop error (consecutive: ${consecutiveErrors}): ${err}`);
        }
        const backoff = Math.min(consecutiveErrors * 5_000, 55_000);
        if (backoff > 0) {
            log(`Backing off — next poll in ${Math.round((POLL_INTERVAL + backoff) / 1000)}s`);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL + backoff));
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
