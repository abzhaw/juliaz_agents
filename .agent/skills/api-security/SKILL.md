---
name: api-security
description: Auth patterns, rate limiting, input validation, CORS, HTTPS. Use when securing Julia's backend API, bridge, or any HTTP endpoint.
---

# API Security

## Input Validation (Zod)
```ts
import { z } from 'zod';
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

app.post('/tasks', (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });
  // use result.data — fully typed and validated
});
```

## Rate Limiting
```ts
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api', limiter);
```

## CORS
```ts
import cors from 'cors';
app.use(cors({
  origin: ['http://localhost:3002'],  // only allow frontend
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
}));
```

## API Key Auth (simple internal services)
```ts
const API_KEY = process.env.INTERNAL_API_KEY;
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
app.use('/api', requireApiKey);
```

## Security Headers
```ts
import helmet from 'helmet';
app.use(helmet());  // sets X-Frame-Options, CSP, HSTS, etc.
```

## Julia's Security Surface
- Backend (port 3000): Docker-internal only, not exposed to internet
- Bridge (port 3001): localhost only, no auth (internal)
- Frontend (port 3002): public if forwarded, add auth if needed
- cowork-mcp (port 3003): localhost only
