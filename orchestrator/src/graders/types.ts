/**
 * Shared types for the self-evolution grading system.
 */

export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
    result: string;
}

export interface InteractionRecord {
    chatId: string;
    userMessage: string;
    conversationContext: string[];   // last 3 turns
    toolCalls: ToolCall[];
    finalReply: string;
    model: string;
    promptVersion: number;
}

export interface GradeResult {
    graderName: string;
    score: number | null;   // 0.0–1.0, null if not applicable
    passed: boolean;
    reasoning?: string;
    suggestion?: string;
}

export interface Grader {
    name: string;
    grade(interaction: InteractionRecord): Promise<GradeResult>;
}
