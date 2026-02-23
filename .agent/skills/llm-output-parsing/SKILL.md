---
name: llm-output-parsing
description: Parse and validate structured output from LLMs — JSON mode, Zod validation, retry on bad output. Use when any agent needs reliable structured data from an LLM response.
---

# LLM Output Parsing

## Strategy 1: JSON Mode (OpenAI)
```ts
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'Always respond with valid JSON.' },
    { role: 'user', content: prompt }
  ],
  response_format: { type: 'json_object' }
});
const data = JSON.parse(response.choices[0].message.content!);
```

## Strategy 2: Zod Validation with Retry
```ts
import { z } from 'zod';

const TaskSchema = z.object({
  title: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().optional(),
});

async function parseWithRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    const raw = await callLLM(prompt + '\nRespond with valid JSON only.');
    try {
      const json = JSON.parse(raw);
      return schema.parse(json);
    } catch (err) {
      if (i === maxRetries - 1) throw new Error(`Failed to parse after ${maxRetries} attempts`);
      prompt += `\n\nPrevious attempt failed: ${err.message}. Try again.`;
    }
  }
}
```

## Strategy 3: Regex/Tag Extraction (fallback)
```ts
// Extract JSON from mixed-content responses
function extractJSON(text: string): object | null {
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
```

## Strategy 4: Structured Output (OpenAI latest)
```ts
const response = await openai.beta.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages,
  response_format: zodResponseFormat(TaskSchema, 'task')
});
const task = response.choices[0].message.parsed; // fully typed
```

## Best Practices
- Always validate before using — never trust raw LLM output
- Include the schema in the prompt as an example
- Log parse failures for debugging
- Retry up to 3x with error feedback in the prompt
