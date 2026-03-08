# juliaz_agents — Reinstallation Guide

> **Silver Lining:** This guide enables you to replicate the entire juliaz_agents multi-agent ecosystem in any new project, preserving all agent identities, skills, automation patterns, and operational workflows.

---

## What's In the Package

### 7 Agents

| Agent | Role | Schedule | Key Files |
|-------|------|----------|-----------|
| **ADHD Agent** | System hygiene — detects duplicate skills, orphaned agents, structural drift | macOS LaunchAgent every 4h | SOUL.md, IDENTITY.md, HEARTBEAT.md, 2 skills |
| **Sentinel** (Security) | Ambient security scanner — ports, credentials, dependencies, Docker, APIs, logs | PM2 cron daily 07:00 | SOUL.md, IDENTITY.md, HEARTBEAT.md, 10 skills |
| **Task Manager** | Project management — shared TODO queue, prioritization, stale detection | PM2 cron every 6h | SOUL.md, IDENTITY.md, HEARTBEAT.md |
| **Health Checker** | Watchdog — monitors all services, auto-restarts stopped processes | PM2 cron every 15min | SOUL.md, IDENTITY.md, HEARTBEAT.md |
| **Thesis Agent** (Schreiber) | Academic writing partner — German Master's thesis on agentic AI | On-demand only | SOUL.md, HEARTBEAT.md, 10 skills |
| **OpenClaw** | Telegram gateway — relays messages, manages email, runs sub-agents | Always-on (MCP polling) | SOUL.md, IDENTITY.md, HEARTBEAT.md, 17 skills |
| **Orchestrator** (Julia) | The brain — GPT-4o + tool calling, routes and answers everything | Always-on (PM2) | Defined in orchestrator/ code |

### 120+ Skills Across 5 Registries

1. **`.claude/skills/`** (9) — System-level: architecture navigation, agent building, debugging, devops, tool building, optimization, feature addition
2. **`.agent/skills/`** (77) — Generic patterns: React, Next.js, TypeScript, databases, testing, security, deployment, academic writing
3. **`openclaw/skills/`** (17) — Domain: Telegram relay, email, task management, research, agent management, coding
4. **Agent-embedded skills** (22) — Inside adhd-agent/, security-agent/, thesis-agent/
5. **Cowork skills** (1) — `adhd-focus` for session planning ritual

### Infrastructure

- PM2 ecosystem configs (dev + prod)
- macOS LaunchAgent setup for ADHD agent
- Docker Compose for backend (PostgreSQL)
- MCP bridge configuration
- Boot-time auto-start script
- DevOps 1-click startup

---

## Step-by-Step Reinstallation

### Prerequisites

```bash
# macOS (the system was built for Mac Mini)
brew install node npm docker pm2
npm install -g pm2

# Python (for security agent scripts)
pip3 install requests pyyaml

# Optional: 1Password CLI (for secrets management)
brew install 1password-cli
```

### 1. Extract the Package

```bash
# In your new project root
tar -xzf agent-package.tar.gz

# You'll get:
# agents/        — All 7 agent directories with SOUL/IDENTITY/HEARTBEAT + skills
# skills/        — All skill registries
# configs/       — PM2 configs, .env template, .mcp.json, README
# scripts/       — start-system.sh, start-devops.sh
```

### 2. Set Up Agent Directories

```bash
# Copy agents into your project root
cp -r agents/adhd-agent ./
cp -r agents/security-agent ./
cp -r agents/task-manager ./
cp -r agents/health-checker ./
cp -r agents/thesis-agent ./
cp -r agents/openclaw ./

# Copy skill registries into your IDE config
mkdir -p .claude/skills .agent/skills
cp -r skills/claude-skills/* .claude/skills/
cp -r skills/agent-skills/* .agent/skills/

# Copy the adhd-focus Cowork skill (for Claude Desktop / Cowork mode)
# This goes into your Cowork plugin's skills directory
mkdir -p .skills/skills
cp -r skills/adhd-focus-cowork .skills/skills/adhd-focus
```

### 3. Configure Environment

```bash
# Copy and fill in secrets
cp configs/.env.example .env.example
cp configs/.env.example .env.secrets

# Edit .env.secrets with your actual keys:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# TELEGRAM_BOT_TOKEN=...
# RAPHAEL_CHAT_ID=...
# DATABASE_URL=postgresql://...
```

### 4. Set Up PM2

```bash
# Copy ecosystem configs
cp configs/ecosystem.config.js ./
cp configs/ecosystem.dev.config.js ./

# Start in dev mode
pm2 start ecosystem.dev.config.js

# Or production
pm2 start ecosystem.config.js
pm2 save
```

### 5. Set Up ADHD Agent LaunchAgent (macOS)

```bash
# Create the plist file
cat > ~/Library/LaunchAgents/com.juliaz.adhd-agent.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.juliaz.adhd-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/path/to/your/project/adhd-agent/scripts/adhd_loop.sh</string>
        <string>--once</string>
    </array>
    <key>StartInterval</key>
    <integer>14400</integer>
    <key>StandardOutPath</key>
    <string>/path/to/your/project/logs/adhd-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/your/project/logs/adhd-agent-error.log</string>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLIST

# Load it
launchctl load ~/Library/LaunchAgents/com.juliaz.adhd-agent.plist
```

### 6. Set Up MCP Bridge

```bash
# Copy MCP config
cp configs/.mcp.json ./

# The bridge expects to run at localhost:3001
# Update paths in .mcp.json if your bridge location differs
```

### 7. Initialize Agent Memory

```bash
# Create memory directories for agents that need them
mkdir -p security-agent/memory security-agent/reports
mkdir -p adhd-agent/memory
mkdir -p todo
mkdir -p logs

# Initialize security baseline
echo '{}' > security-agent/memory/baseline.json
echo '[]' > security-agent/memory/suppressed.json
echo '# Sentinel Learnings' > security-agent/memory/learnings.md
```

---

## Agent Design Convention

Every agent follows the same file structure:

```
agent-name/
├── SOUL.md          # WHO: personality, values, boundaries, voice
├── IDENTITY.md      # WHAT: name, emoji, creature type, metadata
├── HEARTBEAT.md     # WHEN: schedule, triggers, health checks
├── skills/          # HOW: domain-specific capabilities (SKILL.md each)
├── scripts/         # Shell scripts for PM2/LaunchAgent execution
└── memory/          # Persistent state (baselines, learnings, logs)
```

### SOUL.md Template
```markdown
# [Agent Name]

## Who I Am
[One paragraph: core identity and metaphor]

## What I Do
[Bullet list of capabilities]

## What I Never Do Without Permission
[Hard constraints — never act unilaterally on these]

## How I Communicate
[Voice, tone, channel (Telegram, email, silent)]
```

### HEARTBEAT.md Template
```markdown
# Heartbeat — [Agent Name]

## Schedule
[Cron expression or trigger condition]

## On Each Heartbeat
1. [First check]
2. [Second check]
...

## Reporting
- Healthy: [what happens — usually silent]
- Unhealthy: [what happens — Telegram alert, email, etc.]
```

### SKILL.md Template
```markdown
# [Skill Name]

## Purpose
[One sentence]

## When to Use
[Trigger conditions]

## Inputs
[What the skill needs]

## Process
[Step-by-step what the skill does]

## Outputs
[What it produces]

## Rules
[Hard constraints and edge cases]
```

---

## Adapting for a New Project

### Rename/Rebrand
- Replace "Julia" / "juliaz_agents" with your project name
- Update SOUL.md files with new identities
- Update port numbers in ecosystem configs if conflicting
- Update Telegram chat IDs and bot tokens

### Remove What You Don't Need
- **No thesis?** Remove thesis-agent/ entirely
- **No Telegram?** Remove OpenClaw and update communication to Slack/Discord/email
- **No Docker?** Remove backend-docker from ecosystem.config.js and docker-security skill
- **No macOS?** Convert LaunchAgent to systemd (Linux) or Task Scheduler (Windows)

### Add New Agents
Use the `juliaz-agent-builder` skill (in `.claude/skills/`) — it has the complete scaffolding guide with templates.

### Port Map (Default)
| Port | Service |
|------|---------|
| 3000 | Backend (Express + PostgreSQL via Docker) |
| 3001 | Bridge (MCP glue server) |
| 3002 | Frontend (Next.js 15 dashboard) |
| 3003 | Cowork MCP (Claude sub-agent) |
| 5432 | PostgreSQL (internal, Docker only) |
| 18789 | OpenClaw gateway |

---

## The ADHD Focus Ritual

Every new session, task, or agent creation should start with this 5-step ritual (from `.skills/skills/adhd-focus/SKILL.md`):

1. **Zoom Out** — Ask "If this succeeds completely, what does that enable?" Use 5 Whys, First Principles, or Outcome Mapping.
2. **Map the Problem Space** — What do we know? What are we assuming? What are the unknowns? What could go wrong?
3. **Write the Silver Lining** — One sentence: "We are [doing X] so that [Y] can [achieve Z], which matters because [W]."
4. **Draft the Plan** — Silver lining, scope, steps, done-when, risks.
5. **Sync with System** — Check agent health, identify relevant sub-agents, note context handoffs.

This prevents the #1 failure mode in multi-agent systems: lost context leading to wasted work.

---

## Quick Reference Commands

```bash
# Start everything (dev)
bash scripts/start-devops.sh dev

# Start everything (prod, including boot auto-start)
bash scripts/start-system.sh

# Check health
pm2 list
curl -s http://localhost:3001/health
curl -s http://localhost:3002
curl -s http://localhost:3003/health

# Trigger agents manually
bash security-agent/scripts/daily-report.sh    # Sentinel scan
bash task-manager/scripts/task_check.sh         # Task queue check
bash health-checker/scripts/health_check.sh     # Health check
bash adhd-agent/scripts/adhd_loop.sh --once     # ADHD scan

# View logs
pm2 logs --lines 50
cat logs/adhd-agent.log
ls security-agent/reports/
```

---

## File Inventory

The complete package contains **526 files** across these categories:

- 15 agent definition files (SOUL/IDENTITY/HEARTBEAT)
- 120+ SKILL.md files across 5 registries
- 2 PM2 ecosystem configs
- 2 startup scripts
- 1 MCP config
- 1 environment template
- 77 generic development pattern skills
- Agent memory templates
- Reference documentation (problem methods, plan templates)

Total uncompressed size: ~3.1 MB
Compressed archive: ~507 KB
