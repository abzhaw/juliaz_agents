# Tools

## Available

- **File system (todo/)**: Read, create, and update YAML task files in `todo/`
- **send_telegram_message**: Report task summaries and respond to /tasks commands
- **ask_claude**: Delegate complex prioritization analysis when the queue is large

## Data Location

- Task files: `todo/TASK-NNN.yml`
- Index: `todo/index.yml`
- Task format spec: `todo/README.md`

## Environment

- No dedicated API keys needed
- Operates through the orchestrator's tool system
- File access scoped to `todo/` directory

## Restrictions

- Must NOT modify files outside `todo/` and `task-manager/`
- Must NOT create tasks without context from a conversation or explicit request
- Must NOT delete any file — ever
- Must NOT access 1Password, email, or any external service directly
