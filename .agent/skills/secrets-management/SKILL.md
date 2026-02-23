---
name: secrets-management
description: Vault patterns, .env.secrets, credential rotation, never-commit rules. Use when handling API keys, tokens, or any sensitive credentials in the Julia system.
---

# Secrets Management

## Principles
1. **Never commit secrets** — use `.gitignore` religiously
2. **Rotate regularly** — especially after any leak suspicion
3. **Least privilege** — each service only gets the keys it needs
4. **Validate at startup** — fail fast if a required key is missing
5. **Redact in logs** — never log full key values

## Julia's Secret Inventory
```bash
# .env.secrets (never committed)
OPENAI_API_KEY=sk-...            # orchestrator + frontend
ANTHROPIC_API_KEY=sk-ant-...     # cowork-mcp
TELEGRAM_BOT_TOKEN=...           # openclaw
RAPHAEL_CHAT_ID=...              # escalation target
DATABASE_URL=postgresql://...    # backend (Docker internal)
```

## Startup Validation
```ts
const REQUIRED_VARS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}
```

## Git Protection
```bash
# .gitignore — MUST contain:
.env.secrets
.env.local
*.key
*.pem
```

## If a Secret is Leaked
1. Immediately rotate the key (generate new one in provider dashboard)
2. Update `.env.secrets` with new value
3. Restart affected services: `pm2 restart all`
4. Audit git history: `git log --all -S "old-key-prefix"`
5. If committed: use `git filter-repo` to scrub history

## Credential Rotation Schedule
- API keys: every 90 days or on team member change
- DB passwords: every 180 days
- Telegram tokens: rotate if bot was ever exposed
