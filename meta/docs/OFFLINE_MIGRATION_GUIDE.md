# Julia Agents — Offline Migration Guide

> **Goal:** Replace all cloud API dependencies (OpenAI, Anthropic) with local model inference via Ollama, so the entire Julia system runs on a single Mac Studio without internet-dependent LLM calls.

---

## System Architecture (correct naming)

Before migrating, understand what actually connects to what:

```
                        ┌─────────────────────┐
                        │  Julia-Orchestrator  │  ← The shared brain. Processes
                        │  (Claude Haiku)      │    messages from ALL channels.
                        └──────────┬──────────┘
                                   │
                              polls & replies
                                   │
                           ┌───────┴───────┐
                           │  Julia-Bridge │  ← Central message hub.
                           │  (port 3001)  │    Connects BOTH Julia-Web
                           └───┬───────┬───┘    and OpenClaw to orchestrator.
                               │       │
                    ┌──────────┘       └──────────┐
                    │                              │
            ┌───────┴───────┐              ┌──────┴──────┐
            │   Julia-Web   │              │   OpenClaw  │
            │  (port 3002)  │              │  (gateway)  │
            │  Has own AI!  │              └──────┬──────┘
            └───────────────┘                     │
                    ↕                             ↕
               Web Browser                    Telegram
```

| Component | Correct Name | What it does | Has LLM? |
|-----------|-------------|--------------|----------|
| Frontend (port 3002) | **Julia-Web** | Web chat interface, has its own AI brain (GPT-4o / Claude Sonnet), delegates to orchestrator when needed | YES |
| Orchestrator | **Julia-Orchestrator** | The shared brain. Processes messages from ALL channels via tool-calling loop | YES |
| Bridge (port 3001) | **Julia-Bridge** | Central message hub connecting ALL components — NOT OpenClaw-specific | NO |
| OpenClaw | **OpenClaw** | Telegram gateway — forwards messages between Telegram API and the bridge | NO |
| Backend (port 3000) | **Backend** | PostgreSQL + REST API for persistence | NO |
| Cowork-MCP (port 3003) | **Cowork-MCP** | Claude delegation server — both Julia-Web and Orchestrator can use it | YES |

**Important distinctions:**
- "Julia-Telegram" is a user **experience**, not a component — it's the whole chain of OpenClaw → Bridge → Orchestrator working together.
- Julia-Web runs GPT-4o/Claude Sonnet **directly** via `streamText`. It only routes to the orchestrator for things it can't do itself (send emails, send Telegram messages via `send_to_orchestrator` tool).
- Julia-Bridge is model-agnostic infrastructure — zero LLM calls, zero migration needed.

---

## Hardware Recommendation

**Mac Studio M4 Max, 64GB unified memory, 1TB SSD** — fits under $3K.

| What | RAM needed | Notes |
|------|-----------|-------|
| Qwen2.5-32B (Q4_K_M) | ~20 GB | Primary model for orchestrator + Julia-Web + tool calling |
| Qwen2.5-7B (Q4_K_M) | ~5 GB | Fast model for graders, memory-keeper, optimizer |
| macOS + Docker + Postgres + Node services | ~8-12 GB | All PM2 services + backend |
| Headroom | ~15-20 GB | Context windows, spikes, browser |

**Total: ~48-57 GB** — fits in 64GB with room to breathe.

If budget stretches to ~$3,200: **128GB** gives serious headroom for longer contexts, concurrent models, and future growth.

---

## Current LLM Dependency Map

Every file that calls a cloud API, what it does, and how to replace it:

### Tier 1 — Critical Path (two AI brains + tool calling)

| File | Current Model | Role | Difficulty |
|------|--------------|------|------------|
| `orchestrator/src/claude.ts` | Claude Haiku 4.5 | **Julia-Orchestrator primary brain** — tool-use loop, 5 tools, 5-iteration max, 30s timeout, retry with backoff | HIGH |
| `orchestrator/src/openai.ts` | GPT-4o | **Julia-Orchestrator fallback** — same tools, kicks in when Claude fails with non-retryable error | HIGH |
| `orchestrator/src/tools.ts` | — | Tool definitions in both Anthropic + OpenAI formats (send_email, ask_claude, send_telegram_message, fetch_email, manage_tasks) | MEDIUM |
| `frontend/server.ts` | GPT-4o / Claude Sonnet | **Julia-Web's own brain** — `streamText` via Vercel AI SDK, 4 tools (send_to_orchestrator, ask_claude, get_tasks, get_memories) | MEDIUM |

### Tier 2 — Supporting Features

| File | Current Model | Role | Difficulty |
|------|--------------|------|------------|
| `orchestrator/src/memory-keeper.ts` | GPT-4o-mini | Extracts memories from messages (JSON structured output), fire-and-forget after each message | LOW |
| `orchestrator/src/letter-scheduler.ts` | GPT-4o | Generates daily letters (reads seed file + recent memories, creative writing, no tools) | LOW |
| `orchestrator/src/optimizer.ts` | GPT-4o-mini | Self-evolution prompt optimizer — builds metaprompt from grader stats, rewrites tool-use sections (DEV_MODE only) | MEDIUM |
| `orchestrator/src/graders/holistic-strategy.ts` | GPT-4o-mini | LLM-as-judge: was tool needed? Right tool? Logical sequence? Scores 1-5 (DEV_MODE only) | LOW |
| `orchestrator/src/graders/result-integration.ts` | GPT-4o-mini | LLM-as-judge: how well did Julia incorporate tool results? Detects ignored/garbled data (DEV_MODE only) | LOW |

### Tier 3 — Delegation Layer

| File | Current Model | Role | Difficulty |
|------|--------------|------|------------|
| `cowork-mcp/src/index.ts` | Claude Sonnet 4 | MCP server — 6 tools (task, multimodal, code review, summarize, brainstorm, status). Called by BOTH Julia-Web (`ask_claude` tool) and Julia-Orchestrator (`ask_claude` tool) | MEDIUM |

### No migration needed

| Component | Why |
|-----------|-----|
| `bridge/src/index.ts` | Pure message queue + MCP routing. Zero LLM calls. No changes needed. |
| `health-checker/scripts/health_check.sh` | Bash + Python. No LLM. BUT: must add Ollama health monitoring (see Step 9). |
| `security-agent/scripts/daily-report.sh` | Bash + Python. No LLM. No changes. |
| `docs-agent/scripts/docs_drift_check.sh` | Bash. No LLM. No changes. |
| `task-manager/scripts/task_check.sh` | Bash. No LLM. No changes. |
| `adhd-agent/scripts/adhd_loop.sh` | Bash + Python. No LLM. No changes. |
| `architecture-agent/scripts/architecture_scan.sh` | Bash + Python. No LLM. BUT: should discover Ollama as a node in topology scans. |

---

## Model Strategy

Two local models cover everything:

| Local Model | Replaces | Use For |
|-------------|----------|---------|
| **Qwen2.5-32B-Instruct** (Q4_K_M) | Claude Haiku, GPT-4o, Claude Sonnet | Tool calling (orchestrator + Julia-Web), chat, creative writing, delegation (cowork-mcp) |
| **Qwen2.5-7B-Instruct** (Q4_K_M) | GPT-4o-mini | Memory extraction, grading, optimization, letter evaluation (fast/cheap tasks) |

**Why Qwen2.5:** Best-in-class tool/function calling among open models at this size. Native support for structured tool calls in its chat template. Closest to GPT-4o behavior for the orchestrator's tool-use loop.

---

## Offline Communication Strategy

Going offline means **no Telegram**. This has cascading effects:

### What breaks without internet

| Component | Impact | Solution |
|-----------|--------|----------|
| OpenClaw → Telegram API | Users can't chat via Telegram | Julia-Web (`:3002`) becomes the **sole user interface** |
| Orchestrator → Telegram replies | Reply chain dies | Orchestrator still works — messages just arrive from Julia-Web via Bridge instead |
| `send_telegram_message` tool | Tool fails | Modify tool to check for offline mode, queue messages or return "Offline — use Julia-Web" |
| `send_email` tool (1Password CLI) | Needs network for SMTP | Queue emails for later sending when connectivity returns, or skip |
| Health Checker → Telegram alerts | No alert delivery | Add a local alert log file. Julia-Web dashboard can display it. |
| All ambient agents → Telegram | All alerts fail silently | Same — local alert log + dashboard widget |

### Recommended approach

1. Add an `OFFLINE_MODE=true` environment variable to `.env.secrets`
2. When `OFFLINE_MODE=true`:
   - OpenClaw does NOT start (saves resources)
   - `send_telegram_message` returns "Offline mode — message queued" and writes to a local outbox file
   - `send_email` does the same (queues to `outbox/emails/`)
   - Health Checker writes alerts to `shared-findings/alerts.json` instead of Telegram
   - Julia-Web becomes the primary (and only) chat interface
3. When connectivity returns, set `OFFLINE_MODE=false` and drain the outbox queues

### Julia-Web is already the right interface for offline

Julia-Web has its **own AI brain** — it runs the model directly, handles most conversations itself, and only delegates to the orchestrator for actions like email and Telegram. In offline mode, those delegation paths are irrelevant anyway. Julia-Web + Cowork-MCP gives you a fully functional Julia without internet.

---

## Step-by-Step Migration

### Step 0: Install Ollama

```bash
# Download from https://ollama.com or:
brew install ollama

# Start the server (runs on http://localhost:11434)
ollama serve &

# Pull the models
ollama pull qwen2.5:32b
ollama pull qwen2.5:7b
```

Ollama exposes an **OpenAI-compatible API** at `http://localhost:11434/v1`. This is the key insight — your existing OpenAI SDK code needs minimal changes.

---

### Step 1: Create a unified local LLM client

Create a new file that both the orchestrator and other components can use:

**`orchestrator/src/local-llm.ts`**

```typescript
/**
 * Local LLM client — replaces both OpenAI and Anthropic cloud API calls
 * with Ollama running locally on the Mac Studio.
 *
 * Uses the OpenAI SDK pointed at Ollama's OpenAI-compatible endpoint.
 * Tool calling works natively with Qwen2.5 models.
 */
import OpenAI from 'openai';
import { getSystemPrompt } from './prompt.js';
import { OPENAI_TOOLS, executeTool } from './tools.js';
import type { ToolCall } from './graders/types.js';

// Point at local Ollama instead of OpenAI cloud
const client = new OpenAI({
    baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    apiKey: 'ollama', // Ollama doesn't need a real key, but the SDK requires one
});

// Model names as Ollama knows them
const PRIMARY_MODEL = process.env.LOCAL_MODEL_PRIMARY ?? 'qwen2.5:32b';
const FAST_MODEL = process.env.LOCAL_MODEL_FAST ?? 'qwen2.5:7b';

export interface Turn {
    role: 'user' | 'assistant';
    content: string;
}

export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface GenerateResult {
    reply: string;
    usage: Usage;
    toolCalls: ToolCall[];
}

const MAX_TOOL_ITERATIONS = 5;
const TIMEOUT_MS = 60_000; // Local models can be slower — give 60s

/**
 * Generate a reply using the local model with tool calling.
 * Drop-in replacement for both claude.ts and openai.ts generateReply().
 */
export async function generateReply(history: Turn[]): Promise<GenerateResult> {
    const totalUsage: Usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const collectedToolCalls: ToolCall[] = [];

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt() },
        ...history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        })),
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const response = await client.chat.completions.create({
            model: PRIMARY_MODEL,
            messages,
            tools: OPENAI_TOOLS,
            tool_choice: 'auto',
        });

        const choice = response.choices[0];
        if (!choice) throw new Error('No response from local model');

        // Accumulate usage
        if (response.usage) {
            totalUsage.prompt_tokens += response.usage.prompt_tokens;
            totalUsage.completion_tokens += response.usage.completion_tokens;
            totalUsage.total_tokens += response.usage.total_tokens;
        }

        // Check for tool calls
        if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length) {
            messages.push(choice.message);

            for (const tc of choice.message.tool_calls ?? []) {
                console.log(`[local-llm] Tool: ${tc.function.name}(${tc.function.arguments.slice(0, 200)})`);

                // Validate JSON before executing — Qwen sometimes produces malformed args
                let parsedArgs: Record<string, unknown>;
                try {
                    parsedArgs = JSON.parse(tc.function.arguments);
                } catch (parseErr) {
                    console.warn(`[local-llm] Malformed tool args, retrying...`);
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Error: Invalid JSON in tool arguments. Please try again with valid JSON.`,
                    });
                    continue;
                }

                const result = await executeTool(tc.function.name, tc.function.arguments);
                console.log(`[local-llm] Result: ${result.slice(0, 200)}`);

                collectedToolCalls.push({
                    name: tc.function.name,
                    args: parsedArgs,
                    result,
                });

                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: result,
                });
            }
            continue;
        }

        // Final text reply
        const reply = choice.message.content ?? '';
        if (!reply) throw new Error('Local model returned empty response');

        return { reply, usage: totalUsage, toolCalls: collectedToolCalls };
    }

    throw new Error('Tool-use loop exceeded maximum iterations');
}

/**
 * Simple completion without tools — for memory-keeper, graders, letter-scheduler.
 * Uses the fast (7B) model by default.
 */
export async function simpleCompletion(
    systemPrompt: string,
    userMessage: string,
    options?: { model?: string; jsonMode?: boolean }
): Promise<{ reply: string; usage: Usage }> {
    const model = options?.model ?? FAST_MODEL;

    const response = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });

    const reply = response.choices[0]?.message?.content ?? '';
    const usage: Usage = {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0,
    };

    return { reply, usage };
}
```

---

### Step 2: Rewire Julia-Orchestrator entry point

**`orchestrator/src/index.ts`** — Replace the dual Claude/GPT imports with the single local client:

```typescript
// BEFORE (cloud):
import { generateReply } from './claude.js';
import { generateReply as generateReplyGpt } from './openai.js';

// AFTER (local):
import { generateReply } from './local-llm.js';
```

And simplify the processMessage function's LLM call:

```typescript
// BEFORE — primary/fallback dance:
try {
    const result = await generateReply(history);
    reply = result.reply;
    model = 'claude-haiku-4-5-20251001';
    toolCalls = result.toolCalls;
    reportUsage(model, result.usage.input_tokens, result.usage.output_tokens);
} catch (claudeErr: any) {
    log(`Claude failed (${claudeErr.message}), falling back to GPT-4o`);
    try {
        const result = await generateReplyGpt(history);
        reply = result.reply;
        model = 'gpt-4o';
        toolCalls = result.toolCalls;
        reportUsage(model, result.usage.prompt_tokens, result.usage.completion_tokens);
    } catch (gptErr: any) {
        throw new Error(`Both Claude and GPT-4o failed.`);
    }
}

// AFTER — single local model:
try {
    const result = await generateReply(history);
    reply = result.reply;
    model = 'qwen2.5:32b';
    toolCalls = result.toolCalls;
    reportUsage(model, result.usage.prompt_tokens, result.usage.completion_tokens);
} catch (err: any) {
    throw new Error(`Local model failed: ${err.message}`);
}
```

---

### Step 3: Rewire memory-keeper

**`orchestrator/src/memory-keeper.ts`** — Replace OpenAI import with local helper:

```typescript
// BEFORE:
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extract(text: string): Promise<ExtractResult> {
    const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: `You decide if a message contains...` },
            { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' }
    });
    // ...
}

// AFTER:
import { simpleCompletion } from './local-llm.js';

async function extract(text: string): Promise<ExtractResult> {
    const systemPrompt = `You decide if a message contains something worth preserving as a memory.
Save it if it contains: a story from her life (STORY), a meaningful feeling (FEELING), a specific memory or experience (MOMENT), a hope or wish (WISH), or a reflection on life (REFLECTION).
Do NOT save casual chat, questions, small talk, or short replies.
Respond with JSON only — no other text.
If worth saving: {"save":true,"category":"STORY|FEELING|MOMENT|WISH|REFLECTION","memory":"distilled in 1-2 warm sentences"}
If not: {"save":false}`;

    const { reply, usage } = await simpleCompletion(systemPrompt, text, { jsonMode: true });

    try {
        const result = JSON.parse(reply.trim());
        return {
            ...result,
            usage: { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens }
        };
    } catch {
        return { save: false };
    }
}
```

---

### Step 4: Rewire letter-scheduler

**`orchestrator/src/letter-scheduler.ts`** — Same pattern:

```typescript
// BEFORE:
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateLetter(seed, memories) {
    const response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
    });
    return response.choices[0]?.message?.content;
}

// AFTER:
import { simpleCompletion } from './local-llm.js';

async function generateLetter(seed, memories) {
    // Use the big model for creative writing quality
    const { reply } = await simpleCompletion('', prompt, { model: 'qwen2.5:32b' });
    return reply;
}
```

---

### Step 5: Rewire graders + optimizer

These only run in DEV_MODE, so they're safe to experiment with.

**`orchestrator/src/graders/holistic-strategy.ts`** — LLM-as-judge grader:

```typescript
// BEFORE:
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function grade(interaction: InteractionRecord): Promise<GradeResult> {
    const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: GRADER_SYSTEM_PROMPT },
            { role: 'user', content: formatInteraction(interaction) }
        ],
        response_format: { type: 'json_object' }
    });
    // parse score 1-5 → 0.0-1.0
}

// AFTER:
import { simpleCompletion } from '../local-llm.js';

async function grade(interaction: InteractionRecord): Promise<GradeResult> {
    const { reply } = await simpleCompletion(
        GRADER_SYSTEM_PROMPT,
        formatInteraction(interaction),
        { jsonMode: true }
    );

    try {
        const parsed = JSON.parse(reply.trim());
        const score = (parsed.score - 1) / 4; // 1-5 → 0.0-1.0
        return {
            grader: 'holistic_strategy',
            score,
            passed: score >= 0.5,
            reasoning: parsed.reasoning ?? '',
            suggestion: parsed.suggestion ?? '',
        };
    } catch {
        return { grader: 'holistic_strategy', score: null, passed: true, reasoning: 'Parse error', suggestion: '' };
    }
}
```

**`orchestrator/src/graders/result-integration.ts`** — Same pattern, different prompt:

```typescript
// AFTER (same approach):
import { simpleCompletion } from '../local-llm.js';

async function grade(interaction: InteractionRecord): Promise<GradeResult> {
    const { reply } = await simpleCompletion(
        RESULT_INTEGRATION_PROMPT,
        formatInteraction(interaction),
        { jsonMode: true }
    );

    try {
        const parsed = JSON.parse(reply.trim());
        const score = (parsed.score - 1) / 4;
        return {
            grader: 'result_integration',
            score,
            passed: score >= 0.5,
            reasoning: parsed.reasoning ?? '',
            suggestion: parsed.suggestion ?? '',
        };
    } catch {
        return { grader: 'result_integration', score: null, passed: true, reasoning: 'Parse error', suggestion: '' };
    }
}
```

**`orchestrator/src/optimizer.ts`** — The most complex Tier 2 component. It builds a metaprompt from grader stats, asks the LLM to rewrite tool-use sections, then validates the candidate:

```typescript
// BEFORE:
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function optimizePrompt(currentPrompt, graderStats, worstInteractions) {
    const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: metaprompt }],
    });
    return response.choices[0]?.message?.content;
}

// AFTER:
import { simpleCompletion } from './local-llm.js';

async function optimizePrompt(currentPrompt, graderStats, worstInteractions) {
    // Optimizer needs careful reasoning — use the big model
    // The 7B model struggles with metaprompt-level reasoning
    const { reply } = await simpleCompletion('', metaprompt, { model: 'qwen2.5:32b' });
    return reply;
}
```

**Note on optimizer:** The validation pipeline (must include all tool names, identity section immutable, min 200 chars, rollback if score < 90% of parent) stays exactly the same — it's rule-based, no LLM involved.

---

### Step 6: Rewire cowork-mcp

**`cowork-mcp/src/index.ts`** — Replace Anthropic SDK with OpenAI SDK pointed at Ollama:

```typescript
// BEFORE:
import Anthropic from '@anthropic-ai/sdk';
const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514';

function getClient(): Anthropic {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function callClaude(messages, system?, model?) {
    const client = getClient();
    const response = await client.messages.create({
        model, max_tokens: MAX_TOKENS, messages, system
    });
    // ...extract text blocks...
}

// AFTER:
import OpenAI from 'openai';
const DEFAULT_MODEL = process.env.LOCAL_MODEL ?? 'qwen2.5:32b';

const client = new OpenAI({
    baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    apiKey: 'ollama',
});

async function callModel(
    messages: Array<{ role: string; content: string }>,
    system?: string,
    model: string = DEFAULT_MODEL
): Promise<string> {
    const allMessages: OpenAI.ChatCompletionMessageParam[] = [];
    if (system) allMessages.push({ role: 'system', content: system });
    allMessages.push(...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
    })));

    const response = await client.chat.completions.create({
        model,
        max_tokens: MAX_TOKENS,
        messages: allMessages,
    });

    const text = response.choices[0]?.message?.content ?? '';
    log(`Tokens — in: ${response.usage?.prompt_tokens}, out: ${response.usage?.completion_tokens}`);
    return truncate(text);
}
```

Then update each `registerTool` to call `callModel()` instead of `callClaude()`. The tool schemas stay identical — only the internal call changes.

The `claude_multimodal_task` tool should return a stub in offline mode:

```typescript
// In the multimodal tool handler:
if (process.env.OFFLINE_MODE === 'true') {
    return 'Multimodal analysis not available in offline mode. Use text-only tasks instead.';
}
```

---

### Step 7: Rewire Julia-Web (frontend chat)

**`frontend/server.ts`** — Julia-Web has its own AI brain. The Vercel AI SDK has an Ollama provider:

```bash
cd frontend && npm install ollama-ai-provider
```

```typescript
// BEFORE:
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

function getModel(modelId: string) {
    switch (modelId) {
        case 'claude-sonnet': return anthropic('claude-sonnet-4-20250514');
        case 'gpt-4o':
        default: return openai('gpt-4o');
    }
}

// AFTER:
import { ollama } from 'ollama-ai-provider';

function getModel(modelId: string) {
    // All models are local now
    switch (modelId) {
        case 'fast': return ollama('qwen2.5:7b');
        case 'qwen-32b':
        default: return ollama('qwen2.5:32b');
    }
}
```

The `streamText()` call, tools, and everything else stays the same — the Vercel AI SDK abstracts the provider.

**Julia-Web's 4 tools in offline mode:**
- `send_to_orchestrator` — Still works (routes via Bridge on localhost)
- `ask_claude` — Still works (hits Cowork-MCP on localhost:3003, now backed by Ollama)
- `get_tasks` — Still works (Backend on localhost:3000)
- `get_memories` — Still works (Backend on localhost:3000)

Julia-Web is the **ideal offline interface** — everything it needs is on localhost.

---

### Step 8: Update environment variables

**`orchestrator/.env`** (replaces cloud keys):

```bash
# No more cloud API keys needed for the orchestrator
# OPENAI_API_KEY=...     ← remove
# ANTHROPIC_API_KEY=...  ← remove

# Local Ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
LOCAL_MODEL_PRIMARY=qwen2.5:32b
LOCAL_MODEL_FAST=qwen2.5:7b
```

**`cowork-mcp/.env`**:

```bash
# ANTHROPIC_API_KEY=...  ← remove
OLLAMA_BASE_URL=http://localhost:11434/v1
LOCAL_MODEL=qwen2.5:32b
```

**`frontend/.env.local`**:

```bash
# OPENAI_API_KEY=...     ← remove
# ANTHROPIC_API_KEY=...  ← remove
# (ollama-ai-provider auto-connects to localhost:11434)
```

**`.env.secrets`** (global):

```bash
# Keep these (still needed):
TELEGRAM_BOT_TOKEN=...    # only used when online
TELEGRAM_CHAT_ID=...      # only used when online

# Add:
OFFLINE_MODE=true         # set to false when online

# Remove or comment out:
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
```

---

### Step 9: Add Ollama to PM2 + Health Monitoring

Ollama is now the most critical single dependency — if it dies, every AI brain dies. Manage it properly.

**Add to `ecosystem.config.js`:**

```javascript
// Ollama — Local LLM inference server
// Must start BEFORE orchestrator, cowork-mcp, and frontend
{
    name: 'ollama',
    script: '/usr/local/bin/ollama',  // or: /opt/homebrew/bin/ollama
    args: 'serve',
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    env: {
        OLLAMA_HOST: '0.0.0.0:11434',
        // Optional: limit VRAM usage
        // OLLAMA_MAX_LOADED_MODELS: '2',
    }
},
```

**Add Ollama health check to `health-checker/scripts/health_check.sh`:**

In the HTTP health checks section, add:

```bash
# ── Ollama (LLM inference) ──────────────────────────────────────────────
OLLAMA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:11434/api/tags" 2>/dev/null)
if [ "$OLLAMA_RESPONSE" != "200" ]; then
    add_issue "ollama" "critical" "inference" "CRITICAL: Ollama LLM server not responding (HTTP $OLLAMA_RESPONSE) — ALL AI brains are offline"
else
    # Verify models are loaded
    MODEL_COUNT=$(curl -s http://localhost:11434/api/tags 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    models = [m['name'] for m in data.get('models', [])]
    has_32b = any('qwen2.5:32b' in m for m in models)
    has_7b = any('qwen2.5:7b' in m for m in models)
    if not has_32b: print('MISSING:qwen2.5:32b')
    elif not has_7b: print('MISSING:qwen2.5:7b')
    else: print('OK')
except: print('ERROR')
" 2>/dev/null || echo "ERROR")

    if [[ "$MODEL_COUNT" == MISSING* ]]; then
        MISSING_MODEL="${MODEL_COUNT#MISSING:}"
        add_issue "ollama_model" "high" "inference" "WARNING: Ollama running but $MISSING_MODEL not available"
    fi
fi
```

---

### Step 10: Update start-system.sh with warm-up

Add Ollama to the boot sequence. Insert after the Docker wait block and before PM2 starts:

```bash
# ── 2.5. Ensure Ollama is running + warm up models ─────────────────────────
echo "[2.5/9] Starting Ollama..."
if command -v ollama &>/dev/null; then
    # Start Ollama server if not already running
    if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
        ollama serve &
        sleep 5
    fi

    # Verify models are available
    MODELS_OK=true
    if ! ollama list | grep -q "qwen2.5:32b"; then
        echo "  WARNING: qwen2.5:32b not found. Run: ollama pull qwen2.5:32b"
        MODELS_OK=false
    fi
    if ! ollama list | grep -q "qwen2.5:7b"; then
        echo "  WARNING: qwen2.5:7b not found. Run: ollama pull qwen2.5:7b"
        MODELS_OK=false
    fi

    # Warm up the primary model (first inference loads into VRAM — takes 10-30s)
    if [ "$MODELS_OK" = true ]; then
        echo "[2.5/9] Warming up qwen2.5:32b (loading into VRAM)..."
        curl -s http://localhost:11434/v1/chat/completions \
            -H "Content-Type: application/json" \
            -d '{"model":"qwen2.5:32b","messages":[{"role":"user","content":"hello"}],"max_tokens":1}' \
            > /dev/null 2>&1
        echo "[2.5/9] Model warm-up complete."
    fi

    echo "[2.5/9] Ollama ready."
else
    echo "[2.5/9] ERROR: ollama not installed. Install from https://ollama.com"
fi
```

---

## Migration Order (recommended)

Do it in this order so you can test each piece:

1. **Install Ollama + pull models** — zero code changes, just verify models load and warm up
2. **Memory-keeper** (Tier 2, LOW) — simplest swap, easy to test, low risk
3. **Letter-scheduler** (Tier 2, LOW) — creative writing, easy to verify quality
4. **Graders + optimizer** (Tier 2, LOW-MEDIUM) — dev mode only, safe to experiment
5. **Cowork-MCP** (Tier 3, MEDIUM) — delegation layer, test each of the 6 MCP tools
6. **Julia-Orchestrator brain** (Tier 1, HIGH) — the critical path, test tool calling extensively with all 5 tools
7. **Julia-Web chat** (Tier 1, MEDIUM) — has its own brain + 4 tools, test streaming + delegation
8. **Health monitoring** — add Ollama to health checker + ecosystem.config.js
9. **Offline mode** — add OFFLINE_MODE env var, test without internet

---

## Rollback Plan (Hybrid Mode)

If Qwen2.5-32B tool calling isn't reliable enough, you can run hybrid mode instead of fully offline:

### Option A: Keep cloud as fallback

```typescript
// In local-llm.ts — add cloud fallback:
import OpenAI from 'openai';

const localClient = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama',
});

const cloudClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // only set if available
});

export async function generateReply(history: Turn[]): Promise<GenerateResult> {
    try {
        // Try local first
        return await generateWithClient(localClient, PRIMARY_MODEL, history);
    } catch (localErr) {
        if (process.env.OPENAI_API_KEY) {
            console.warn(`[local-llm] Local failed, falling back to cloud: ${localErr.message}`);
            return await generateWithClient(cloudClient, 'gpt-4o', history);
        }
        throw localErr;
    }
}
```

### Option B: Per-component migration

Don't migrate everything at once. You can run:
- Orchestrator on **local** (high volume, cost savings)
- Cowork-MCP on **cloud Claude** (complex tasks, quality matters)
- Julia-Web on **local** (interactive, latency-tolerant)

Just keep the relevant API keys in `.env` and only swap the components where Qwen is good enough.

### Option C: Full rollback

To undo the migration entirely:
1. Restore `claude.ts` + `openai.ts` imports in orchestrator
2. Restore Anthropic SDK in cowork-mcp
3. Restore `@ai-sdk/openai` + `@ai-sdk/anthropic` in frontend
4. Re-add API keys to `.env.secrets`
5. Remove Ollama from ecosystem.config.js

Keep `local-llm.ts` and the Ollama setup — you can switch back to local anytime.

---

## Ambient Agents in Offline Mode

The 6 ambient agents (Health Checker, Sentinel, Docs Agent, Task Manager, ADHD Agent, Architecture Agent) do NOT use LLMs — they're bash/Python scripts. They work identically offline with one exception: **Telegram alerting fails silently**.

### Solution: Local alert sink

Add to `health-checker/scripts/health_check.sh` (and all agents that call `send_telegram`):

```bash
send_alert() {
    local message="$1"

    # Always write to local alert log
    echo "[$(date +%Y-%m-%dT%H:%M:%S)] $message" >> "$PROJECT_DIR/shared-findings/alerts.log"

    # Try Telegram (fails silently if offline)
    if [ "${OFFLINE_MODE}" != "true" ]; then
        send_telegram "$message"
    fi
}
```

The Architecture Agent should also discover Ollama as a topology node when scanning — it's as critical as the bridge or backend.

---

## Known Risks & Mitigations

### Tool calling reliability

Qwen2.5-32B is the best open model for tool calling, but it's still a step down from GPT-4o / Claude Haiku. Expect:

- Occasional malformed JSON in tool arguments
- Sometimes choosing the wrong tool (e.g. `ask_claude` when it should answer directly)
- Extra iterations before converging on a final reply

**Mitigations:**
- JSON validation is built into `local-llm.ts` (catches parse errors, sends error back to model for retry)
- Make tool descriptions shorter and more distinct (reduce confusion between tools)
- Consider reducing `MAX_TOOL_ITERATIONS` from 5 to 3 with a better fallback message
- Tighten the system prompt's tool-use instructions
- If quality is unacceptable, use the hybrid rollback (Option A above)

### Response speed

Local inference on M4 Max is fast but not cloud-fast. Expect:
- Qwen2.5-32B: ~15-25 tokens/sec on M4 Max 64GB
- Qwen2.5-7B: ~40-60 tokens/sec

For the orchestrator's Telegram use case (not real-time), this is fine. For Julia-Web's streaming chat, users will notice slightly slower responses but it's still usable.

### JSON mode

Ollama supports `response_format: { type: 'json_object' }` but smaller models sometimes break out of JSON. The memory-keeper's extract function should have a try/catch fallback (it already does).

### No multimodal (for now)

The `claude_multimodal_task` tool in cowork-mcp returns a stub in offline mode ("Multimodal not available") until you want to add a vision model later (e.g. LLaVA or Qwen2-VL).

### Model cold start

First inference after Ollama loads a model into VRAM takes 10-30 seconds. The boot sequence includes a warm-up request to avoid this hitting the first real user message. If the model gets evicted from VRAM (memory pressure), the next request will be slow — consider setting `OLLAMA_KEEP_ALIVE=24h` to prevent eviction.

### Concurrent requests

Ollama handles concurrent requests by queuing them. If Julia-Web AND the Orchestrator both send requests simultaneously, one waits. On 64GB this is fine for 1-2 concurrent users. On 128GB you could run two model instances.

---

## What You Can Remove

After migration, these dependencies are no longer needed:

```bash
# In orchestrator/
npm uninstall @anthropic-ai/sdk   # unless keeping for hybrid fallback

# In cowork-mcp/
npm uninstall @anthropic-ai/sdk

# In frontend/
npm uninstall @ai-sdk/openai @ai-sdk/anthropic
npm install ollama-ai-provider

# Environment
# Delete OPENAI_API_KEY and ANTHROPIC_API_KEY from all .env files
# Keep .env.secrets but remove the API keys (keep TELEGRAM_BOT_TOKEN etc.)
```

---

## Quick Test Checklist

After each step, verify:

- [ ] `ollama list` shows both models
- [ ] `curl http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"qwen2.5:32b","messages":[{"role":"user","content":"hello"}]}'` returns a response
- [ ] Memory-keeper: send a message > 30 chars via Telegram (or Julia-Web), check backend for saved memory
- [ ] Letter-scheduler: set `LETTER_HOUR` to current hour, wait 30 min, check `/letters` endpoint
- [ ] Graders: set `DEV_MODE=true`, send a message that triggers tool use, check evaluation logs
- [ ] Cowork-MCP: `curl -X POST http://localhost:3003/task -H 'Content-Type: application/json' -d '{"task":"What is 2+2?"}'`
- [ ] Julia-Orchestrator: send a Telegram message, verify tool calling works (try `/tasks`, ask to send an email)
- [ ] Julia-Web: open `http://localhost:3002`, chat with Julia, verify streaming works + ask_claude delegation
- [ ] Health Checker: verify `pm2 info ollama` shows online, check health check output includes Ollama status
- [ ] Offline test: disconnect WiFi, verify Julia-Web still works end-to-end via localhost

---

*Created: 2026-03-08 · Updated: 2026-03-08 · For: juliaz_agents offline migration*
*Components: Julia-Orchestrator, Julia-Web, Julia-Bridge, OpenClaw, Cowork-MCP, Backend, 6 Ambient Agents*
