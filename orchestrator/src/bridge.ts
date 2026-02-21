/**
 * Bridge client — REST calls to the Julia-OpenClaw bridge (localhost:3001).
 */

const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:3001';

export interface PendingMessage {
    id: string;
    chatId: string;
    userId: string;
    username: string;
    text: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'replied';
}

/** Fetch all messages currently in 'pending' state and mark them as 'processing'. */
export async function fetchPendingMessages(): Promise<PendingMessage[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(`${BRIDGE_URL}/consume?target=julia`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Bridge /consume returned ${res.status}`);
        const data = await res.json() as { messages: PendingMessage[] };
        return data.messages || [];
    } catch (e: any) {
        clearTimeout(timeoutId);
        throw e;
    }
}

/** Send a reply for a given chatId through the bridge. */
export async function sendReply(chatId: string, messageId: string, text: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(`${BRIDGE_URL}/incoming`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, text }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Bridge reply failed (${res.status}): ${body}`);
        }
    } catch (e) {
        clearTimeout(timeoutId);
        throw e;
    }
}

/**
 * Post a reply directly to the bridge reply store.
 * The bridge exposes REST for this via a reply queue that OpenClaw polls.
 */
export async function postReply(chatId: string, text: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(`${BRIDGE_URL}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, text }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            log(`Bridge /reply not available (${res.status}) — reply not delivered`);
            return;
        }
        log(`Reply posted for chat ${chatId}`);
    } catch (e) {
        clearTimeout(timeoutId);
        log(`Bridge /reply failed: ${e}`);
    }
}

export async function checkHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${BRIDGE_URL}/health`);
        return res.ok;
    } catch {
        return false;
    }
}

function log(msg: string): void {
    console.log(`[bridge] ${msg}`);
}
