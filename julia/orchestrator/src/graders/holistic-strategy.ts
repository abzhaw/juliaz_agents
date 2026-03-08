/**
 * Grader 4: Holistic Tool Strategy (LLM-as-judge)
 *
 * Evaluates the overall tool usage strategy: was the right tool selected?
 * Was the sequence logical? Did Julia over-delegate or under-utilize tools?
 */

import OpenAI from 'openai';
import type { Grader, GradeResult, InteractionRecord } from './types.js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AVAILABLE_TOOLS = 'send_email, ask_claude, send_telegram_message, fetch_email, manage_tasks';

export const holisticStrategyGrader: Grader = {
    name: 'holistic_strategy',

    async grade(interaction: InteractionRecord): Promise<GradeResult> {
        const { userMessage, toolCalls, finalReply, conversationContext } = interaction;

        const contextStr = conversationContext.length > 0
            ? `Recent conversation context:\n${conversationContext.slice(-6).join('\n')}\n\n`
            : '';

        const toolCallsSummary = toolCalls.length > 0
            ? toolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.args).slice(0, 200)})`).join(' → ')
            : '(no tools called)';

        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You evaluate an AI assistant's tool usage strategy.

Available tools: ${AVAILABLE_TOOLS}

Evaluate:
1. Was a tool needed for this request? Was one used?
2. Was the right tool selected for the task?
3. Was the tool usage sequence logical?
4. Could the assistant have answered directly without tools (over-delegation)?
5. Should the assistant have used a tool but didn't (under-utilization)?

Rate 1-5:
1 = Completely wrong strategy (wrong tool, unnecessary use, or missed critical tool)
2 = Significant strategic errors
3 = Acceptable strategy with room for improvement
4 = Good strategy with minor optimization possible
5 = Optimal tool strategy

Respond with JSON only: {"score": N, "reasoning": "brief explanation", "suggestion": "what to improve or null"}`
                },
                {
                    role: 'user',
                    content: `${contextStr}User message: ${userMessage}\n\nTools called (in order): ${toolCallsSummary}\n\nFinal reply: ${finalReply}`
                }
            ],
            response_format: { type: 'json_object' },
        });

        const reply = response.choices[0]?.message?.content;
        if (!reply) {
            return { graderName: 'holistic_strategy', score: null, passed: true, reasoning: 'Grader returned no response' };
        }

        const parsed = JSON.parse(reply.trim());
        const rawScore = Number(parsed.score);
        const normalizedScore = (rawScore - 1) / 4; // 1-5 → 0.0-1.0

        return {
            graderName: 'holistic_strategy',
            score: normalizedScore,
            passed: normalizedScore >= 0.5, // score >= 3/5
            reasoning: parsed.reasoning ?? '',
            suggestion: parsed.suggestion && parsed.suggestion !== 'null' ? parsed.suggestion : undefined,
        };
    },
};
