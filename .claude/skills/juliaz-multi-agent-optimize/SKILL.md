---
name: juliaz-multi-agent-optimize
description: "Optimize coordination between Julia's agents — orchestrator, frontend, OpenClaw, bridge, cowork-mcp. Trigger when improving inter-agent communication, reducing latency, fixing routing issues, or optimizing the message flow. Also trigger for: 'agents not talking', 'message not arriving', 'routing broken', 'too slow', 'bridge bottleneck', or any multi-agent coordination question."
---

# juliaz-multi-agent-optimize — Multi-Agent Coordination

> Optimize how Julia's agents work together. Adapted from `agent-orchestration-multi-agent-optimize`.

## Use this skill when

- Improving coordination between orchestrator, frontend, OpenClaw, or bridge
- Fixing routing issues (messages not arriving, wrong agent handling request)
- Reducing latency in the message flow
- Designing new inter-agent communication paths

## Do not use this skill when

- Optimizing a single agent's prompt or tool (use `juliaz-agent-improve` or `juliaz-tool-builder`)
- Debugging infrastructure (use `juliaz-debug`)
- Building a new agent (use `juliaz-agent-builder`)

## juliaz Message Flow Architecture

```
                     ┌─────────────────┐
                     │   Bridge :3001  │
                     │  (message hub)  │
                     └──┬──────────┬───┘
                        │          │
              GET /consume    POST /incoming
              POST /reply     GET /pending-reply
                        │          │
              ┌─────────┴──┐  ┌────┴──────────┐
              │ Orchestrator│  │   OpenClaw    │
              │ (Julia brain)│  │ (Telegram GW) │
              └─────────────┘  └───────────────┘
                     │
              POST /task
                     │
              ┌──────┴──────┐
              │ Cowork-MCP  │
              │ :3003       │
              └─────────────┘
```

## Key Principles

### 1. Minimal Inter-Agent Communication Overhead
Every hop adds latency. The bridge path (POST → queue → poll → process → POST → poll) adds 5-10 seconds. Only route through the bridge when necessary (actions requiring orchestrator tools). Keep conversational responses direct.

### 2. Single Orchestrator Brain
Don't duplicate Julia into multiple independent agents with overlapping tools. The orchestrator is the brain. Other interfaces (frontend, Telegram via OpenClaw) should route action requests to it.

### 3. Reuse Existing Endpoints
The bridge already has `POST /incoming`, `GET /consume`, `POST /reply`, `GET /pending-reply/:chatId`. Don't create new protocols — use these.

### 4. Clear Message Routing via chatId Convention

| chatId Pattern | Source | Handler |
|----------------|--------|---------|
| Numeric (e.g., `8519931474`) | Telegram via OpenClaw | Orchestrator processes, replies via bridge |
| `web-<timestamp>` | Frontend dashboard | Orchestrator processes, frontend polls for reply |

## Optimization Checklist

When adding a new inter-agent path:

- [ ] Does it reuse existing bridge endpoints?
- [ ] Is the chatId convention clear and non-overlapping?
- [ ] Does the receiver know how to identify the source (username, chatId prefix)?
- [ ] Is there a timeout with a clear error message?
- [ ] Does the existing flow (Telegram → bridge → orchestrator → bridge → Telegram) still work?
- [ ] Is the response consumed after delivery (no stale replies)?

## Latency Budget

| Path | Expected Latency | Acceptable |
|------|------------------|------------|
| Frontend → direct LLM response | 1-3s (streaming) | Yes |
| Frontend → bridge → orchestrator → bridge → frontend | 5-15s | Yes for actions |
| Telegram → OpenClaw → bridge → orchestrator → bridge → OpenClaw → Telegram | 5-15s | Yes |
| Any path | >45s | No — must timeout |

## Cost Awareness

| Model | Cost | Used by |
|-------|------|---------|
| Claude Haiku | Low | Orchestrator (primary) |
| GPT-4o | Medium | Orchestrator (fallback), Frontend (default) |
| Claude Sonnet | Higher | Frontend (selectable), Cowork-MCP delegation |

When routing through the orchestrator, the frontend adds a second LLM call (orchestrator processes the request). This is acceptable for actions but wasteful for simple questions — hence the hybrid approach.
