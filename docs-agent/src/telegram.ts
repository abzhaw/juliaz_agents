import { createHash } from 'crypto';

/**
 * TelegramSender handles digest delivery with built-in safety:
 * - Circuit breaker: max 6 messages per hour
 * - Dedup: identical digests are not sent twice
 * - Graceful failure: returns false on error, never throws
 *
 * Reused from analyst/src/telegram.ts with docs-agent log prefix.
 */

interface CadenceInfo {
  messages_this_hour: number;
  last_digest_hash: string;
}

export class TelegramSender {
  private static readonly CIRCUIT_BREAKER_LIMIT = 6;
  private token: string;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.token = token;
    this.chatId = chatId;
  }

  async send(digest: string, cadence: CadenceInfo): Promise<boolean> {
    // Circuit breaker: max 6 messages per hour
    if (cadence.messages_this_hour >= TelegramSender.CIRCUIT_BREAKER_LIMIT) {
      console.log('[docs-agent] Circuit breaker: 6 messages this hour, skipping');
      return false;
    }

    // Dedup: don't send exact same digest twice
    const hash = createHash('md5').update(digest).digest('hex').slice(0, 8);
    if (hash === cadence.last_digest_hash) {
      console.log('[docs-agent] Dedup: identical digest, skipping');
      return false;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: digest,
            parse_mode: 'Markdown',
          }),
        }
      );

      const data = await response.json() as { ok: boolean; description?: string };
      if (data.ok) {
        console.log('[docs-agent] Digest sent to Telegram');
        return true;
      } else {
        console.log('[docs-agent] Telegram API error:', data.description || 'unknown');
        return false;
      }
    } catch (e) {
      console.log('[docs-agent] Telegram send failed:', (e as Error).message);
      return false;
    }
  }

  /**
   * Compute the MD5 hash of a digest for dedup tracking.
   */
  static hashDigest(digest: string): string {
    return createHash('md5').update(digest).digest('hex').slice(0, 8);
  }
}
