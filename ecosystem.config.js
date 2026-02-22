module.exports = {
    apps: [
        {
            name: 'julia-orchestrator',
            cwd: './orchestrator',
            script: 'npm',
            args: 'run dev',
            restart_delay: 5000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            env: {
                NODE_ENV: 'development',
            },
        },
        {
            name: 'julia-bridge',
            cwd: './bridge',
            script: 'npm',
            args: 'run dev',
            restart_delay: 3000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            env: {
                NODE_ENV: 'development',
            },
        },
    ],
};
