---
name: environment-config
description: .env files, secrets management, multi-environment configs, and never-commit rules. Use when dealing with API keys, environment variables, or setting up new services in Julia.
---

# Environment Config

## File Structure (Julia)
```
.env.example     ← template, committed to git (no real values)
.env.secrets     ← actual secrets, NEVER committed
.gitignore       ← must include .env.secrets
```

## .env.example (always up to date)
```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Telegram
TELEGRAM_BOT_TOKEN=...
RAPHAEL_CHAT_ID=...

# Backend
DATABASE_URL=postgresql://postgres:password@localhost:5432/julia

# Ports
BRIDGE_PORT=3001
FRONTEND_PORT=3002
COWORK_MCP_PORT=3003
```

## Loading in Node.js
```ts
import 'dotenv/config';  // auto-loads .env and .env.local
// Or manually:
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.secrets' });
```

## ecosystem.config.js (load secrets into PM2)
```js
const fs = require('fs');
let secrets = {};
try {
  const content = fs.readFileSync('.env.secrets', 'utf-8');
  content.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k?.trim()) secrets[k.trim()] = v.join('=').trim();
  });
} catch {}
// Then spread into app env: { ...secrets }
```

## Rules
- ✅ Always add new env vars to `.env.example` with placeholder values
- ✅ Always add `.env.secrets` to `.gitignore`
- ❌ Never commit `.env.secrets` or any file with real API keys
- ❌ Never log env vars — redact if needed: `key.slice(0,8) + '...'`
- ✅ Validate required vars on startup and fail fast with a clear error
