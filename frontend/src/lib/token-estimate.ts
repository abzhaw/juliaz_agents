import type { UIMessage } from "ai";
import type { ModelId } from "./chat-persistence";

const CONTEXT_WINDOWS: Record<ModelId, number> = {
  "gpt-4o": 128_000,
  "claude-sonnet": 200_000,
};

// Rough heuristic: 1 token ~= 4 characters for English text
const CHARS_PER_TOKEN = 4;

export function estimateTokens(messages: UIMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === "text") {
        totalChars += part.text.length;
      }
    }
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

export function contextPercent(messages: UIMessage[], model: ModelId): number {
  const tokens = estimateTokens(messages);
  const max = CONTEXT_WINDOWS[model];
  return Math.min(100, Math.round((tokens / max) * 100));
}

export function getContextWindow(model: ModelId): number {
  return CONTEXT_WINDOWS[model];
}
