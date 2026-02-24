/**
 * Evaluator — coordinates the grading of tool-using interactions.
 *
 * Fire-and-forget: called after every reply that involved tool calls.
 * Errors are caught and logged, never thrown. Pattern matches memory-keeper.ts.
 */

import type { InteractionRecord, GradeResult } from './graders/types.js';
import { toolSelectionGrader } from './graders/tool-selection.js';
import { paramCorrectnessGrader } from './graders/param-correctness.js';
import { resultIntegrationGrader } from './graders/result-integration.js';
import { holisticStrategyGrader } from './graders/holistic-strategy.js';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
            if (res.ok) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === retries - 1) throw err;
            await sleep(1000 * Math.pow(2, i));
        }
    }
    throw new Error('Unreachable');
}

async function saveInteraction(interaction: InteractionRecord): Promise<number> {
    const res = await fetchWithRetry(`${BACKEND}/tool-interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId: interaction.chatId,
            promptVersion: interaction.promptVersion,
            userMessage: interaction.userMessage,
            conversationCtx: JSON.stringify(interaction.conversationContext),
            toolCalls: JSON.stringify(interaction.toolCalls),
            finalReply: interaction.finalReply,
            model: interaction.model,
        }),
    });
    const data = await res.json();
    return data.id;
}

async function saveEvaluation(interactionId: number, result: GradeResult): Promise<void> {
    await fetchWithRetry(`${BACKEND}/tool-evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            interactionId,
            graderName: result.graderName,
            score: result.score,
            rawScore: result.score !== null ? String(result.score) : null,
            passed: result.passed,
            reasoning: result.reasoning ?? null,
            suggestion: result.suggestion ?? null,
        }),
    });
}

async function updatePromptVersionScore(promptVersion: number): Promise<void> {
    // Fetch current active version to update rolling average
    try {
        const res = await fetch(`${BACKEND}/prompt-versions/active`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const active = await res.json();
        if (active.version !== promptVersion) return;

        // Fetch all evaluations for this prompt version
        const evalsRes = await fetch(`${BACKEND}/tool-evaluations?since=${active.activatedAt || active.createdAt}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!evalsRes.ok) return;
        const evals = await evalsRes.json();

        const scoredEvals = evals.filter((e: any) => e.score !== null);
        if (scoredEvals.length === 0) return;

        const avgScore = scoredEvals.reduce((sum: number, e: any) => sum + e.score, 0) / scoredEvals.length;

        await fetchWithRetry(`${BACKEND}/prompt-versions/${active.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avgScore, evalCount: scoredEvals.length }),
        });
    } catch {
        // Non-fatal — score update can fail silently
    }
}

/**
 * Evaluate a tool-using interaction. Fire-and-forget.
 * Call this after every reply that involved tool calls.
 */
export async function maybeEvaluate(interaction: InteractionRecord): Promise<void> {
    if (interaction.toolCalls.length === 0) return;

    try {
        // 1. Save the interaction
        const interactionId = await saveInteraction(interaction);
        console.log(`[evaluator] Recorded interaction #${interactionId} (${interaction.toolCalls.length} tool calls)`);

        // 2. Run all 4 graders in parallel
        const graders = [toolSelectionGrader, paramCorrectnessGrader, resultIntegrationGrader, holisticStrategyGrader];
        const results = await Promise.allSettled(graders.map(g => g.grade(interaction)));

        // 3. Save each result
        let savedCount = 0;
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const grade = result.value;
                if (grade.score !== null) {
                    await saveEvaluation(interactionId, grade);
                    savedCount++;
                    const icon = grade.passed ? '✅' : '❌';
                    console.log(`[evaluator] ${icon} ${grade.graderName}: ${(grade.score * 100).toFixed(0)}%`);
                }
            } else {
                console.error(`[evaluator] Grader failed:`, result.reason);
            }
        }

        // 4. Update prompt version rolling average
        if (savedCount > 0) {
            await updatePromptVersionScore(interaction.promptVersion);
        }
    } catch (err) {
        // Silent fail — evaluation must never crash the main loop
        console.error('[evaluator] Error (non-fatal):', err);
    }
}
