/**
 * Metaprompt Optimizer — the brain of the self-evolution loop.
 *
 * Runs periodically (triggered by evolution-scheduler.ts). Aggregates
 * evaluation results, identifies failure patterns, and uses GPT-4o-mini
 * to rewrite the tool-usage sections of Julia's system prompt.
 *
 * Safety: identity section is immutable, rollback on score degradation.
 */

import OpenAI from 'openai';
import { getBaselinePrompt, setActivePrompt, getCurrentVersion } from './prompt.js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

// Minimum interactions before the optimizer will consider running
const MIN_INTERACTIONS = 10;

// Score thresholds
const GRADER_PASS_THRESHOLD = 0.75;
const OVERALL_SCORE_THRESHOLD = 0.7;

// Rollback threshold: new version must score >= this fraction of parent
const ROLLBACK_RATIO = 0.9;

// Identity section length to protect (first N chars of prompt must remain identical)
const IDENTITY_SECTION_LENGTH = 500;

interface GraderStats {
    total: number;
    passed: number;
    passRate: number;
    avgScore: number;
    suggestions: string[];
}

interface EvaluationData {
    graderStats: Record<string, GraderStats>;
    totalInteractions: number;
    worstInteractions: any[];
}

async function fetchEvaluationsSinceLastRun(): Promise<EvaluationData> {
    // Find the last optimization run
    const runsRes = await fetch(`${BACKEND}/optimization-runs`, {
        signal: AbortSignal.timeout(5000),
    });
    const runs = runsRes.ok ? await runsRes.json() : [];
    const lastRun = runs[0]; // already sorted desc
    const since = lastRun?.createdAt ?? '2020-01-01T00:00:00.000Z';

    // Fetch interactions since last run
    const interactionsRes = await fetch(`${BACKEND}/tool-interactions?since=${since}`, {
        signal: AbortSignal.timeout(5000),
    });
    const interactions = interactionsRes.ok ? await interactionsRes.json() : [];

    // Fetch evaluations since last run
    const evalsRes = await fetch(`${BACKEND}/tool-evaluations?since=${since}`, {
        signal: AbortSignal.timeout(5000),
    });
    const evaluations = evalsRes.ok ? await evalsRes.json() : [];

    // Aggregate stats per grader
    const graderStats: Record<string, GraderStats> = {};
    for (const ev of evaluations) {
        if (!graderStats[ev.graderName]) {
            graderStats[ev.graderName] = { total: 0, passed: 0, passRate: 0, avgScore: 0, suggestions: [] };
        }
        const g = graderStats[ev.graderName];
        g.total++;
        if (ev.passed) g.passed++;
        if (ev.score !== null) {
            g.avgScore = (g.avgScore * (g.total - 1) + ev.score) / g.total;
        }
        if (ev.suggestion) g.suggestions.push(ev.suggestion);
    }

    // Compute pass rates
    for (const g of Object.values(graderStats)) {
        g.passRate = g.total > 0 ? g.passed / g.total : 1;
    }

    // Find worst interactions (lowest average score)
    const interactionScores: Map<number, { interaction: any; scores: number[] }> = new Map();
    for (const ev of evaluations) {
        if (ev.score === null) continue;
        if (!interactionScores.has(ev.interactionId)) {
            const inter = interactions.find((i: any) => i.id === ev.interactionId);
            interactionScores.set(ev.interactionId, { interaction: inter, scores: [] });
        }
        interactionScores.get(ev.interactionId)!.scores.push(ev.score);
    }

    const ranked = [...interactionScores.entries()]
        .map(([id, data]) => ({
            ...data,
            avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        }))
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 3); // top 3 worst

    return {
        graderStats,
        totalInteractions: interactions.length,
        worstInteractions: ranked.map(r => r.interaction).filter(Boolean),
    };
}

function shouldOptimize(data: EvaluationData): { optimize: boolean; reason: string } {
    if (data.totalInteractions < MIN_INTERACTIONS) {
        return { optimize: false, reason: `Only ${data.totalInteractions} interactions (need ${MIN_INTERACTIONS})` };
    }

    const failingGraders = Object.entries(data.graderStats)
        .filter(([, g]) => g.passRate < GRADER_PASS_THRESHOLD)
        .map(([name]) => name);

    const allScores = Object.values(data.graderStats).map(g => g.avgScore);
    const overallAvg = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 1;

    if (failingGraders.length > 0) {
        return { optimize: true, reason: `Graders failing: ${failingGraders.join(', ')}` };
    }
    if (overallAvg < OVERALL_SCORE_THRESHOLD) {
        return { optimize: true, reason: `Overall avg score ${(overallAvg * 100).toFixed(0)}% < ${OVERALL_SCORE_THRESHOLD * 100}%` };
    }

    return { optimize: false, reason: `All graders healthy (avg ${(overallAvg * 100).toFixed(0)}%)` };
}

function buildMetaprompt(currentPrompt: string, data: EvaluationData): string {
    const graderSummary = Object.entries(data.graderStats)
        .map(([name, g]) => `- ${name}: ${(g.passRate * 100).toFixed(0)}% pass rate, avg score ${(g.avgScore * 100).toFixed(0)}%`)
        .join('\n');

    const failingSuggestions = Object.entries(data.graderStats)
        .filter(([, g]) => g.passRate < GRADER_PASS_THRESHOLD)
        .flatMap(([name, g]) => g.suggestions.slice(0, 5).map(s => `[${name}] ${s}`))
        .join('\n');

    const worstExamples = data.worstInteractions
        .map(i => {
            if (!i) return '';
            const toolCalls = JSON.parse(i.toolCalls || '[]');
            const tools = toolCalls.map((tc: any) => `${tc.name}(${JSON.stringify(tc.args).slice(0, 100)})`).join(', ');
            return `User: "${i.userMessage.slice(0, 200)}"\nTools: ${tools}\nReply: "${i.finalReply.slice(0, 200)}"`;
        })
        .filter(Boolean)
        .join('\n\n');

    return `You are a prompt engineer optimizing an AI agent's system prompt to improve tool usage.

CURRENT SYSTEM PROMPT:
${currentPrompt}

PERFORMANCE DATA (last ${data.totalInteractions} tool-using interactions):
${graderSummary}

FAILURE SUGGESTIONS FROM GRADERS:
${failingSuggestions || '(none)'}

WORST-PERFORMING INTERACTIONS:
${worstExamples || '(none)'}

YOUR TASK:
Rewrite the system prompt to address the identified tool usage issues. Rules:
1. Keep the "Who you are" and "Your personality" sections EXACTLY the same — word for word
2. ONLY modify sections about tool usage (capabilities, email behaviour, delegation behaviour, task management, etc.)
3. Add specific examples or clarifications that address the failure patterns
4. Do not remove any existing capabilities
5. Keep the prompt under 2000 words total
6. Do NOT include a date line — that is injected at runtime

Output valid JSON only: {"prompt": "the full new system prompt text", "changes": ["description of change 1", "description of change 2"]}`;
}

function validateCandidate(candidate: string, currentPrompt: string): { valid: boolean; reason: string } {
    // Must not be empty or too short
    if (candidate.length < 200) {
        return { valid: false, reason: 'Candidate prompt too short' };
    }

    // Must not be too long
    const wordCount = candidate.split(/\s+/).length;
    if (wordCount > 3000) {
        return { valid: false, reason: `Candidate too long: ${wordCount} words` };
    }

    // Must contain all tool names
    const requiredTools = ['send_email', 'ask_claude', 'manage_tasks', 'send_telegram_message', 'fetch_email'];
    for (const tool of requiredTools) {
        if (!candidate.includes(tool)) {
            return { valid: false, reason: `Missing tool reference: ${tool}` };
        }
    }

    // Must contain identity markers
    if (!candidate.includes('Julia') || !candidate.includes('Raphael')) {
        return { valid: false, reason: 'Missing identity markers (Julia/Raphael)' };
    }

    // Identity section must be preserved (first N characters)
    const baseline = getBaselinePrompt();
    const baselineIdentity = baseline.slice(0, IDENTITY_SECTION_LENGTH);
    const candidateIdentity = candidate.slice(0, IDENTITY_SECTION_LENGTH);
    if (baselineIdentity !== candidateIdentity) {
        return { valid: false, reason: 'Identity section was modified (first 500 chars must match baseline)' };
    }

    return { valid: true, reason: 'Validation passed' };
}

/**
 * Check if the current prompt version should be rolled back.
 * Called after each optimization run to compare version performance.
 */
export async function checkRollback(): Promise<void> {
    try {
        const activeRes = await fetch(`${BACKEND}/prompt-versions/active`, { signal: AbortSignal.timeout(5000) });
        if (!activeRes.ok) return;
        const active = await activeRes.json();

        // Don't rollback v1 (baseline)
        if (active.version <= 1 || !active.parentVersion) return;

        // Need enough evaluations before comparing
        if (active.evalCount < MIN_INTERACTIONS) return;

        // Fetch parent version
        const versionsRes = await fetch(`${BACKEND}/prompt-versions`, { signal: AbortSignal.timeout(5000) });
        if (!versionsRes.ok) return;
        const versions = await versionsRes.json();
        const parent = versions.find((v: any) => v.version === active.parentVersion);
        if (!parent || parent.avgScore === null) return;

        // Compare scores
        if (active.avgScore !== null && active.avgScore < parent.avgScore * ROLLBACK_RATIO) {
            console.warn(`[optimizer] Rolling back v${active.version} (${(active.avgScore * 100).toFixed(0)}%) → v${parent.version} (${(parent.avgScore * 100).toFixed(0)}%)`);

            // Activate parent version
            await fetch(`${BACKEND}/prompt-versions/${parent.id}/activate`, {
                method: 'PATCH',
                signal: AbortSignal.timeout(5000),
            });

            setActivePrompt(parent.content, parent.version);

            // Log the rollback
            await fetch(`${BACKEND}/optimization-runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromVersion: active.version,
                    toVersion: parent.version,
                    evaluationsUsed: active.evalCount,
                    avgScoreBefore: active.avgScore,
                    failingGraders: '[]',
                    feedbackSummary: `Rolled back: v${active.version} scored ${(active.avgScore * 100).toFixed(0)}% vs parent ${(parent.avgScore * 100).toFixed(0)}%`,
                    optimizerModel: 'rollback',
                    optimizerOutput: 'Automatic rollback due to score degradation',
                    decision: 'ROLLBACK',
                }),
                signal: AbortSignal.timeout(5000),
            });
        }
    } catch (err) {
        console.error('[optimizer] Rollback check error (non-fatal):', err);
    }
}

/**
 * Main optimization function. Called by the evolution scheduler.
 */
export async function optimizePrompt(): Promise<void> {
    console.log('[optimizer] Starting optimization cycle...');

    try {
        // 1. Check if current version needs rollback first
        await checkRollback();

        // 2. Fetch evaluation data
        const data = await fetchEvaluationsSinceLastRun();

        // 3. Decide if optimization is needed
        const { optimize, reason } = shouldOptimize(data);
        console.log(`[optimizer] ${optimize ? 'Optimizing' : 'Skipping'}: ${reason}`);

        if (!optimize) {
            // Log the skip
            await fetch(`${BACKEND}/optimization-runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromVersion: getCurrentVersion(),
                    evaluationsUsed: data.totalInteractions,
                    avgScoreBefore: Object.values(data.graderStats).reduce((a, g) => a + g.avgScore, 0) / Math.max(Object.keys(data.graderStats).length, 1),
                    failingGraders: '[]',
                    feedbackSummary: reason,
                    optimizerModel: 'none',
                    optimizerOutput: reason,
                    decision: 'NO_CHANGE',
                }),
                signal: AbortSignal.timeout(5000),
            });
            return;
        }

        // 4. Fetch current active prompt
        const activeRes = await fetch(`${BACKEND}/prompt-versions/active`, { signal: AbortSignal.timeout(5000) });
        if (!activeRes.ok) {
            console.error('[optimizer] Could not fetch active prompt version');
            return;
        }
        const active = await activeRes.json();

        // 5. Build metaprompt and call GPT-4o-mini
        const metaprompt = buildMetaprompt(active.content, data);

        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: metaprompt },
                { role: 'user', content: 'Generate the optimized system prompt now.' },
            ],
            response_format: { type: 'json_object' },
        });

        const rawOutput = response.choices[0]?.message?.content ?? '';
        let parsed: { prompt: string; changes: string[] };
        try {
            parsed = JSON.parse(rawOutput);
        } catch {
            console.error('[optimizer] Failed to parse optimizer output:', rawOutput.slice(0, 200));
            return;
        }

        if (!parsed.prompt || !Array.isArray(parsed.changes)) {
            console.error('[optimizer] Invalid optimizer output structure');
            return;
        }

        // 6. Validate the candidate
        const validation = validateCandidate(parsed.prompt, active.content);
        if (!validation.valid) {
            console.warn(`[optimizer] Candidate rejected: ${validation.reason}`);

            await fetch(`${BACKEND}/optimization-runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromVersion: active.version,
                    evaluationsUsed: data.totalInteractions,
                    avgScoreBefore: Object.values(data.graderStats).reduce((a, g) => a + g.avgScore, 0) / Math.max(Object.keys(data.graderStats).length, 1),
                    failingGraders: JSON.stringify(Object.entries(data.graderStats).filter(([, g]) => g.passRate < GRADER_PASS_THRESHOLD).map(([n]) => n)),
                    feedbackSummary: `Candidate rejected: ${validation.reason}`,
                    optimizerModel: 'gpt-4o-mini',
                    optimizerOutput: rawOutput.slice(0, 2000),
                    decision: 'NO_CHANGE',
                }),
                signal: AbortSignal.timeout(5000),
            });
            return;
        }

        // 7. Create and activate the new version
        const newVersion = active.version + 1;
        const createRes = await fetch(`${BACKEND}/prompt-versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: newVersion,
                content: parsed.prompt,
                isActive: true,
                parentVersion: active.version,
                changeReason: parsed.changes.join('; '),
                changeDiff: parsed.changes.join('\n'),
            }),
            signal: AbortSignal.timeout(5000),
        });

        if (!createRes.ok) {
            console.error('[optimizer] Failed to create new prompt version');
            return;
        }

        // 8. Activate in memory
        setActivePrompt(parsed.prompt, newVersion);

        // 9. Log the optimization run
        const failingGraders = Object.entries(data.graderStats)
            .filter(([, g]) => g.passRate < GRADER_PASS_THRESHOLD)
            .map(([name]) => name);

        await fetch(`${BACKEND}/optimization-runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromVersion: active.version,
                toVersion: newVersion,
                evaluationsUsed: data.totalInteractions,
                avgScoreBefore: Object.values(data.graderStats).reduce((a, g) => a + g.avgScore, 0) / Math.max(Object.keys(data.graderStats).length, 1),
                failingGraders: JSON.stringify(failingGraders),
                feedbackSummary: reason,
                optimizerModel: 'gpt-4o-mini',
                optimizerOutput: rawOutput.slice(0, 2000),
                decision: 'NEW_VERSION',
            }),
            signal: AbortSignal.timeout(5000),
        });

        console.log(`[optimizer] ✅ Activated prompt v${newVersion}. Changes: ${parsed.changes.join('; ')}`);

    } catch (err) {
        console.error('[optimizer] Error (non-fatal):', err);
    }
}
