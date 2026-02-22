/**
 * Example: Julia's Orchestrator calling Claude via cowork-mcp
 *
 * This script demonstrates how any agent in the Julia system
 * can delegate tasks to Claude using MCP over HTTP.
 *
 * Prerequisites:
 *   - cowork-mcp server running: npm run dev (port 3003)
 *   - ANTHROPIC_API_KEY set in environment
 *
 * Usage:
 *   npx tsx examples/julia-calls-claude.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const COWORK_MCP_URL = process.env.COWORK_MCP_URL ?? 'http://localhost:3003/mcp';

// ─── MCP Client Setup ─────────────────────────────────────────────────────────

async function createClient(): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(COWORK_MCP_URL));
    const client = new Client({ name: 'julia-orchestrator-example', version: '1.0.0' }, {
        capabilities: { tools: {} },
    });
    await client.connect(transport);
    return client;
}

// ─── Helper: Call a tool ──────────────────────────────────────────────────────

async function callTool(
    client: Client,
    toolName: string,
    args: Record<string, unknown>
): Promise<string> {
    const result = await client.callTool({ name: toolName, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    return content.map((c) => c.text).join('\n');
}

// ─── Demo Scenarios ───────────────────────────────────────────────────────────

async function run(): Promise<void> {
    console.log('🔌 Connecting to Cowork MCP Server at', COWORK_MCP_URL);
    const client = await createClient();
    console.log('✅ Connected\n');

    // 1. Check status
    console.log('═══════════════════════════════════════════');
    console.log('1. Check Cowork MCP Status');
    console.log('═══════════════════════════════════════════');
    const status = await callTool(client, 'cowork_status', {});
    console.log(status);
    console.log();

    // 2. General task
    console.log('═══════════════════════════════════════════');
    console.log('2. General Task: Ask Claude a question');
    console.log('═══════════════════════════════════════════');
    const taskReply = await callTool(client, 'claude_task', {
        task: 'In 3 bullet points, explain what makes a well-designed MCP server.',
    });
    console.log(taskReply);
    console.log();

    // 3. Summarize content
    console.log('═══════════════════════════════════════════');
    console.log('3. Summarize: Condense a log message');
    console.log('═══════════════════════════════════════════');
    const summary = await callTool(client, 'claude_summarize', {
        content: `[bridge] 2026-02-22T10:00:00Z — Incoming from @raphael (12345): "Can you check the build status?"
[orchestrator] 2026-02-22T10:00:01Z — Processing message from @raphael (12345): "Can you check the build status?"
[orchestrator] 2026-02-22T10:00:03Z — Tokens used — in: 1234, out: 56
[orchestrator] 2026-02-22T10:00:03Z — Reply sent to 12345: "The build is currently passing. Last run: 2 minutes ago."
[bridge] 2026-02-22T10:00:04Z — Reply served for 12345`,
        format: 'tldr',
        audience: 'engineering team',
    });
    console.log(summary);
    console.log();

    // 4. Code review
    console.log('═══════════════════════════════════════════');
    console.log('4. Code Review: Review a TypeScript snippet');
    console.log('═══════════════════════════════════════════');
    const review = await callTool(client, 'claude_code_review', {
        code: `async function getUser(id) {
  const res = await fetch('/api/users/' + id);
  const data = res.json();
  return data;
}`,
        language: 'TypeScript',
        focus: 'correctness',
        context: 'User lookup in the Julia backend API',
    });
    console.log(review);
    console.log();

    // 5. Brainstorm
    console.log('═══════════════════════════════════════════');
    console.log('5. Brainstorm: Ideas for extending Julia');
    console.log('═══════════════════════════════════════════');
    const ideas = await callTool(client, 'claude_brainstorm', {
        goal: 'Add new agentic capabilities to the Julia multi-agent system',
        count: 4,
        constraints: 'Must work with the existing Bridge + OpenClaw architecture',
        output_type: 'ideas',
    });
    console.log(ideas);
    console.log();

    console.log('✅ All demos complete. Disconnecting.');
    await client.close();
}

run().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
