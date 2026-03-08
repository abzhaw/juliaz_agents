/**
 * Grader 2: Parameter Correctness (Deterministic)
 *
 * Validates that tool call parameters are structurally correct:
 * valid email formats, required fields present, enum values valid, etc.
 */

import type { Grader, GradeResult, InteractionRecord, ToolCall } from './types.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParamCheck {
    valid: boolean;
    issue?: string;
}

function checkSendEmail(args: Record<string, unknown>): ParamCheck[] {
    const checks: ParamCheck[] = [];

    const to = String(args.to ?? '');
    const emails = to.split(',').map(e => e.trim());
    checks.push({
        valid: emails.every(e => EMAIL_RE.test(e)),
        issue: emails.some(e => !EMAIL_RE.test(e)) ? `Invalid email format: "${to}"` : undefined,
    });

    checks.push({
        valid: typeof args.subject === 'string' && args.subject.length > 0,
        issue: !args.subject ? 'Missing or empty subject' : undefined,
    });

    checks.push({
        valid: typeof args.body === 'string' && args.body.length > 0,
        issue: !args.body ? 'Missing or empty body' : undefined,
    });

    return checks;
}

function checkManageTasks(args: Record<string, unknown>): ParamCheck[] {
    const checks: ParamCheck[] = [];
    const validActions = ['list', 'create', 'update', 'next', 'delete'];
    const action = String(args.action ?? '');

    checks.push({
        valid: validActions.includes(action),
        issue: !validActions.includes(action) ? `Invalid action "${action}", expected one of: ${validActions.join(', ')}` : undefined,
    });

    // Actions that require task_id
    if (['update', 'delete'].includes(action)) {
        checks.push({
            valid: typeof args.task_id === 'string' && args.task_id.length > 0,
            issue: !args.task_id ? `Action "${action}" requires task_id` : undefined,
        });
    }

    // Create requires title
    if (action === 'create') {
        checks.push({
            valid: typeof args.title === 'string' && args.title.length > 0,
            issue: !args.title ? 'Action "create" requires title' : undefined,
        });
    }

    return checks;
}

function checkAskClaude(args: Record<string, unknown>): ParamCheck[] {
    const checks: ParamCheck[] = [];
    const task = String(args.task ?? '');

    checks.push({
        valid: task.length >= 20,
        issue: task.length < 20 ? `Delegation task too short (${task.length} chars) — trivial questions should not be delegated` : undefined,
    });

    return checks;
}

function checkSendTelegram(args: Record<string, unknown>): ParamCheck[] {
    const checks: ParamCheck[] = [];

    const chatId = String(args.chatId ?? '');
    checks.push({
        valid: chatId === 'raphael' || /^\d+$/.test(chatId),
        issue: chatId !== 'raphael' && !/^\d+$/.test(chatId) ? `Invalid chatId "${chatId}"` : undefined,
    });

    checks.push({
        valid: typeof args.text === 'string' && args.text.length > 0,
        issue: !args.text ? 'Missing or empty message text' : undefined,
    });

    return checks;
}

function checkFetchEmail(args: Record<string, unknown>): ParamCheck[] {
    // fetch_email has no required params — always passes
    return [{ valid: true }];
}

const CHECKERS: Record<string, (args: Record<string, unknown>) => ParamCheck[]> = {
    send_email: checkSendEmail,
    manage_tasks: checkManageTasks,
    ask_claude: checkAskClaude,
    send_telegram_message: checkSendTelegram,
    fetch_email: checkFetchEmail,
};

export const paramCorrectnessGrader: Grader = {
    name: 'param_correctness',

    async grade(interaction: InteractionRecord): Promise<GradeResult> {
        const { toolCalls } = interaction;

        if (toolCalls.length === 0) {
            return { graderName: 'param_correctness', score: null, passed: true, reasoning: 'No tool calls to validate' };
        }

        const allChecks: ParamCheck[] = [];
        const failures: string[] = [];

        for (const tc of toolCalls) {
            const checker = CHECKERS[tc.name];
            if (!checker) continue; // unknown tool, skip

            const checks = checker(tc.args);
            allChecks.push(...checks);
            for (const c of checks) {
                if (!c.valid && c.issue) failures.push(`${tc.name}: ${c.issue}`);
            }
        }

        if (allChecks.length === 0) {
            return { graderName: 'param_correctness', score: null, passed: true, reasoning: 'No known tools to validate' };
        }

        const validCount = allChecks.filter(c => c.valid).length;
        const score = validCount / allChecks.length;
        const passed = score >= 0.75;

        return {
            graderName: 'param_correctness',
            score,
            passed,
            reasoning: failures.length > 0 ? failures.join('; ') : 'All parameters valid',
            suggestion: failures.length > 0 ? `Fix parameter issues: ${failures[0]}` : undefined,
        };
    },
};
