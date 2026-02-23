---
name: rest-api-integration
description: Consuming external REST APIs, retry logic, rate limiting, auth. Use when any Julia component needs to call external services (OpenAI, Anthropic, Telegram, etc).
---

# REST API Integration

## Robust Fetch Pattern
```ts
interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeout = 30_000, retries = 3, ...fetchOpts } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOpts,
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }
      return response.json() as Promise<T>;
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1); // exponential: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}
```

## Auth Patterns
```ts
// Bearer token
headers: { Authorization: `Bearer ${process.env.API_KEY}` }

// API key in header
headers: { 'x-api-key': process.env.API_KEY }

// Basic auth
headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }
```

## Rate Limit Handling
```ts
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5');
  await sleep(retryAfter * 1000);
  // retry
}
```
