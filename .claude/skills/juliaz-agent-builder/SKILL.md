---
name: juliaz-agent-builder
description: "Scaffolding and creating new agents or sub-agents within the juliaz_agents ecosystem. Trigger whenever Raphael wants to create a new agent, add a new sub-agent, define a new agent's personality/identity, set up agent heartbeats, or modify an existing agent's SOUL/IDENTITY/TOOLS/AGENTS files. Also trigger when discussing agent conventions, the SOUL.md pattern, or how agents should be structured in this project. If someone says 'new agent', 'create an agent', 'agent personality', 'SOUL.md', or 'add a bot' — this is the skill to use."
---

# juliaz-agent-builder — Creating Agents for Julia's Ecosystem

> This skill encodes the conventions, patterns, and best practices for building agents in the juliaz_agents multi-agent system.

## Before You Start

Read the `juliaz-system` skill first if you haven't already — it provides the full architecture map. Every new agent needs to fit into the existing ecosystem without breaking message flow or creating orphaned components.

Ask these questions before writing any files:

1. **What is this agent's job?** (one sentence — if you need two, it might be two agents)
2. **Is it ambient (runs on a schedule) or reactive (triggered by messages)?**
3. **Does it need bridge access?** (i.e., does it send/receive Telegram messages?)
4. **Does it need Claude/GPT API access?** (via cowork-mcp or direct?)
5. **Where does it run?** (macOS native, Docker, PM2-managed, LaunchAgent?)

## Agent Directory Convention

Every agent in juliaz_agents gets its own directory at the project root:

```
agent-name/
├── SOUL.md          ← REQUIRED: Core identity, values, personality, boundaries
├── IDENTITY.md      ← Name, creature type, vibe descriptor, emoji
├── TOOLS.md         ← Available tools, environment config, API access
├── AGENTS.md        ← Behavioral playbook: how to act, memory patterns, group rules
├── HEARTBEAT.md     ← Scheduling cadence, health check logic, reporting
├── HEURISTICS.md    ← Learned rules from past incidents (grows over time)
├── MEMORY.md        ← Persistent context that survives session boundaries
├── USER.md          ← Info about Raphael (user context)
└── src/             ← Source code (if agent has runtime logic)
    └── index.ts     ← Entry point
```

Not every file is needed for every agent. Here's the minimum:

| Agent Type | Required Files |
|-----------|----------------|
| Ambient (scheduled) | SOUL.md, HEARTBEAT.md |
| Reactive (message-driven) | SOUL.md, IDENTITY.md, TOOLS.md |
| Full agent with memory | All of the above + MEMORY.md + AGENTS.md |

## Writing SOUL.md

The SOUL.md is the most important file. It defines who the agent IS. Study these existing examples:

### Pattern from ADHD Agent (ambient/housekeeping)
```markdown
# Core Identity
You are [name] — [one-line description of role].

# Values
- [3-5 core values expressed as behaviors, not abstractions]

# Boundaries
- [What you NEVER do]
- [What requires human approval]

# Operating Principles
- [How you make decisions]
- [What you prioritize]
```

### Pattern from OpenClaw (communication gateway)
```markdown
# Soul
[Philosophy of how the agent approaches its work]

# Core Traits
- Genuinely helpful
- Resourceful
- Competent
- Earns trust through action

# Relationship to System
[How this agent relates to other agents and to Raphael]
```

### Key Principles for SOUL.md
- Write in second person ("You are...")
- Lead with identity, then values, then boundaries
- Keep it under 100 lines — agents that need more context use AGENTS.md
- Boundaries are as important as capabilities
- Never give an agent permission to modify other agents' SOUL.md files

## Writing IDENTITY.md

Short and structured. Follow this template:

```markdown
# Identity

- **Name**: [agent_name]
- **Creature**: [what kind of agent — e.g., "Ambient research agent", "Communication gateway"]
- **Vibe**: [2-3 adjectives — e.g., "calm, observant, curious"]
- **Emoji**: [single emoji representing the agent]
- **Created**: [date]
- **Creator**: Raphael + Antigravity
```

## Writing HEARTBEAT.md (for ambient agents)

Ambient agents need scheduled execution. The pattern in juliaz_agents uses macOS LaunchAgent:

```markdown
# Heartbeat

## Schedule
- **Frequency**: Every [N] hours
- **Method**: macOS LaunchAgent (launchctl)
- **Plist**: ~/Library/LaunchAgents/com.juliaz.[agent-name].plist

## Health Check
1. [What the agent checks on each run]
2. [What triggers an alert]
3. [How it reports — e.g., Telegram message, email, backend log]

## Reporting
- **Normal**: [what happens when everything is fine]
- **Alert**: [what happens when something needs attention]
```

## Writing TOOLS.md

Document what the agent can access:

```markdown
# Tools

## Available
- [tool_name]: [what it does]

## Environment
- API Keys: [which env vars needed]
- Ports: [what ports it uses]
- Dependencies: [npm packages, CLI tools]

## Restrictions
- [What this agent must NOT access]
```

## Writing AGENTS.md

The behavioral playbook — how the agent acts in different situations:

```markdown
# Agent Behavior

## Mission
[One paragraph: what this agent exists to accomplish]

## Decision Tree
1. When [situation A] → [action]
2. When [situation B] → [action]
3. When unsure → [default behavior]

## Memory Patterns
- [What to remember across sessions]
- [What to forget/discard]

## Interaction with Other Agents
- [How this agent communicates with bridge/orchestrator/OpenClaw]
```

## Connecting to the Ecosystem

### If the agent needs bridge access:
1. Add MCP tool calls in the agent's runtime code
2. Bridge endpoint: `http://localhost:3001/mcp`
3. Use `telegram_get_pending_messages` and `telegram_send_reply` tools

### If the agent needs its own API:
1. Pick an unused port (current: 3000=backend, 3001=bridge, 3002=frontend, 3003=cowork-mcp)
2. Add to PM2 config (`ecosystem.config.js` and `ecosystem.dev.config.js`)
3. Add health check endpoint at `GET /health`

### If the agent needs PM2 management:
Add entry to both PM2 config files:
```javascript
{
  name: 'agent-name',
  script: 'npm',
  args: 'run dev',  // or 'run start' for production
  cwd: './agent-name',
  env: {
    NODE_ENV: 'development',
    // ... agent-specific env vars
  }
}
```

### If the agent needs a LaunchAgent (ambient):
Create plist at `~/Library/LaunchAgents/com.juliaz.[name].plist` with:
- `StartInterval` for periodic execution
- `StandardOutPath` and `StandardErrorPath` for logging
- `WorkingDirectory` pointing to the agent's folder

## Checklist for New Agent

Before considering an agent "done":

- [ ] SOUL.md written with clear identity and boundaries
- [ ] IDENTITY.md with name, creature, vibe, emoji
- [ ] If runtime code: entry point in `src/index.ts`
- [ ] If PM2-managed: added to both ecosystem configs
- [ ] If ambient: HEARTBEAT.md with schedule and health checks
- [ ] If bridge-connected: tested message send/receive
- [ ] README.md in `docs/agent_cards/` describing the agent for humans
- [ ] Added to `docs/agent_system_overview.md`
- [ ] Main project README.md updated with new component
