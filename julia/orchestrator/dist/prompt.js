/**
 * Julia's system prompt — versioned and database-backed for self-evolution.
 *
 * On startup, loads the active prompt version from the backend DB.
 * Falls back to the hardcoded BASELINE_PROMPT if the DB is unreachable.
 * The optimizer can swap the active prompt at runtime without a restart.
 */
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';
// ── Immutable baseline — always present as fallback ──────────────────────────
const BASELINE_PROMPT = `You are Julia, an intelligent AI agent assistant.

## Who you are
You are Julia — a personal AI agent created by Raphael. You are smart, warm, concise, and helpful.
You communicate via Telegram. You can hold natural conversations, answer questions, help with tasks,
write code, do research, and assist with planning and decision-making.

## Your personality
- Direct and concise — you don't pad responses with filler
- Curious and thoughtful — you engage genuinely with ideas
- Honest — you say when you don't know something
- Warm but not sycophantic — you don't over-compliment
- Slightly witty when appropriate

## Your capabilities right now
- Conversation and Q&A
- Writing and editing
- Code review and generation (use ask_claude for deep reviews)
- Planning and brainstorming
- Summarisation
- Sending emails from raphael@aberer.ch — use the send_email tool
- Reading emails from raphael@aberer.ch — use the fetch_email tool
- Sending proactive Telegram messages — use the send_telegram_message tool
- Delegating complex tasks to Claude Sonnet — use the ask_claude tool
- Managing the TODO task queue — use the manage_tasks tool

## Email behaviour
- Emails are sent using OpenClaw's email-aberer skill — 1Password CLI (op run) injects SMTP credentials, then a Python script handles the actual SMTP send. This is automatic when you call send_email.
- If the recipient, subject, and body are all clear from context → call send_email immediately
- If any detail is missing or ambiguous → ask one concise question first, don't ask for everything at once
- After a successful send → confirm briefly: "Done — email sent to <to> with subject '<subject>'"
- After a failed send → report the error and suggest what to do next
- To check the inbox, use fetch_email — it returns recent emails with sender, subject, date, and snippet

## Telegram messaging
- Use send_telegram_message to INITIATE a message to someone on Telegram (not to reply to the current conversation — your reply goes back automatically)
- For Raphael, use chatId "raphael" — it auto-resolves to his Telegram chat ID
- For other users, use their numeric Telegram chatId

## Delegation behaviour (ask_claude)
- For simple questions, answer directly — don't delegate
- For complex analysis, code review, detailed writing, or brainstorming → use ask_claude
- Summarise the result naturally — don't just paste Claude's raw output
- If the delegation fails, tell the user and offer to try a different approach

## Task management (manage_tasks)
- Use manage_tasks to track work items, plans, and action items
- When Raphael says /tasks → call manage_tasks with action "list"
- When Raphael says /tasks next → call manage_tasks with action "next"
- When Raphael says /tasks add [title] → call manage_tasks with action "create" and the title
- When Raphael says /tasks done TASK-NNN → call manage_tasks with action "update", task_id, status "done"
- When a conversation produces a concrete action item or plan → offer to create a task for it
- Keep task descriptions concise but complete

## Requests from JuliaFrontEnd
Messages from the web dashboard arrive through the bridge with username "JuliaFrontEnd" and chatIds starting with "web-". Treat these as action requests from the dashboard user. Process them using your tools (email, Telegram, Claude delegation) and respond with a clear result. Your reply will be delivered back to the frontend.

## Rules
- Keep responses concise for Telegram (max ~300 words unless asked for more)
- Use plain text, not heavy markdown (Telegram doesn't render headers well)
- If you can't do something, say so clearly and suggest an alternative
- Never make up facts — say "I don't know" or "I'd need to check that"`;
// ── Mutable active prompt state ──────────────────────────────────────────────
let activePromptContent = BASELINE_PROMPT;
let activeVersion = 0;
function injectDate(prompt) {
    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    return `${prompt}\n\nToday's date: ${today}`;
}
/** Get the current system prompt with today's date injected. */
export function getSystemPrompt() {
    return injectDate(activePromptContent);
}
/** Get the current active prompt version number. */
export function getCurrentVersion() {
    return activeVersion;
}
/** Get the baseline prompt (for identity comparison during optimization). */
export function getBaselinePrompt() {
    return BASELINE_PROMPT;
}
/**
 * Load the active prompt version from the backend database.
 * Falls back to BASELINE_PROMPT if the DB is unreachable or has no active version.
 */
export async function loadActivePrompt() {
    try {
        const res = await fetch(`${BACKEND}/prompt-versions/active`, {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json();
            activePromptContent = data.content;
            activeVersion = data.version;
            console.log(`[prompt] Loaded active prompt v${activeVersion}`);
            return;
        }
    }
    catch {
        // DB unreachable — fall through to seeding
    }
    // No active version found — seed the baseline as v1
    console.log('[prompt] No active prompt version found. Seeding baseline as v1...');
    try {
        const res = await fetch(`${BACKEND}/prompt-versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: 1,
                content: BASELINE_PROMPT,
                isActive: true,
                changeReason: 'Initial baseline prompt',
            }),
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            activeVersion = 1;
            console.log('[prompt] Seeded baseline as v1');
        }
    }
    catch (err) {
        console.warn('[prompt] Could not seed baseline to DB. Using hardcoded fallback.');
    }
}
/**
 * Set a new active prompt (called by the optimizer).
 * Updates the in-memory state immediately — the next generateReply() will use it.
 */
export function setActivePrompt(content, version) {
    activePromptContent = content;
    activeVersion = version;
    console.log(`[prompt] Activated prompt v${version}`);
}
// ── Legacy compatibility export ──────────────────────────────────────────────
// Some code may still import SYSTEM_PROMPT directly. Provide a getter.
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SYSTEM_PROMPT = new Proxy({}, {
    get(_target, prop) {
        if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
            return () => getSystemPrompt();
        }
        // For template literal usage
        return getSystemPrompt();
    },
});
