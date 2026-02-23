---
name: docker-security
description: Audit Docker containers for security misconfigurations, exposed ports, and resource abuse
---

# Skill: Docker Security Audit

## Purpose
Docker containers add a layer of security but also a layer of risk. Misconfigured containers can expose databases, run as root, or allow container escape. This skill checks all of that.

## What It Checks

### Container Configuration
- Containers running as root (should specify non-root user)
- Containers with `--privileged` flag (full host access)
- Mounts of sensitive host directories (`/etc`, `/home`, `/var`)
- Environment variables with secrets baked into the image

### Port Exposure
- Ports published to `0.0.0.0` (all interfaces) vs. `127.0.0.1` (localhost)
- PostgreSQL port `5432` — must NEVER be published outside localhost

### Resource Limits
- Containers without memory limits (can starve the host)
- Containers without CPU limits

### Image Security
- Images not updated in >30 days
- Images pulled from unverified registries (not docker.io or ghcr.io)

## Commands
```bash
# Container status and ports
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null

# Check for root user
docker inspect $(docker ps -q) 2>/dev/null \
  | python3 -c "
import json, sys
containers = json.load(sys.stdin)
for c in containers:
    name = c['Name']
    user = c['Config'].get('User', 'root (default)')
    mounts = [m['Source'] for m in c.get('Mounts', [])]
    print(f'{name}: user={user}, mounts={mounts}')
"

# Check for privileged containers
docker inspect $(docker ps -q) 2>/dev/null | grep -i privileged
```

## Severity Rules
| Finding | Severity |
|---------|----------|
| `--privileged` container | 🔴 Critical |
| DB port exposed to 0.0.0.0 | 🔴 Critical |
| Container running as root | 🟠 High |
| Sensitive host mount | 🟠 High |
| No memory limit | 🟡 Medium |
| Image >30 days old | 🟢 Low |

## Output Format
```
DOCKER SECURITY
postgres: ✅ localhost only, no privileged
api:      ⚠️  running as root — add USER directive to Dockerfile
          🔴 port 5432 exposed on 0.0.0.0 (should be 127.0.0.1 only)
```
