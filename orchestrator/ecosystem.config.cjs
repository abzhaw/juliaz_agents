const fs = require('fs');
const path = require('path');

// Parse .env file and inject into pm2 env at config-load time
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=#\s][^=]*)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });
}

module.exports = {
  apps: [{
    name: 'julia-orchestrator',
    script: 'node_modules/.bin/tsx',
    args: 'src/index.ts',
    cwd: __dirname,
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: { NODE_ENV: 'production', ...env },
    out_file: '../orchestrator.log',
    error_file: '../orchestrator-error.log',
    time: true,
  }]
};
