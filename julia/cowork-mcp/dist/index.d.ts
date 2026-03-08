/**
 * Cowork MCP Server — Claude as a Multimodal Sub-Agent
 *
 * Exposes Claude (Anthropic API) as a set of MCP tools so Julia's orchestrator
 * and any other agent in the system can delegate tasks to Claude.
 *
 * Transport: Streamable HTTP on port 3003
 * MCP endpoint: http://localhost:3003/mcp
 * Health:       http://localhost:3003/health
 *
 * Tools:
 *   claude_task              — Send any text task to Claude, get a response
 *   claude_multimodal_task   — Send text + image(s) to Claude (base64 or URL)
 *   claude_code_review       — Ask Claude to review code with a specific lens
 *   claude_summarize         — Summarize a block of content
 *   claude_brainstorm        — Generate ideas or plans for a goal
 *   cowork_status            — Health check / capabilities
 */
import 'dotenv/config';
//# sourceMappingURL=index.d.ts.map