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
            env: {
                NODE_ENV: 'production',
            }
        },
        {
            name: 'bridge',
            cwd: './bridge',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
            }
        },
        {
            name: 'orchestrator',
            cwd: './orchestrator',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
            }
        },
        {
            name: 'backend',
            cwd: './backend',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
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
            env: {
                NODE_ENV: 'production',
                COWORK_MCP_PORT: '3003',
                ...secrets
            }
        }
    ]
};
