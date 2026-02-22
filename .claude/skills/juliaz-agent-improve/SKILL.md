---
name: juliaz-agent-improve
description: "Systematic improvement of Julia's agents through performance analysis, prompt engineering, and validation. Trigger when optimizing any agent's behavior — orchestrator, frontend Julia, OpenClaw relay, or any sub-agent. Also trigger for: 'improve agent', 'agent not working well', 'optimize prompt', 'tool not being used correctly', 'Julia gives wrong answers', or any agent quality issue."
---

# juliaz-agent-improve — Agent Performance Optimization

> Systematic improvement of agents in the juliaz_agents system. Adapted from `agent-orchestration-improve-agent`.

## Use this skill when

- Improving an existing agent's performance or reliability (orchestrator, frontend Julia, OpenClaw)
- Analyzing why an agent misuses tools, gives wrong answers, or fails silently
- Optimizing system prompts for better tool selection
- Validating agent changes before deployment

## Do not use this skill when

- Building a brand-new agent from scratch (use `juliaz-agent-builder`)
- Adding a new tool (use `juliaz-tool-builder`)
- Debugging infrastructure issues (use `juliaz-debug`)

## Methodology: 4-Phase Improvement Cycle

### Phase 1: Baseline & Failure Analysis

Before changing anything, establish what's broken and what works.

1. **Identify the failure**: What exact prompt/input causes the wrong behavior?
2. **Trace the path**: Which agent handles it? What tools does it have? What does its system prompt say?
3. **Check logs**: `pm2 logs orchestrator`, `pm2 logs bridge`, browser console for frontend
4. **Classify the failure**:
   - **Tool misuse**: Agent calls wrong tool or doesn't call any tool → fix tool descriptions
   - **Prompt gap**: Agent doesn't know about a capability → fix system prompt
   - **Missing tool**: Agent literally can't do what's asked → add a tool (use `juliaz-tool-builder`)
   - **Architecture gap**: No path exists between components → fix routing (use `juliaz-multi-agent-optimize`)

### Phase 2: Targeted Fix

Apply the minimum change needed:

- **Tool description fix**: Make descriptions crystal-clear about WHEN to use, WHEN NOT to use, and WHAT inputs to provide (see `juliaz-tool-builder`)
- **System prompt fix**: Add missing capabilities, clarify boundaries, add examples
- **Routing fix**: Add missing connections between components

### Phase 3: Validation

Test the exact failure case that motivated the change:

1. Re-run the failing prompt → should now succeed
2. Run regression prompts → existing behavior unchanged
3. Check for hallucinated tool calls → agent shouldn't call tools for unrelated prompts
4. Check logs for errors → no silent failures

### Phase 4: Document

- Update the agent's system prompt version comment
- Note the fix in thesis documentation if substantive

## juliaz-Specific Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "I can't do that" | Missing tool or unclear prompt | Add tool or update prompt |
| Tool called but wrong result | Tool implementation bug | Fix the executor in `tools.ts` |
| Tool never called | Vague tool description | Rewrite description per `juliaz-tool-builder` |
| Agent calls wrong tool | Overlapping/ambiguous descriptions | Make descriptions mutually exclusive |
| Timeout on tool call | Service down or wrong URL | Check bridge/backend/cowork-mcp health |
| Generic/unhelpful response | System prompt too vague | Add specific guidance and examples |

## Key Files

| Agent | Prompt | Tools | Executor |
|-------|--------|-------|----------|
| Orchestrator Julia | `orchestrator/src/prompt.ts` | `orchestrator/src/tools.ts` | `orchestrator/src/tools.ts:executeTool()` |
| Frontend Julia | `frontend/server.ts` (SYSTEM_PROMPT const) | `frontend/server.ts` (chatTools object) | Inline in tool definitions |
| OpenClaw | `openclaw/SOUL.md` + skill files | OpenClaw CLI built-in + skills | Skill scripts |
