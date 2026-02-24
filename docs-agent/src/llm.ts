import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Finding, SystemChange, LLMAnalysis, DocTargetType } from './types.js';
import { buildDriftAnalysisPrompt, buildDocGenerationPrompt } from './prompt.js';
import { RulesFallback } from './rules-fallback.js';

/**
 * DocsAgentLLM implements the LLM fallback chain for documentation reasoning:
 *   1. Claude Haiku (primary — fast, cheap, good at structured output)
 *   2. GPT-4o (fallback — if Anthropic API is down or key missing)
 *   3. RulesFallback (no LLM — deterministic skeleton generation, always available)
 *
 * Two modes:
 *   - analyzeDrift(): Semantic analysis of structural findings + system changes
 *   - generateDoc(): Generate actual markdown content for a documentation proposal
 */
export class DocsAgentLLM {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private fallback = new RulesFallback();

  constructor() {
    try {
      this.anthropic = new Anthropic();
    } catch {
      console.log('[docs-agent] Anthropic SDK not configured — will try OpenAI or fallback');
    }
    try {
      this.openai = new OpenAI();
    } catch {
      console.log('[docs-agent] OpenAI SDK not configured — will use rules fallback if Haiku fails');
    }
  }

  // ── Mode 1: Drift Analysis ────────────────────────────────────────────────

  async analyzeDrift(findings: Finding[], changes: SystemChange[]): Promise<LLMAnalysis> {
    const systemPrompt = buildDriftAnalysisPrompt();
    const userMessage = JSON.stringify({
      structural_findings: findings,
      system_changes: changes,
      current_time: new Date().toISOString(),
    });

    // Try Haiku first
    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-haiku-4-20250414',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = this.parseAnalysis(text);
        if (parsed) {
          console.log('[docs-agent] Drift analysis via Haiku');
          return parsed;
        }
      } catch (e) {
        console.log('[docs-agent] Haiku failed, trying GPT-4o:', (e as Error).message);
      }
    }

    // Fallback to GPT-4o
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 2048,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
        });
        const text = response.choices[0]?.message?.content || '';
        const parsed = this.parseAnalysis(text);
        if (parsed) {
          console.log('[docs-agent] Drift analysis via GPT-4o');
          return parsed;
        }
      } catch (e) {
        console.log('[docs-agent] GPT-4o failed, using rules fallback:', (e as Error).message);
      }
    }

    // Final fallback: rules-based (always available)
    console.log('[docs-agent] Using rules-based fallback (no LLM available)');
    return this.fallback.analyzeDrift(findings, changes);
  }

  // ── Mode 2: Document Generation ───────────────────────────────────────────

  async generateDoc(context: string, targetType: DocTargetType, targetFile: string): Promise<string> {
    const systemPrompt = buildDocGenerationPrompt(targetType);
    const userMessage = `Generate documentation for: ${targetFile}\n\nContext:\n${context}`;

    // Try Haiku first
    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-haiku-4-20250414',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        if (text.trim().length > 50) {
          console.log(`[docs-agent] Doc generation via Haiku for ${targetFile}`);
          return this.extractMarkdown(text);
        }
      } catch (e) {
        console.log('[docs-agent] Haiku doc gen failed, trying GPT-4o:', (e as Error).message);
      }
    }

    // Fallback to GPT-4o
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        });
        const text = response.choices[0]?.message?.content || '';
        if (text.trim().length > 50) {
          console.log(`[docs-agent] Doc generation via GPT-4o for ${targetFile}`);
          return this.extractMarkdown(text);
        }
      } catch (e) {
        console.log('[docs-agent] GPT-4o doc gen failed, using skeleton:', (e as Error).message);
      }
    }

    // Final fallback: skeleton template
    console.log(`[docs-agent] Using skeleton template for ${targetFile}`);
    return this.fallback.generateDoc(context, targetFile);
  }

  // ── Parsing helpers ───────────────────────────────────────────────────────

  private parseAnalysis(text: string): LLMAnalysis | null {
    try {
      // Extract JSON from potential markdown code fences
      const jsonMatch = text.match(/```json\n?([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      const parsed = JSON.parse(jsonStr.trim());

      // Validate minimal structure
      if (!Array.isArray(parsed.drift_assessments) || !Array.isArray(parsed.proposals)) {
        console.log('[docs-agent] LLM response missing required fields');
        return null;
      }

      return {
        drift_assessments: parsed.drift_assessments || [],
        proposals: parsed.proposals || [],
        telegram_summary: parsed.telegram_summary || '',
      };
    } catch (e) {
      console.log('[docs-agent] Failed to parse LLM analysis:', (e as Error).message);
      return null;
    }
  }

  /**
   * Extract markdown content from LLM response.
   * If the response is wrapped in ```markdown fences, extract the inner content.
   * Otherwise return as-is.
   */
  private extractMarkdown(text: string): string {
    const mdMatch = text.match(/```(?:markdown|md)\n?([\s\S]*?)```/);
    return mdMatch ? mdMatch[1].trim() : text.trim();
  }
}
