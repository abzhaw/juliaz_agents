---
name: juliaz-agent-architect
description: "Architecture patterns and anti-patterns for Julia's multi-agent system. Trigger when making architectural decisions — adding agents, changing message flow, redesigning tool registries, or evaluating the system's structure. Also trigger for: 'architecture', 'system design', 'how should agents work together', 'add a new agent', 'agent patterns', or any structural question about the multi-agent system."
---

# juliaz-agent-architect — Agent Architecture Patterns

> Architecture patterns for the juliaz_agents system. Adapted from `ai-agents-architect`.

## Use this skill when

- Making architectural decisions about the agent system
- Evaluating whether to add a new agent or extend an existing one
- Changing the message flow between components
- Designing how agents should interact

## Patterns Used in juliaz

### ReAct Loop (Orchestrator + Frontend)
Both Julia agents use Reason-Act-Observe:
1. Receive message → reason about intent
2. Select tool (or respond directly)
3. Execute tool, observe result
4. Incorporate result into response

**Orchestrator**: Up to 5 tool iterations per message (`claude.ts`, `openai.ts`)
**Frontend**: Up to 5 steps via `stopWhen: stepCountIs(5)`

### Hub-and-Spoke (Bridge)
The bridge is the central message hub. All inter-agent communication flows through it. No agent talks directly to another agent (except frontend → cowork-mcp for delegation, which is a direct HTTP call, not inter-agent messaging).

### Gateway Pattern (OpenClaw)
OpenClaw is a protocol gateway: translates between Telegram's API and the bridge's REST/MCP interface. It doesn't make decisions — it routes messages.

## Anti-Patterns to Avoid

### 1. Multiple Independent Brains
**Bad**: Frontend Julia and Orchestrator Julia are both separate LLM instances making independent decisions with different tool sets.
**Good**: One orchestrator brain, multiple interfaces that route to it.

### 2. Tool Overload
**Bad**: Giving an agent 10+ tools. The LLM loses accuracy in tool selection.
**Good**: 3-5 focused tools per agent. Current: Orchestrator has 2 (expanding to 4), Frontend has 3 (expanding to 4).

### 3. Unlimited Autonomy
**Bad**: Agent loops indefinitely trying to accomplish a task.
**Good**: Max iteration limits (5 in both agents), timeouts on all HTTP calls (30-60s).

### 4. Memory Hoarding
**Bad**: Storing every conversation turn in long-term memory.
**Good**: Selective memory extraction via `memory-keeper.ts` — only STORY, FEELING, MOMENT, WISH, REFLECTION.

### 5. Silent Failures
**Bad**: Tool returns empty string on error.
**Good**: Every tool returns a clear error message: `"Email failed (exit 1): connection refused"`.

## Decision Framework: New Agent vs. New Tool

| Question | New Agent | New Tool |
|----------|-----------|----------|
| Does it need its own LLM reasoning? | Yes → New agent | No → New tool |
| Does it need its own conversation state? | Yes → New agent | No → New tool |
| Does it need to run on a different schedule? | Yes → New agent | No → New tool |
| Can the orchestrator handle it? | No → New agent | Yes → New tool |
| Is it just an API call? | No | Yes → New tool |

## juliaz Architecture Rules

1. **Bridge is the only inter-agent channel** — never have agents call each other directly for messaging
2. **Orchestrator is the brain** — other interfaces delegate actions to it
3. **Tools return strings** — never throw, always return clear success/error messages
4. **Timeouts on everything** — 30s for API calls, 45s for bridge polling, 60s for delegation
5. **chatId is the routing key** — use conventions (`web-*`, numeric) to identify message sources
6. **Fire-and-forget for non-critical work** — memory extraction, letter scheduling never block the main loop

## Key Architectural Files

| File | Architectural Role |
|------|-------------------|
| `bridge/src/index.ts` | Message hub — all routing flows through here |
| `orchestrator/src/index.ts` | Main poll loop — the heartbeat of the system |
| `orchestrator/src/tools.ts` | Tool registry — what the brain can do |
| `orchestrator/src/prompt.ts` | Brain identity — what the brain knows |
| `frontend/server.ts` | Web interface — conversation + action delegation |
| `openclaw/skills/julia-relay/SKILL.md` | Gateway relay — Telegram ↔ bridge |
