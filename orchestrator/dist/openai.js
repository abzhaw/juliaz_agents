/**
 * OpenAI API client — sends conversation history and returns a reply.
 * Supports a tool-use loop: if OpenAI requests a tool call the tool is
 * executed locally and the result is fed back before getting the final reply.
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompt.js';
import { OPENAI_TOOLS, executeTool } from './tools.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env'), override: true });
if (!process.env.OPENAI_API_KEY) {
    console.warn('[openai] OPENAI_API_KEY is not set — GPT-4o fallback will be unavailable.');
}
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? 'missing',
});
// Guard against infinite tool-use loops
const MAX_TOOL_ITERATIONS = 5;
/**
 * Generate a reply from OpenAI given the full conversation history.
 * Internally runs a tool-use loop: tool calls are executed and results
 * fed back until OpenAI produces a final text reply. The caller (index.ts)
 * sees no change — the function signature is identical.
 */
export async function generateReply(history) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s total timeout
    // Accumulate token usage across all loop iterations
    const totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    // Build a mutable message array. history is never mutated — tool protocol
    // messages exist only within this call's scope.
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.map((m) => ({ role: m.role, content: m.content })),
    ];
    try {
        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const response = await client.chat.completions.create({
                model: 'gpt-4o',
                messages,
                tools: OPENAI_TOOLS,
                tool_choice: 'auto',
            }, { signal: controller.signal });
            // Accumulate usage across iterations
            if (response.usage) {
                totalUsage.prompt_tokens += response.usage.prompt_tokens;
                totalUsage.completion_tokens += response.usage.completion_tokens;
                totalUsage.total_tokens += response.usage.total_tokens;
            }
            const choice = response.choices[0];
            const message = choice?.message;
            if (choice?.finish_reason === 'tool_calls' && message?.tool_calls?.length) {
                // Append the assistant message (contains tool_calls) to the thread
                messages.push(message);
                // Execute each tool and append the result
                for (const toolCall of message.tool_calls) {
                    if (toolCall.type !== 'function')
                        continue;
                    const fn = toolCall.function;
                    console.log(`[openai] Tool requested: ${fn.name}(${fn.arguments})`);
                    const result = await executeTool(fn.name, fn.arguments);
                    console.log(`[openai] Tool result: ${result}`);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result,
                    });
                }
                // Loop back — OpenAI sees the tool results and produces the next reply
                continue;
            }
            // Final text reply
            clearTimeout(timeoutId);
            const reply = message?.content;
            if (!reply) {
                throw new Error('Unexpected empty response from OpenAI');
            }
            return { reply, usage: totalUsage };
        }
        clearTimeout(timeoutId);
        throw new Error('Tool-use loop exceeded maximum iterations without a final reply');
    }
    catch (error) {
        clearTimeout(timeoutId);
        console.error('[openai] API Error:', error);
        if (error.response) {
            console.error('[openai] Response data:', error.response.data);
        }
        throw error;
    }
}
