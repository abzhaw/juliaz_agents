---
name: email-aberer
description: Access and send mail for raphael@aberer.ch (IMAP/POP/SMTP via Swizzonic) using credentials pulled from 1Password.
---

# Aberer Mail Skill

Use this skill whenever you need to read or send email from `raphael@aberer.ch`. All credentials live in 1Password (item name **"Aberer Mail"**) and must be retrieved at runtime—never hardcode passwords or copy them into logs.

## Mail servers
| Protocol | Host | Port | Notes |
| --- | --- | --- | --- |
| IMAP (TLS) | `imap.aberer.ch` (alias `imap.swizzonic.email`) | 993 | Primary inbox access |
| POP3 (TLS) | `pop3.swizzonic.email` | 995 | Fallback download |
| SMTP (TLS) | `smtp.swizzonic.email` | 587 | Submission (STARTTLS) |

## Credentials via 1Password
Assumes you already signed in with `op signin` inside tmux (see `skills/1password`). Fetch credentials as needed:

```bash
op item get "Aberer Mail" --fields label=IMAP_USERNAME
op item get "Aberer Mail" --fields label=IMAP_PASSWORD
op item get "Aberer Mail" --fields label=SMTP_USERNAME
op item get "Aberer Mail" --fields label=SMTP_PASSWORD
```

For one-shot scripts, prefer `op run -- item get …` to inject env vars:

```bash
op run --env-file skills/email-aberer/.env.example -- python3 skills/email-aberer/scripts/email_send.py \
  --to someone@example.com --subject "Test" --body "Hello"
```

(See `.env.example` for the required variable names.)

## Scripts
The folder `skills/email-aberer/scripts/` contains two helpers:

1. `email_fetch.py` – List messages (default: last 10, unread only) and optionally dump full MIME to disk.
2. `email_send.py` – Compose and send a plaintext or HTML email.

Both scripts read credentials from environment variables so they can be wrapped with `op run`:

```
IMAP_HOST=imap.aberer.ch
IMAP_USER=raphael@aberer.ch
IMAP_PASS=<from 1Password>
SMTP_HOST=smtp.swizzonic.email
SMTP_PORT=587
SMTP_USER=raphael@aberer.ch
SMTP_PASS=<from 1Password>
```

### Fetch example
```bash
op run --env-file skills/email-aberer/env-imap.env -- \
python3 skills/email-aberer/scripts/email_fetch.py \
  --limit 5 --unread --save-links medium-link.txt
```

Outputs JSON describing each message (from, subject, date, snippet) and saves the raw payload when `--save` is passed—handy for grabbing Medium "magic link" emails.

### Send example
```bash
op run --env-file skills/email-aberer/env-smtp.env -- \
python3 skills/email-aberer/scripts/email_send.py \
  --to raphael@aberer.ch --subject "Bridge test" --body "Hello from OpenClaw"
```

The script supports `--html-body file.html` for HTML content.

## Integrating with agents
1. **daily-ai-feed**: use `email_fetch.py` with `--search "from:Medium"` to capture magic-link logins, then call the URL using `requests`.
2. **Manual ops**: run `email_send.py` when you need to acknowledge alerts or send digests manually.
3. For persistent workflows, wrap the scripts with OpenClaw skills YAML (e.g., `skills/email-aberer/send.yml`) so other agents can call them deterministically.

## Troubleshooting
| Symptom | Check |
| --- | --- |
| `LOGIN failed` | Verify credentials from 1Password; ensure IMAP user/pass match. |
| TLS errors | Ensure you’re using port 993 (IMAP) / 587 (SMTP STARTTLS). |
| Medium magic link not found | Use `--search "subject:\"Sign in to Medium\""` and increase `--limit`. |
| SMTP rejects send | Some hosts require `From` to match authenticated user; set `--from raphael@aberer.ch`. |

## Next steps
- Add YAML wrappers (send/read) once scripts are validated.
- Hook into telegram digest pipeline so `daily-ai-feed` can email or notify when needed.
