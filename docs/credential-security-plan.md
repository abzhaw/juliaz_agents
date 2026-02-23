# Credential Security Plan — juliaz_agents

**Silver Lining:** We are replacing broad 1Password CLI access with a scoped service account + Telegram approval flow, so that Raphael stays in control of credential access from his phone without being chained to his laptop.

**Date:** 2026-02-23
**Status:** Plan — awaiting implementation

---

## Problem

Today, OpenClaw has `Bash(op:*)` in its Claude Code permissions, meaning it can run *any* 1Password CLI command — including reading items from any vault. The orchestrator uses `op run` to inject SMTP credentials for email, which is fine, but the permission scope is far too broad. Additionally, `.env.secrets` stores API keys in plain text on disk.

## Goals

1. **Scope down 1Password access** — only the credentials juliaz_agents actually needs
2. **Remove runtime `op` access** from OpenClaw and the orchestrator entirely
3. **Add a Telegram-based approval flow** — when the system needs a new credential or sensitive action, it asks Raphael via Telegram and waits for approval
4. **Keep it simple** — no new databases, no custom crypto, no reinventing the wheel

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  1Password   │     │  Credential  │     │   Orchestrator   │
│  Service     │────▸│  Injector    │────▸│   (env vars)     │
│  Account     │     │  (boot only) │     │                  │
│  (scoped)    │     └──────────────┘     │  Tools:          │
└─────────────┘                           │  - send_email    │
                                          │  - fetch_email   │
      ┌───────────────────────────────────│  - ask_claude    │
      │  NEW: credential_request tool     │  - send_telegram │
      │                                   │  - credential_   │
      │                                   │    request (NEW) │
      │                                   └──────────────────┘
      │
      ▼
┌─────────────┐  "I need SMTP     ┌──────────────┐
│  Telegram   │  credentials for  │   Raphael     │
│  (Bridge)   │  a new service.   │   (phone)     │
│             │  Approve?"        │               │
│             │◀─────────────────▸│  "yes" / "no" │
└─────────────┘                   └──────────────┘
```

---

## Part 1: Scoped 1Password Service Account

### What
Create a dedicated 1Password service account that can ONLY access a `juliaz-agents` vault containing the specific credentials the system needs.

### Steps

1. **Create a new vault in 1Password** called `juliaz-agents`
2. **Move/copy these items into it:**
   - SMTP credentials (for email sending/fetching)
   - Anthropic API key
   - OpenAI API key
   - Telegram bot token
   - Any future service credentials
3. **Create a 1Password Service Account:**
   - Go to: 1Password → Settings → Developer → Service Accounts
   - Name: `juliaz-agents-bot`
   - Grant access to ONLY the `juliaz-agents` vault (read-only)
   - Save the service account token securely
4. **Store the service account token** in a single env var:
   ```
   OP_SERVICE_ACCOUNT_TOKEN=ops_xxxxxxxxxxxx
   ```

### Why This Is Safe
- The service account can NEVER access your personal vault, banking credentials, Dashlane entries, or anything outside the `juliaz-agents` vault
- It's read-only — cannot create, modify, or delete items
- 1Password logs every access, so you have an audit trail
- Revoking access is instant — just disable the service account

---

## Part 2: Startup Credential Injection

### What
A boot script that runs once at system startup, pulls all needed credentials from the scoped 1Password vault, and injects them as environment variables into each PM2 service. After startup, no service has access to `op` at all.

### Implementation

**New file: `scripts/inject-credentials.sh`**

```bash
#!/bin/bash
# Pull credentials from 1Password at startup ONLY
# Services receive them as env vars — no runtime op access needed

set -euo pipefail

PROJECT_DIR="/Users/raphael/Documents/Devs/juliaz_agents"

# Requires OP_SERVICE_ACCOUNT_TOKEN in environment
if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
    echo "ERROR: OP_SERVICE_ACCOUNT_TOKEN not set"
    exit 1
fi

echo "[credentials] Fetching secrets from 1Password (juliaz-agents vault)..."

# Fetch each credential by item reference
# Format: op://vault-name/item-name/field
ANTHROPIC_KEY=$(op read "op://juliaz-agents/anthropic-api/credential" 2>/dev/null)
OPENAI_KEY=$(op read "op://juliaz-agents/openai-api/credential" 2>/dev/null)
TELEGRAM_TOKEN=$(op read "op://juliaz-agents/telegram-bot/token" 2>/dev/null)
SMTP_USER=$(op read "op://juliaz-agents/smtp-aberer/username" 2>/dev/null)
SMTP_PASS=$(op read "op://juliaz-agents/smtp-aberer/password" 2>/dev/null)
SMTP_HOST=$(op read "op://juliaz-agents/smtp-aberer/server" 2>/dev/null)
SMTP_PORT=$(op read "op://juliaz-agents/smtp-aberer/port" 2>/dev/null)
IMAP_HOST=$(op read "op://juliaz-agents/imap-aberer/server" 2>/dev/null)
IMAP_PORT=$(op read "op://juliaz-agents/imap-aberer/port" 2>/dev/null)

echo "[credentials] All secrets fetched successfully."

# Write a temporary env file that PM2 will source (in-memory tmpfs if available)
SECRETS_FILE="$PROJECT_DIR/.env.runtime"
cat > "$SECRETS_FILE" <<ENVEOF
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
OPENAI_API_KEY=$OPENAI_KEY
TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
IMAP_HOST=$IMAP_HOST
IMAP_PORT=$IMAP_PORT
ENVEOF

chmod 600 "$SECRETS_FILE"
echo "[credentials] Runtime env written to .env.runtime"
```

**Updated `ecosystem.config.js`** — read from `.env.runtime` instead of `.env.secrets`:

```javascript
// Load runtime secrets (populated by inject-credentials.sh at boot)
let secrets = {};
try {
    const envContent = fs.readFileSync(
        path.join(__dirname, '.env.runtime'), 'utf-8'
    );
    // ... same parsing logic ...
} catch (e) {
    console.warn('[PM2] No .env.runtime found — credentials unavailable');
}
```

**Updated `start-system.sh`** — inject credentials before starting PM2:

```bash
# ── 0. Inject credentials from 1Password ────────────────────────
echo "[0/3] Injecting credentials from 1Password..."
source "$PROJECT_DIR/scripts/inject-credentials.sh"

# ... rest of existing startup ...
```

### Changes to Email Tool

The `send_email` and `fetch_email` functions in `orchestrator/src/tools.ts` currently use `op run --env-file=...` at runtime. After this change, they'll read credentials from environment variables directly:

```typescript
// BEFORE (runtime 1Password access):
const result = spawnSync('op', ['run', `--env-file=${EMAIL_ENV_FILE}`, '--',
    'python3', EMAIL_SCRIPT, ...args]);

// AFTER (env vars injected at boot):
const result = spawnSync('python3', [EMAIL_SCRIPT, ...args], {
    env: {
        ...process.env,  // Already contains SMTP_USER, SMTP_PASS, etc.
    },
});
```

The Python email scripts will need a small update to read from env vars instead of expecting `op run` to provide them.

---

## Part 3: Telegram Approval Flow (credential_request tool)

### What
A new tool for Julia that lets her ask Raphael for approval via Telegram before performing sensitive actions. This covers scenarios like:

- "A new service needs an API key — can I access it?"
- "Someone asked me to send an email to an external address — approve?"
- "I want to access a credential I haven't used before — okay?"

### How It Works

```
1. Julia decides she needs approval for something
2. Julia calls credential_request(action, reason)
3. Orchestrator sends Telegram message to Raphael:
   "🔐 Approval needed:
    Action: Access SMTP credentials for new email provider
    Reason: User asked me to set up forwarding to gmail

    Reply /approve or /deny"
4. Raphael replies /approve or /deny on his phone
5. Orchestrator receives the reply, resolves the pending request
6. Julia proceeds or reports denial
```

### New Tool Definition

Add to `orchestrator/src/tools.ts`:

```typescript
{
    name: 'request_approval',
    description: [
        'Request approval from Raphael via Telegram for a sensitive action.',
        'Use this when you need to: access a new credential, perform an',
        'irreversible action, send external communications to new recipients,',
        'or do anything that feels like it should be double-checked.',
        'Returns "approved" or "denied". Wait for the response before proceeding.',
    ].join(' '),
    input_schema: {
        type: 'object' as const,
        properties: {
            action: {
                type: 'string',
                description: 'Short description of what you want to do.',
            },
            reason: {
                type: 'string',
                description: 'Why this action is needed (context for Raphael).',
            },
            urgency: {
                type: 'string',
                enum: ['low', 'normal', 'high'],
                description: 'How urgent is this request?',
            },
        },
        required: ['action', 'reason'],
    },
}
```

### Implementation

```typescript
// Pending approval requests
const pendingApprovals = new Map<string, {
    resolve: (approved: boolean) => void;
    timeout: NodeJS.Timeout;
}>();

async function requestApproval({ action, reason, urgency = 'normal' }): Promise<string> {
    const requestId = `apr-${Date.now()}`;
    const emoji = urgency === 'high' ? '🚨' : '🔐';

    const message = [
        `${emoji} Approval needed:`,
        ``,
        `Action: ${action}`,
        `Reason: ${reason}`,
        ``,
        `Reply /approve_${requestId} or /deny_${requestId}`,
    ].join('\n');

    // Send to Raphael via Telegram
    await sendTelegramMessage({ chatId: 'raphael', text: message });

    // Wait for response (timeout after 10 minutes)
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            pendingApprovals.delete(requestId);
            resolve('denied (timed out after 10 minutes)');
        }, 10 * 60 * 1000);

        pendingApprovals.set(requestId, {
            resolve: (approved) => {
                clearTimeout(timeout);
                pendingApprovals.delete(requestId);
                resolve(approved ? 'approved' : 'denied');
            },
            timeout,
        });
    });
}
```

In the message processing loop (`processMessage`), add handling for `/approve_*` and `/deny_*`:

```typescript
// In processMessage(), before the regular message flow:
if (text.startsWith('/approve_') || text.startsWith('/deny_')) {
    const isApprove = text.startsWith('/approve_');
    const requestId = text.replace(/^\/(approve|deny)_/, '').trim();

    const pending = pendingApprovals.get(requestId);
    if (pending) {
        pending.resolve(isApprove);
        await postReply(chatId, isApprove
            ? '✅ Approved. Julia is proceeding.'
            : '❌ Denied. Julia will not proceed.');
    } else {
        await postReply(chatId, '⚠️ Request not found or already expired.');
    }
    return;
}
```

---

## Part 4: Lock Down Permissions

### Remove `Bash(op:*)` from OpenClaw

In `.claude/settings.local.json`, remove:
```json
"Bash(op:*)"
```

OpenClaw no longer needs `op` access at all — credentials come from environment variables.

### Remove `.env.secrets` from disk

After implementing the injection script, `.env.secrets` becomes unnecessary. The credentials live in 1Password and get injected at boot into `.env.runtime` (which is overwritten each startup).

```bash
# After verifying the new flow works:
rm .env.secrets
echo ".env.runtime" >> .gitignore
echo ".env.secrets" >> .gitignore
```

### Update `.gitignore`

```
.env.secrets
.env.runtime
```

---

## Part 5: What About Other Applications?

For safely giving juliaz_agents access to **other apps and services** in the future, follow this pattern:

### The "Scoped Access + Approval" Pattern

| Need | Solution |
|------|----------|
| **API access** (Gmail, Notion, etc.) | Create scoped API key/OAuth token with minimal permissions. Store in `juliaz-agents` 1Password vault. Inject at boot. |
| **Browser automation** (OpenClaw CDP) | Never attach to tabs with sensitive content. Consider a separate Chrome profile for OpenClaw. |
| **File system access** | Restrict OpenClaw's working directory. Don't give it access to `~/Documents` broadly. |
| **New credential needed at runtime** | Julia uses `request_approval` tool → Raphael approves via Telegram → credential is fetched from 1Password once and cached in memory for the session. |
| **Sensitive action** (send email to new recipient, post publicly) | Julia uses `request_approval` → Raphael approves → Julia proceeds. |

### Never Do This
- Don't build a custom password manager — 1Password is purpose-built for this
- Don't store credentials in SQLite, JSON files, or the PostgreSQL backend
- Don't give broad filesystem access when scoped access works
- Don't assume OpenClaw will "behave" — enforce boundaries at the infrastructure level

---

## Implementation Order

1. **Create 1Password service account + vault** (manual, ~15 min)
2. **Write `inject-credentials.sh`** and test it standalone
3. **Update email tools** to use env vars instead of `op run`
4. **Update `ecosystem.config.js`** to read `.env.runtime`
5. **Update `start-system.sh`** to call injection script first
6. **Add `request_approval` tool** to orchestrator
7. **Add `/approve` and `/deny` handling** to message processor
8. **Test full flow** via Telegram
9. **Remove `Bash(op:*)` from permissions** and delete `.env.secrets`
10. **Update Julia's system prompt** to mention the approval tool

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Service account token stolen | Stored as macOS env var (not on disk). Revokable instantly in 1Password. |
| `.env.runtime` readable on disk | `chmod 600`, owned by your user only. Could use `tmpfs` mount for extra security. |
| Telegram approval spoofed | Only processes approvals from `RAPHAEL_CHAT_ID`. Telegram messages are encrypted in transit. |
| Approval timeout too short/long | Configurable per request via `urgency` parameter. Default 10 min. |
| Boot without internet (can't reach 1Password) | Graceful failure — services start but credential-dependent tools report "credentials unavailable". |

---

## Done When

- [ ] 1Password service account exists, scoped to `juliaz-agents` vault only
- [ ] `inject-credentials.sh` works and populates `.env.runtime`
- [ ] Email tools work without `op run`
- [ ] `request_approval` tool sends Telegram messages and waits for response
- [ ] `/approve` and `/deny` commands work in Telegram
- [ ] `Bash(op:*)` removed from `.claude/settings.local.json`
- [ ] `.env.secrets` deleted, `.env.runtime` in `.gitignore`
- [ ] Full flow tested: boot → credentials injected → Julia sends email → works
- [ ] Approval flow tested: Julia requests → Telegram message → approve → Julia proceeds
