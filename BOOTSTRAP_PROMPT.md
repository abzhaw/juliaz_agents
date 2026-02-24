# Bootstrap Prompt for New Project

> Copy-paste this prompt into Claude Code, Cowork, or any Claude session to set up the agent ecosystem in a new project. Adjust the bracketed values for your project.

---

## The Prompt

```
You are setting up a multi-agent system based on the juliaz_agents architecture. This system uses ambient autonomous agents for system hygiene, security, health monitoring, and task management, all coordinated through a hub-and-spoke pattern with an MCP bridge at the center.

## Project Context
- Project name: [YOUR_PROJECT_NAME]
- Project root: [YOUR_PROJECT_ROOT]
- The agent-package.tar.gz has been extracted to: [EXTRACTION_PATH]

## What To Do

### Phase 1: Agent Installation
1. Copy these agent directories from the extracted package into the project root:
   - adhd-agent/ (system hygiene, runs every 4h via macOS LaunchAgent)
   - security-agent/ (Sentinel, runs daily at 07:00 via PM2 cron)
   - task-manager/ (project management, runs every 6h via PM2 cron)
   - health-checker/ (watchdog, runs every 15min via PM2 cron)

2. Copy skill registries:
   - skills/claude-skills/* → .claude/skills/
   - skills/agent-skills/* → .agent/skills/
   - skills/adhd-focus-cowork → .skills/skills/adhd-focus (for Cowork mode)

3. Each agent has three core files:
   - SOUL.md — personality, values, boundaries (the "who")
   - IDENTITY.md — name, emoji, metadata (the "what")
   - HEARTBEAT.md — schedule, triggers, health checks (the "when")

### Phase 2: Configuration
1. Copy configs/ecosystem.config.js and configs/ecosystem.dev.config.js to project root
2. Update paths in ecosystem configs to match your project structure
3. Create .env.secrets from configs/.env.example with your actual API keys:
   - OPENAI_API_KEY (for orchestrator)
   - ANTHROPIC_API_KEY (for cowork-mcp and orchestrator)
   - TELEGRAM_BOT_TOKEN (for communication)
   - DATABASE_URL (for backend)

### Phase 3: Automation Setup
1. PM2 for scheduled agents:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # auto-start on reboot
   ```

2. macOS LaunchAgent for ADHD agent (runs every 4 hours):
   - Install plist to ~/Library/LaunchAgents/com.[project].adhd-agent.plist
   - Load with: launchctl load ~/Library/LaunchAgents/com.[project].adhd-agent.plist

3. Initialize agent memory:
   ```bash
   mkdir -p security-agent/memory security-agent/reports
   mkdir -p adhd-agent/memory
   mkdir -p todo logs
   echo '{}' > security-agent/memory/baseline.json
   ```

### Phase 4: Verify
1. Run `pm2 list` to confirm all services are running
2. Trigger each agent manually to verify:
   - `bash security-agent/scripts/daily-report.sh`
   - `bash task-manager/scripts/task_check.sh`
   - `bash health-checker/scripts/health_check.sh`
   - `bash adhd-agent/scripts/adhd_loop.sh --once`

## Agent Design Convention
Every agent follows this structure:
```
agent-name/
├── SOUL.md          # WHO: personality, values, voice
├── IDENTITY.md      # WHAT: name, emoji, metadata
├── HEARTBEAT.md     # WHEN: schedule, triggers
├── skills/          # HOW: SKILL.md per capability
├── scripts/         # Shell scripts for execution
└── memory/          # Persistent state
```

## ADHD Focus Ritual
Before any new work, run this 5-step ritual:
1. Zoom Out — "If this succeeds completely, what does that enable?"
2. Map — knowns, assumptions, unknowns, failure modes
3. Silver Lining — "We are [X] so that [Y] can [Z], which matters because [W]"
4. Plan — scope, steps, done-when, risks
5. Sync — check agent health, identify relevant sub-agents

## Key Principles
- Agents NEVER act without explicit human approval
- Silent when healthy, loud when broken
- Self-heal where safe (restart stopped services)
- Keep detailed memory/logs for transparency
- Hub-and-spoke: everything routes through the bridge
- Graceful degradation: Haiku → GPT-4o fallback
- Timeouts on everything (30s API, 45s polling, 60s delegation)
```

---

## Minimal Version (Agents Only, No Services)

If you just want the agent patterns without the full infrastructure:

```
I want to set up autonomous ambient agents for my project using the juliaz_agents pattern.

Set up these agents with SOUL.md, IDENTITY.md, and HEARTBEAT.md:

1. **System Hygiene Agent** (every 4h): Scans for duplicate skills, orphaned configs, structural drift. Proposes fixes but never acts without approval. Reports via [Telegram/Slack/email].

2. **Security Agent** (daily 07:00): Scans ports, credentials, dependencies, Docker, APIs, logs. Self-learning — updates baseline after each scan. 10 specialized skills from port scanning to self-learning.

3. **Task Manager** (every 6h): Manages shared TODO queue. Detects stale tasks, auto-unblocks resolved dependencies. Weekly summary on Mondays.

4. **Health Checker** (every 15min): Monitors all services via health endpoints. Auto-restarts stopped PM2 processes. Silent when healthy.

Each agent follows this file convention:
- SOUL.md = personality, values, boundaries
- IDENTITY.md = name, emoji, metadata
- HEARTBEAT.md = schedule, triggers, reporting rules
- skills/ = SKILL.md files for each capability
- memory/ = persistent state (baselines, learnings)

Use PM2 cron for scheduling. The ADHD agent runs via macOS LaunchAgent.
All agents communicate via Telegram Bot API. Critical = immediate alert. Low = logged silently.

Before starting any session, run the ADHD Focus ritual:
1. Zoom out (what does success unlock?)
2. Map the problem space
3. Write a one-sentence Silver Lining
4. Draft the plan with scope + done-when
5. Check system health
```
