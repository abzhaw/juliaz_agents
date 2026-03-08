---
name: credential-audit
description: Scan all project files for exposed secrets, tokens, and credentials — including git history
---

# Skill: Credential Audit

## Purpose
Secrets leak in three ways: hardcoded in source files, committed to git history, or accidentally written to log files. This skill catches all three.

## What It Checks

### 1. Source File Scan
- Scan for patterns that look like API keys, tokens, passwords
- Check all `.ts`, `.js`, `.json`, `.yml`, `.yaml`, `.sh`, `.env*` files
- Exclude `node_modules/`, `.git/`, `dist/`

### 2. Git History Scan
- Check recent commits for accidentally committed secrets
- Look for `.env` files ever committed to git

### 3. Log File Scan
- Check PM2 logs, startup logs for accidental secret printing
- Look for tokens/keys in log output

### 4. Permissions Check
- `.env.secrets` should be `600` (owner read/write only)
- `start-system.sh` should be `700`

## Patterns to Detect
```regex
sk-[a-zA-Z0-9]{32,}           # OpenAI API key
AIza[0-9A-Za-z_-]{35}         # Google API key
[0-9]{10}:[A-Za-z0-9_-]{35}   # Telegram bot token
op_[a-zA-Z0-9]{32,}           # 1Password service token
password\s*=\s*["'][^"']+["'] # Hardcoded password
```

## Commands
```bash
# Scan for common secret patterns
grep -rE "(sk-|AIza|password\s*=|token\s*=|secret\s*=)" \
  /Users/raphael/juliaz_agents \
  --include="*.ts" --include="*.js" --include="*.sh" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  -l 2>/dev/null

# Check if .env files were ever committed  
git -C /Users/raphael/juliaz_agents log --all --full-history -- "**/.env*" 2>/dev/null

# Check file permissions
stat -f "%Sp %N" /Users/raphael/juliaz_agents/.env.secrets 2>/dev/null
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| API key in source file | 🔴 Critical |
| Secret in git history | 🔴 Critical |
| Secret in log file | 🟠 High |
| .env file world-readable | 🟠 High |
| Suspicious pattern (possible token) | 🟡 Medium |

## Output Format
```
CREDENTIAL AUDIT
✅ No secrets found in source files
🔴 Telegram token found in orchestrator/logs/pm2-out.log (line 245)
⚠️  .env.secrets permissions: 644 (should be 600)
```
