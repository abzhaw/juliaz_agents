---
name: llm-prompt-engineering
description: Design effective system prompts, few-shot examples, chain-of-thought instructions, and output constraints for LLM agents. Use when writing or tuning prompts for Julia's orchestrator, cowork-mcp, or any sub-agent.
---

# LLM Prompt Engineering

## Core Principles

### System Prompt Structure
```
1. Role / Identity — who the model is
2. Context — what system it operates in
3. Capabilities — what tools it has
4. Constraints — what it must NOT do
5. Output format — how to respond
```

### Techniques

**Chain-of-Thought**: Add `"Think step by step."` or a scratchpad section before the final answer.

**Few-Shot**: Provide 2–3 input/output examples in the prompt for consistent formatting.

**Temperature**:
- `0.0` → deterministic, good for structured output / routing
- `0.3–0.7` → good for reasoning tasks
- `0.9+` → creative / brainstorming

**Output Constraints**: Use Zod schema + `response_format: { type: 'json_object' }` (OpenAI) or instructed JSON in the system prompt (Claude).

## Julia-Specific Patterns

### Orchestrator System Prompt
Keep under 4,000 tokens. Include:
- Current time/date (injected dynamically)
- Available MCP tools summary
- Decision loop instructions
- Escalation rules (when to message Raphael)

### Sub-Agent Prompts (SOUL.md)
```markdown
## Identity
You are [Name]. Your purpose is [single sentence].

## Responsibilities
- [Specific task 1]
- [Specific task 2]

## Rules
- Never [constraint]
- Always [requirement]

## Output Format
[Schema or example]
```

## Anti-Patterns
- ❌ Vague instructions → model hallucinates behavior
- ❌ Contradictory rules → model picks randomly
- ❌ Too long → important context gets ignored
- ❌ No output format → inconsistent parsing
