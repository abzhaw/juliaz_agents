/**
 * Grader 1: Tool Selection Accuracy (Deterministic)
 *
 * Checks whether the right tools were called (or correctly not called)
 * based on keyword patterns in the user message.
 */

import type { Grader, GradeResult, InteractionRecord } from './types.js';

interface Rule {
    pattern: RegExp;
    expectedTool: string;
    direction: 'should_use' | 'should_not_use';
    label: string;
}

const RULES: Rule[] = [
    // Should use send_email
    { pattern: /\b(send|write|draft)\s+(an?\s+)?email\b/i, expectedTool: 'send_email', direction: 'should_use', label: 'send email' },
    { pattern: /\bemail\s+(to|him|her|them)\b/i, expectedTool: 'send_email', direction: 'should_use', label: 'email to someone' },

    // Should use fetch_email
    { pattern: /\b(check|read|fetch|get)\s+(my\s+)?(email|inbox|mail)\b/i, expectedTool: 'fetch_email', direction: 'should_use', label: 'check email' },
    { pattern: /\binbox\b/i, expectedTool: 'fetch_email', direction: 'should_use', label: 'inbox' },

    // Should use manage_tasks
    { pattern: /\b(task|todo|to-do)\b/i, expectedTool: 'manage_tasks', direction: 'should_use', label: 'task management' },
    { pattern: /\bwhat.*(work|do|should)\b.*\b(on|next)\b/i, expectedTool: 'manage_tasks', direction: 'should_use', label: 'what to work on' },

    // Should use ask_claude
    { pattern: /\b(delegate|deep\s+analysis|code\s+review|review\s+this\s+code)\b/i, expectedTool: 'ask_claude', direction: 'should_use', label: 'delegation' },

    // Should use send_telegram_message
    { pattern: /\b(send|message)\b.*\btelegram\b/i, expectedTool: 'send_telegram_message', direction: 'should_use', label: 'send telegram' },
];

// Messages that should NOT trigger any tool
const NO_TOOL_PATTERNS = [
    /^(hi|hello|hey|good\s+(morning|evening|night)|thanks|thank\s+you|bye|goodbye)\s*[!?.]*$/i,
    /^how\s+are\s+you\b/i,
    /^what('s|\s+is)\s+your\s+name\b/i,
];

export const toolSelectionGrader: Grader = {
    name: 'tool_selection',

    async grade(interaction: InteractionRecord): Promise<GradeResult> {
        const { userMessage, toolCalls } = interaction;
        const toolsUsed = new Set(toolCalls.map(tc => tc.name));
        const failures: string[] = [];
        let matchedRules = 0;
        let passedRules = 0;

        // Check positive rules (should_use)
        for (const rule of RULES) {
            if (!rule.pattern.test(userMessage)) continue;
            matchedRules++;

            if (rule.direction === 'should_use') {
                if (toolsUsed.has(rule.expectedTool)) {
                    passedRules++;
                } else {
                    failures.push(`Expected ${rule.expectedTool} for "${rule.label}" but it was not called`);
                }
            }
        }

        // Check no-tool patterns
        for (const pattern of NO_TOOL_PATTERNS) {
            if (!pattern.test(userMessage.trim())) continue;
            matchedRules++;

            if (toolCalls.length === 0) {
                passedRules++;
            } else {
                failures.push(`Simple greeting/farewell should not trigger tools, but ${toolCalls.map(t => t.name).join(', ')} was called`);
            }
        }

        // If no rules matched, this grader is not applicable
        if (matchedRules === 0) {
            return { graderName: 'tool_selection', score: null, passed: true, reasoning: 'No matching rules for this message' };
        }

        const score = passedRules / matchedRules;
        const passed = score >= 0.75;

        return {
            graderName: 'tool_selection',
            score,
            passed,
            reasoning: failures.length > 0 ? failures.join('; ') : 'All tool selection rules passed',
            suggestion: failures.length > 0 ? `Improve tool selection: ${failures[0]}` : undefined,
        };
    },
};
