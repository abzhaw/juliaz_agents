/**
 * Cowork MCP Test — plain ESM, no TypeScript needed
 * Usage: node examples/test.mjs
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const COWORK_MCP_URL = process.env.COWORK_MCP_URL ?? 'http://localhost:3003/mcp';

async function createClient() {
    const transport = new StreamableHTTPClientTransport(new URL(COWORK_MCP_URL));
    const client = new Client({ name: 'julia-test-agent', version: '1.0.0' }, {
        capabilities: { tools: {} },
    });
    await client.connect(transport);
    return client;
}

async function callTool(client, toolName, args) {
    const result = await client.callTool({ name: toolName, arguments: args });
    return result.content.map((c) => c.text).join('\n');
}

function section(title) {
    console.log('\n' + '═'.repeat(50));
    console.log(`  ${title}`);
    console.log('═'.repeat(50));
}

async function run() {
    console.log('🔌 Connecting to Cowork MCP Server at', COWORK_MCP_URL);
    const client = await createClient();
    console.log('✅ Connected\n');

    // 1. Status
    section('1. cowork_status — health check');
    console.log(await callTool(client, 'cowork_status', {}));

    // 2. General task
    section('2. claude_task — general question');
    console.log(await callTool(client, 'claude_task', {
        task: 'In exactly 3 bullet points, explain what makes a well-designed MCP server.',
    }));

    // 3. Summarize
    section('3. claude_summarize — condense logs');
    console.log(await callTool(client, 'claude_summarize', {
        content: `[bridge] 2026-02-22T10:00:00Z — Incoming from @raphael (12345): "Can you check the build status?"
[orchestrator] Processing message from @raphael (12345)
[orchestrator] Tokens used — in: 1234, out: 56
[orchestrator] Reply sent to 12345: "Build is passing. Last run: 2 minutes ago."
[bridge] Reply served for 12345`,
        format: 'tldr',
        audience: 'engineering team',
    }));

    // 4. Code review
    section('4. claude_code_review — TypeScript snippet');
    console.log(await callTool(client, 'claude_code_review', {
        code: `async function getUser(id) {
  const res = await fetch('/api/users/' + id);
  const data = res.json();
  return data;
}`,
        language: 'TypeScript',
        focus: 'correctness',
        context: 'User lookup in the Julia backend API',
    }));

    // 5. Brainstorm
    section('5. claude_brainstorm — new Julia capabilities');
    console.log(await callTool(client, 'claude_brainstorm', {
        goal: 'Add new agentic capabilities to the Julia multi-agent system',
        count: 4,
        constraints: 'Must work with the existing Bridge + OpenClaw architecture',
        output_type: 'ideas',
    }));

    console.log('\n✅ All 5 tools tested successfully.');
    await client.close();
}

run().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
