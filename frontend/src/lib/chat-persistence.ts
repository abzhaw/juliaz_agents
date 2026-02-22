import type { UIMessage } from "ai";

const STORAGE_KEY = "juliaz-chat-messages";
const MODEL_KEY = "juliaz-chat-model";

export type ModelId = "gpt-4o" | "claude-sonnet";

export const MODEL_LABELS: Record<ModelId, string> = {
  "gpt-4o": "GPT-4o",
  "claude-sonnet": "Claude Sonnet",
};

const MAX_STORAGE_BYTES = 4 * 1024 * 1024; // 4MB safety limit

export function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UIMessage[];
  } catch {
    return [];
  }
}

export function saveMessages(messages: UIMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    let serialized = JSON.stringify(messages);
    // Trim oldest messages if storage would exceed 4MB
    let trimmed = [...messages];
    while (serialized.length > MAX_STORAGE_BYTES && trimmed.length > 2) {
      trimmed = trimmed.slice(2); // Drop oldest user+assistant pair
      serialized = JSON.stringify(trimmed);
    }
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Storage full or unavailable — silently degrade
  }
}

export function clearMessages(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function loadModel(): ModelId {
  if (typeof window === "undefined") return "gpt-4o";
  return (localStorage.getItem(MODEL_KEY) as ModelId) ?? "gpt-4o";
}

export function saveModel(model: ModelId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_KEY, model);
}
