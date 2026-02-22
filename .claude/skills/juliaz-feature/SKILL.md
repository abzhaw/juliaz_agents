---
name: juliaz-feature
description: "Adding new features to the juliaz_agents system — new tools, API endpoints, frontend components, MCP tools, or capabilities. Trigger when Raphael wants to: add a new tool to the orchestrator or bridge, create a new API endpoint in the backend, add a frontend component or page, extend cowork-mcp with new Claude tools, add a new OpenClaw skill, or implement any new capability across the system. Also trigger for 'add a tool', 'new endpoint', 'new page', 'new component', 'extend Julia', 'Julia should be able to...', or any request to add functionality to the multi-agent system."
---

# juliaz-feature — Adding Features to Julia's Ecosystem

> This skill knows where code goes and what patterns to follow when adding new capabilities to juliaz_agents.

## Decision Tree: Where Does This Feature Go?

```
Is it a new capability Julia can use in conversations?
  → Add a tool to orchestrator/src/tools.ts

Is it a new way to delegate work to Claude?
  → Add an MCP tool to cowork-mcp/src/index.ts

Is it a new bridge operation (message routing, queue management)?
  → Add MCP tool + REST endpoint to bridge/src/index.ts

Is it persistent data storage?
  → Add Prisma model + REST endpoints to backend/

Is it a UI feature?
  → Add component/page to frontend/

Is it a communication channel feature?
  → Add OpenClaw skill in openclaw/skills/

Is it an ambient/scheduled task?
  → Create new agent (use juliaz-agent-builder skill)
```

## Adding a Tool to the Orchestrator

Tools are what Julia can call during conversations. They live in `orchestrator/src/tools.ts`.

### Step 1: Define the tool

Follow the existing Anthropic tool definition format:

```typescript
// In orchestrator/src/tools.ts

// Add to the tools array
{
  name: "your_tool_name",
  description: "Clear description of what this tool does and WHEN Julia should use it",
  input_schema: {
    type: "object" as const,
    properties: {
      param_name: {
        type: "string",
        description: "What this parameter is for"
      }
    },
    required: ["param_name"]
  }
}
```

### Step 2: Add execution logic

In the same file, add a case to the tool execution switch:

```typescript
case "your_tool_name": {
  const { param_name } = toolInput as { param_name: string };
  // Your logic here
  const result = await doSomething(param_name);
  return JSON.stringify(result);
}
```

### Step 3: Update Julia's system prompt

Edit `orchestrator/src/prompt.ts` to tell Julia about the new capability. Julia needs to know WHEN to use the tool, not just that it exists.

### Step 4: Test

Restart orchestrator: `pm2 restart orchestrator`
Send a Telegram message that should trigger the tool.

## Adding an MCP Tool to Bridge

Bridge MCP tools are used by the orchestrator to interact with the message queue.

### Pattern

```typescript
// In bridge/src/index.ts

server.tool(
  "tool_name",
  "Description of what this tool does",
  {
    // Zod-style schema (bridge uses inline JSON schema)
    param: { type: "string", description: "..." }
  },
  async ({ param }) => {
    // Tool logic — typically reads/writes queue
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);
```

After adding, restart bridge: `pm2 restart bridge`

## Adding an MCP Tool to Cowork MCP

Cowork MCP wraps Claude API calls as tools. Each tool delegates a specific kind of task to Claude.

### Pattern

```typescript
// In cowork-mcp/src/index.ts

server.tool(
  "claude_your_tool",
  "Description",
  {
    // Input schema
    input: z.string().describe("The input"),
    // Optional params
    model: z.string().optional().describe("Override model")
  },
  async ({ input, model }) => {
    const response = await anthropic.messages.create({
      model: model || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: input }],
      // Optional: system prompt for this tool
      system: "You are a specialist in..."
    });

    const text = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    return {
      content: [{ type: "text", text: truncate(text) }]
    };
  }
);
```

### Tool Annotations

Cowork MCP uses tool annotations for safety:
```typescript
{
  readOnlyHint: true,      // Tool doesn't modify state
  destructiveHint: false,  // Tool doesn't delete anything
  idempotentHint: true     // Safe to retry
}
```

After adding, rebuild and restart: `cd cowork-mcp && npm run build && pm2 restart cowork-mcp`

## Adding a Backend API Endpoint

### Step 1: Add Prisma model (if new data)

Edit `backend/prisma/schema.prisma`:

```prisma
model YourModel {
  id        Int      @id @default(autoincrement())
  field     String
  createdAt DateTime @default(now())
}
```

Then migrate:
```bash
cd backend && npx prisma migrate dev --name add_your_model
```

### Step 2: Add REST endpoints

In `backend/src/index.ts`, follow the existing pattern:

```typescript
// GET all
app.get("/your-models", asyncHandler(async (req, res) => {
  const items = await prisma.yourModel.findMany({
    orderBy: { createdAt: "desc" }
  });
  res.json(items);
}));

// POST create
app.post("/your-models", asyncHandler(async (req, res) => {
  const { field } = req.body;
  const item = await prisma.yourModel.create({
    data: { field }
  });
  res.status(201).json(item);
}));

// PATCH update
app.patch("/your-models/:id", asyncHandler(async (req, res) => {
  const item = await prisma.yourModel.update({
    where: { id: parseInt(req.params.id) },
    data: req.body
  });
  res.json(item);
}));

// DELETE
app.delete("/your-models/:id", asyncHandler(async (req, res) => {
  await prisma.yourModel.delete({
    where: { id: parseInt(req.params.id) }
  });
  res.status(204).end();
}));
```

### Step 3: Rebuild and restart

```bash
cd backend && npm run build && docker compose restart
```

## Adding a Frontend Page

### New Page

Create `frontend/app/your-page/page.tsx`:

```tsx
export default function YourPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-4">Your Page</h1>
      {/* Components */}
    </main>
  );
}
```

### New Component

Create in `frontend/components/YourComponent.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

export default function YourComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/your-endpoint")
      .then(r => r.json())
      .then(setData);
  }, []);

  return (
    <div className="bg-zinc-900 rounded-xl p-4">
      {/* Render data */}
    </div>
  );
}
```

### Frontend Chat Tool (if the feature needs AI interaction)

Add to `frontend/app/api/chat/route.ts`:

```typescript
your_tool: tool({
  description: "What this tool does",
  parameters: z.object({
    param: z.string().describe("...")
  }),
  execute: async ({ param }) => {
    // Fetch from backend or cowork-mcp
    const res = await fetch("http://localhost:3000/...");
    return await res.json();
  }
})
```

## Adding an OpenClaw Skill

OpenClaw skills live in `openclaw/skills/`. Each skill is a directory with:

```
skill-name/
├── SKILL.md       ← Instructions for the OpenClaw agent
└── (optional supporting files)
```

Example SKILL.md:
```markdown
---
name: skill-name
description: When to trigger this skill
---

# Skill Name

## When to Use
[Trigger conditions]

## Steps
1. [What to do]
2. [How to do it]

## Endpoints / APIs Used
[What this skill calls]
```

After creating, restart OpenClaw: `openclaw gateway start --force`

## Cross-Component Features

When a feature spans multiple components (e.g., "Julia should be able to search her memories"):

1. **Backend**: Add search endpoint (e.g., `GET /memories/search?q=...`)
2. **Orchestrator**: Add tool definition in `tools.ts` that calls the endpoint
3. **Orchestrator**: Update system prompt in `prompt.ts` to mention the capability
4. **Frontend** (optional): Add UI for the same search in the dashboard
5. **Restart**: `pm2 restart orchestrator bridge` (and any other affected services)

## Conventions to Follow

- **TypeScript everywhere** (except OpenClaw skills which are Markdown)
- **Express for HTTP** (backend, bridge)
- **Prisma for database** (backend only)
- **Anthropic SDK format** for tool definitions in orchestrator
- **MCP protocol** for bridge and cowork-mcp tools
- **Vercel AI SDK** for frontend streaming chat
- **Tailwind CSS** for frontend styling
- **Error handling**: wrap async routes with `asyncHandler`, use try/catch in tools
- **No authentication** currently — keep endpoints public (this is a thesis project, not production)
