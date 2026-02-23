const fs = require('fs');
const path = require('path');

let secrets = {};
try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env.secrets'), 'utf-8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length > 1 && parts[0].trim()) {
            secrets[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    });
} catch (e) { }

module.exports = {
    apps: [
        {
            name: 'frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'run start',
            restart_delay: 3000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
            }
        },
        {
            name: 'bridge',
            cwd: './bridge',
            script: 'npm',
            args: 'run start',
            restart_delay: 3000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
            }
        },
        {
            name: 'orchestrator',
            cwd: './orchestrator',
            script: 'npm',
            args: 'run start',
            restart_delay: 5000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
                ...secrets
            }
        },
        // backend managed by Docker via PM2 — runs in foreground so PM2 can track it
        {
            name: 'backend-docker',
            cwd: './backend',
            script: '/usr/local/bin/docker',
            args: 'compose up',
            restart_delay: 10000,
            exp_backoff_restart_delay: 100,
            max_restarts: 5,
            env: {
                PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
            }
        },
        {
            // Cowork MCP Server — Claude as a multimodal sub-agent (port 3003)
            // Exposes claude_task, claude_multimodal_task, claude_code_review,
            // claude_summarize, claude_brainstorm, cowork_status via MCP/HTTP
            name: 'cowork-mcp',
            cwd: './cowork-mcp',
            script: 'npm',
            args: 'run start',
            restart_delay: 3000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
                COWORK_MCP_PORT: '3003',
                ...secrets
            }
        },
        // Sentinel — Daily security scanner (runs at 07:00 every morning)
        // Produces reports in security-agent/reports/ and sends Telegram summary
        {
            name: 'sentinel',
            cwd: './security-agent',
            script: './scripts/daily-report.sh',
            interpreter: '/bin/bash',
            autorestart: false,       // one-shot script, don't restart after exit
            cron_restart: '0 7 * * *', // re-run every day at 07:00
            watch: false,
            env: {
                PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
                ...secrets
            }
        },
        // Task Manager — Checks task queue integrity every 6 hours
        // Detects stale tasks, auto-unblocks resolved dependencies, weekly summary on Mondays
        {
            name: 'task-manager',
            cwd: './task-manager',
            script: './scripts/task_check.sh',
            interpreter: '/bin/bash',
            autorestart: false,
            cron_restart: '0 */6 * * *', // every 6 hours
            watch: false,
            env: {
                PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
                ...secrets
            }
        },
        // Health Checker — Monitors all services every 15 minutes
        // Auto-restarts stopped PM2 processes, alerts on failures, silent when healthy
        {
            name: 'health-checker',
            cwd: './health-checker',
            script: './scripts/health_check.sh',
            interpreter: '/bin/bash',
            autorestart: false,
            cron_restart: '*/15 * * * *', // every 15 minutes
            watch: false,
            env: {
                PATH: '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
                ...secrets
            }
        }
    ]
};
