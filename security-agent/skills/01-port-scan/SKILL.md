---
name: port-scan
description: Scan all open ports on localhost and detect unexpected listeners across all services
---

# Skill: Port Scanner

## Purpose
Detect any port that is listening on the machine that shouldn't be — whether a misconfigured service, rogue process, or leftover dev server.

## What It Checks
- All TCP/UDP ports currently listening (`lsof -iTCP -iUDP -sTCP:LISTEN`)
- Compare against the known-good baseline of expected ports:
  - `3000` — Backend API (Docker)
  - `3001` — Bridge
  - `3002` — Frontend
  - `3003` — Cowork MCP
  - `5432` — PostgreSQL (internal Docker only — should NOT be externally accessible)
- Flag any port NOT in the baseline
- Flag any baseline port that is missing (service down)
- Flag any port listening on `0.0.0.0` (all interfaces) vs `127.0.0.1` (localhost only)

## Commands
```bash
# All listening TCP ports
lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null

# Check if PostgreSQL is accidentally exposed externally
lsof -iTCP:5432 -n -P 2>/dev/null | grep -v "127.0.0.1\|localhost"
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| Unknown port open | 🟠 High |
| Known port listening on 0.0.0.0 unexpectedly | 🟠 High |
| Baseline port missing (service down) | 🟡 Medium |
| DB port externally exposed | 🔴 Critical |

## Output Format
```
PORT SCAN
✅ Expected ports: 3000, 3001, 3002, 3003
⚠️  New port found: 8080 (process: node, PID: 1234)
🔴 PostgreSQL exposed on 0.0.0.0:5432
```
