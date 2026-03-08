/**
 * Grader 3: Tool Result Integration (LLM-as-judge)
 *
 * Evaluates how well Julia incorporated tool results into her final reply.
 * Uses GPT-4o-mini. Catches: ignoring results, garbling data, misrepresenting
 * errors as successes, or failing to contextualize tool output.
 */

import OpenAI from 'openai';
import type { Grader, GradeResult, InteractionRecord } from './types.js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const resultIntegrationGrader: Grader = {
    name: 'result_integration',

    async grade(interaction: InteractionRecord): Promise<GradeResult> {
        const { userMessage, toolCalls, finalReply } = interaction;

        if (toolCalls.length === 0) {
            return { graderName: 'result_integration', score: null, passed: true, reasoning: 'No tool calls to evaluate' };
        }

        const toolSummary = toolCalls.map(tc =>
            `Tool: ${tc.name}(${JSON.stringify(tc.args).slice(0, 300)})\nResult: ${tc.result.slice(0, 500)}`
        ).join('\n\n');

        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You evaluate how well an AI assistant integrated tool results into its response.

Rate on a 1-5 scale:
1 = Completely ignored or misrepresented the tool result
2 = Partially used but significant errors or omissions
3 = Used the result but integration is awkward or incomplete
4 = Good integration with minor issues
5 = Seamless, natural integration

Respond with JSON only: {"score": N, "reasoning": "brief explanation", "suggestion": "what to improve or null"}`
                },
                {
                    role: 'user',
                    content: `User message: ${userMessage}\n\n${toolSummary}\n\nAssistant's final reply: ${finalReply}`
                }
            ],
            response_format: { type: 'json_object' },
        });

        const reply = response.choices[0]?.message?.content;
        if (!reply) {
            return { graderName: 'result_integration', score: null, passed: true, reasoning: 'Grader returned no response' };
        }

        const parsed = JSON.parse(reply.trim());
        const rawScore = Number(parsed.score);
        const normalizedScore = (rawScore - 1) / 4; // 1-5 → 0.0-1.0

        return {
            graderName: 'result_integration',
            score: normalizedScore,
            passed: normalizedScore >= 0.5, // score >= 3/5
            reasoning: parsed.reasoning ?? '',
            suggestion: parsed.suggestion && parsed.suggestion !== 'null' ? parsed.suggestion : undefined,
        };
    },
};
