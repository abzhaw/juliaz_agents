# Agent Card: Julia

## What is it?
Julia is the **central manager** of the entire system. She receives your goals, breaks them down into smaller tasks, and decides which specialist agent should handle each part. Julia is always running in the background when you work in this project — she is the AI you talk to directly in the code editor.

## What problem does it solve?
Without Julia, you would need to manually figure out which tool to use for each task, configure it yourself, and remember how everything connects. Julia handles all of that coordination automatically.

## How does it connect to the rest of the system?
Julia sits at the top. Every other agent works *for* Julia. When Julia needs to send a message, she calls on OpenClaw. When she needs research documented, she calls on the Thesis Agent. When documentation needs updating, she calls on the Docs Agent.

## What can it do?
- Receive your goals in plain language and turn them into actions
- Delegate communication tasks to OpenClaw (e.g. "send this via Telegram")
- Build and maintain the backend software (the Task API)
- Use 300+ skill files to learn how to do specialised tasks
- Remember context across long sessions

## What can it NOT do?
- Send messages directly to Telegram or WhatsApp — OpenClaw does that
- Run without a user providing goals — Julia is reactive, not proactive on her own
- Act outside of the workspace without explicit permission

## Analogy
Julia is like a **chief of staff** in an organisation. She doesn't do every job herself, but she understands every job well enough to direct who should do what, and she makes sure everything gets done.

---
*Updated: 2026-02-21 by Docs Agent*
