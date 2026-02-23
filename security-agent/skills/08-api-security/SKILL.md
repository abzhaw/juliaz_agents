---
name: api-security
description: Audit all internal API endpoints for authentication, CORS, and rate limiting gaps
---

# Skill: API Security Audit

## Purpose
Every HTTP endpoint is a potential entry point. This skill probes all local services to check if auth is enforced, CORS is sane, and error messages don't leak internals.

## Services Audited
| Service | Base URL | Auth Expected |
|---------|----------|---------------|
| Backend API | http://localhost:3000 | Yes (JWT or session) |
| Bridge | http://localhost:3001 | Internal only |
| Frontend | http://localhost:3002 | Public (but no sensitive routes) |
| Cowork MCP | http://localhost:3003 | Internal only |

## What It Checks

### Authentication
- Can unauthenticated requests reach sensitive endpoints?
- Do 401/403 responses leak stack traces or internal info?

### CORS Headers
- Is `Access-Control-Allow-Origin: *` set on the backend? (bad)
- Are credentials allowed cross-origin?

### Error Message Leakage
- Do 500 errors expose file paths, DB schemas, or stack traces?
- Are errors sanitized before being sent to clients?

### Rate Limiting
- Can the same IP spam endpoints without throttling?
- Is there brute-force protection on auth endpoints?

## Commands
```bash
# Test unauthenticated access to backend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health

# Check CORS headers
curl -s -I -H "Origin: https://evil.com" http://localhost:3000/api/ \
  | grep -i "access-control"

# Test for stack trace in 500 errors
curl -s http://localhost:3000/api/nonexistent | head -5
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| Auth bypass on sensitive endpoint | 🔴 Critical |
| CORS wildcard with credentials | 🔴 Critical |
| Stack trace in error response | 🟠 High |
| Bridge/MCP exposed to external network | 🟠 High |
| No rate limiting on auth endpoints | 🟡 Medium |

## Output Format
```
API SECURITY
backend (3000): ✅ auth enforced, CORS restricted
bridge (3001):  ✅ localhost only, no public exposure
frontend (3002): ✅ no sensitive routes
cowork-mcp (3003): ⚠️  returns stack trace on 500 errors
```
