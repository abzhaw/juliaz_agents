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

/**
 * Post a reply to the bridge reply store with retry logic.
 * The bridge exposes REST for this via a reply queue that OpenClaw polls.
 * Throws on persistent failure so callers can handle it (e.g. send error to user).
 */
export async function postReply(chatId: string, text: string, messageId?: string): Promise<void> {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const res = await fetch(`${BRIDGE_URL}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, text, messageId }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) {
                throw new Error(`Bridge /reply returned ${res.status}`);
            }
            log(`Reply posted for chat ${chatId}`);
            return;
        } catch (e) {
            clearTimeout(timeoutId);
            if (attempt < MAX_RETRIES - 1) {
                const delay = 1000 * Math.pow(2, attempt);
                log(`Bridge /reply attempt ${attempt + 1} failed: ${e}. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                log(`Bridge /reply failed after ${MAX_RETRIES} attempts: ${e}`);
                throw e;
            }
        }
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
