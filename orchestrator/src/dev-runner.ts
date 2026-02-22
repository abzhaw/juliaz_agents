/**
 * Dev Runner — pulls latest code from GitHub and restarts all services.
 *
 * Triggered by the /dev slash command in Telegram.
 * Flow: git pull origin main → npm install → docker rebuild → pm2 restart all.
 *
 * Safety: Only Raphael's chatId can trigger this (checked in index.ts).
 * The pm2 restart at the end kills the orchestrator — PM2 brings it back up.
 */

import { spawnSync, spawn } from 'child_process';
import { postReply } from './bridge.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_ROOT = '/Users/raphael/Documents/Devs/juliaz_agents';
const PM2_SERVICES = ['orchestrator', 'bridge', 'frontend', 'cowork-mcp'];

// ─── State ───────────────────────────────────────────────────────────────────

let deploying = false;
let deployStart: Date | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

export function isRunning(): boolean {
    return deploying;
}

export function getStatus(): { running: boolean; startedAt?: string; elapsedSeconds?: number } {
    if (!deploying || !deployStart) return { running: false };
    return {
        running: true,
        startedAt: deployStart.toISOString(),
        elapsedSeconds: Math.round((Date.now() - deployStart.getTime()) / 1000),
    };
}

export async function startDeploy(chatId: string): Promise<void> {
    if (deploying) {
        await postReply(chatId, '⚠️ Deploy already in progress. Use /dev-status to check.');
        return;
    }

    deploying = true;
    deployStart = new Date();
    log('Deploy started');

    try {
        await postReply(chatId, '🚀 Pulling from origin/main...');

        // 1. Git pull
        const pullResult = run('git', ['pull', 'origin', 'main']);

        if (pullResult.includes('Already up to date')) {
            deploying = false;
            deployStart = null;
            log('Already up to date — nothing to deploy');
            await postReply(chatId, '✅ Already up to date. No changes to deploy.');
            return;
        }

        await postReply(chatId, `📥 ${truncate(pullResult, 500)}\n\nInstalling deps & rebuilding...`);

        // 2. npm install in each service
        for (const svc of [...PM2_SERVICES, 'backend']) {
            log(`npm install in ${svc}/`);
            run('npm', ['install', '--silent'], `${PROJECT_ROOT}/${svc}`);
        }

        // 3. Docker backend rebuild
        log('Rebuilding backend Docker container');
        run('docker', ['compose', 'up', '-d', '--build'], `${PROJECT_ROOT}/backend`);

        // 4. Send success BEFORE pm2 restart (restart kills us)
        const elapsed = formatElapsed(deployStart);
        log(`Deploy complete in ${elapsed} — restarting PM2 services`);
        await postReply(chatId, `✅ Deploy complete (${elapsed}). Restarting all services...`);

        // 5. Brief delay to ensure the message is delivered
        await new Promise(r => setTimeout(r, 1000));

        // 6. pm2 restart — detached so it survives our death
        const child = spawn('pm2', ['restart', 'all'], {
            detached: true,
            stdio: 'ignore',
        });
        child.unref();
        // After this, the orchestrator process will be killed by PM2 and restarted.

    } catch (err: any) {
        deploying = false;
        deployStart = null;
        log(`Deploy failed: ${err.message}`);
        await safeReply(chatId, `❌ Deploy failed:\n${err.message}`);
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[], cwd?: string): string {
    const result = spawnSync(cmd, args, {
        cwd: cwd ?? PROJECT_ROOT,
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env },
    });

    if (result.error) throw result.error;

    if (result.status !== 0) {
        const stderr = result.stderr?.trim() || '(no stderr)';
        throw new Error(`${cmd} ${args.join(' ')} failed (exit ${result.status}):\n${stderr}`);
    }

    return result.stdout?.trim() ?? '';
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '\n... (truncated)';
}

function formatElapsed(startedAt: Date): string {
    const seconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
}

async function safeReply(chatId: string, text: string): Promise<void> {
    try {
        await postReply(chatId, text);
    } catch (err) {
        log(`Failed to send deploy result to ${chatId}: ${err}`);
    }
}

function log(msg: string): void {
    console.log(`[dev-runner] ${new Date().toISOString()} — ${msg}`);
}
