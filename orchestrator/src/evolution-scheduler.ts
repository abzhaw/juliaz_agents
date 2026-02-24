/**
 * Evolution Scheduler — triggers the prompt optimizer on a regular cadence.
 *
 * Default: every 6 hours. Configurable via EVOLUTION_INTERVAL_MS env var.
 * Pattern follows letter-scheduler.ts.
 */

import { optimizePrompt } from './optimizer.js';

const DEFAULT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startEvolutionScheduler(): void {
    const intervalMs = Number(process.env.EVOLUTION_INTERVAL_MS) || DEFAULT_INTERVAL;
    const hours = (intervalMs / 3_600_000).toFixed(1);

    console.log(`[evolution] Scheduler started — running every ${hours}h`);

    // Run first optimization after a short delay (let the system warm up)
    setTimeout(() => {
        optimizePrompt().catch(err => {
            console.error('[evolution] Initial optimization error:', err);
        });
    }, 60_000); // 1 minute after startup

    intervalId = setInterval(() => {
        optimizePrompt().catch(err => {
            console.error('[evolution] Scheduled optimization error:', err);
        });
    }, intervalMs);
}

export function stopEvolutionScheduler(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[evolution] Scheduler stopped');
    }
}
