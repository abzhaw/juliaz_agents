import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
  AnalystResponse,
  CollectorOutput,
  IncidentState,
  CadenceState,
  Suppressions,
} from './types.js';
import { buildSystemPrompt } from './prompt.js';
import { RulesFallback } from './rules-fallback.js';

/**
 * AnalystLLM implements the LLM fallback chain:
 *   1. Claude Haiku (primary — fast, cheap, good at structured output)
 *   2. GPT-4o (fallback — if Anthropic API is down or key missing)
 *   3. RulesFallback (no LLM — deterministic rules, always available)
 *
 * The chain ensures the Analyst NEVER goes silent due to an API outage.
 */
export class AnalystLLM {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private fallback = new RulesFallback();

  constructor() {
    try {
      this.anthropic = new Anthropic();
    } catch {
      console.log('[analyst] Anthropic SDK not configured — will try OpenAI or fallback');
    }
    try {
      this.openai = new OpenAI();
    } catch {
      console.log('[analyst] OpenAI SDK not configured — will use rules fallback if Haiku fails');
    }
  }

  async analyze(
    collectorOutputs: CollectorOutput[],
    incidents: IncidentState,
    cadence: CadenceState,
    suppressions: Suppressions,
  ): Promise<AnalystResponse> {
    const systemPrompt = buildSystemPrompt(suppressions);
    const userMessage = JSON.stringify({
      collector_findings: collectorOutputs,
      open_incidents: incidents,
      last_digest_sent: cadence.last_digest_sent,
      current_time: new Date().toISOString(),
    });

    // Try Haiku first
    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-haiku-4-20250414',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = this.parseResponse(text);
        if (parsed) {
          console.log('[analyst] Analysis via Haiku');
          return parsed;
        }
      } catch (e) {
        console.log('[analyst] Haiku failed, trying GPT-4o:', (e as Error).message);
      }
    }

    // Fallback to GPT-4o
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
        });
        const text = response.choices[0]?.message?.content || '';
        const parsed = this.parseResponse(text);
        if (parsed) {
          console.log('[analyst] Analysis via GPT-4o');
          return parsed;
        }
      } catch (e) {
        console.log('[analyst] GPT-4o failed, using rules fallback:', (e as Error).message);
      }
    }

    // Final fallback: rules-based (always available, no external dependencies)
    console.log('[analyst] Using rules-based fallback (no LLM available)');
    return this.fallback.analyze(incidents, cadence);
  }

  private parseResponse(text: string): AnalystResponse | null {
    try {
      // Extract JSON from potential markdown code fences
      const jsonMatch = text.match(/```json\n?([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text;
      const parsed = JSON.parse(jsonStr.trim());

      // Validate minimal structure
      if (typeof parsed.should_notify !== 'boolean' || typeof parsed.digest !== 'string') {
        console.log('[analyst] LLM response missing required fields');
        return null;
      }

      return {
        incidents_update: parsed.incidents_update || [],
        resolved_incidents: parsed.resolved_incidents || [],
        should_notify: parsed.should_notify,
        notification_reason: parsed.notification_reason || '',
        digest: parsed.digest,
      };
    } catch (e) {
      console.log('[analyst] Failed to parse LLM response:', (e as Error).message);
      return null;
    }
  }
}
