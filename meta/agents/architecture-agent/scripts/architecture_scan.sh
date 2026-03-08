#!/bin/bash
# ============================================================================
# Architecture Agent — System Topology Scanner & Neural Map Generator
# ============================================================================
# Scans the actual running system to build a ground-truth picture, then:
#   1. Generates architectureGraph.json for the frontend neural map
#   2. Detects topology changes since last scan
#   3. Updates shared-findings with architecture awareness
#   4. Alerts on significant structural changes via Telegram
#
# Schedule: Every 6 hours via PM2 cron
# Philosophy: The neural map should NEVER be stale. If the system changed,
#             the map must reflect it within one scan cycle.
# ============================================================================

set -euo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
AGENT_DIR="$PROJECT_DIR/meta/agents/architecture-agent"
MEMORY_DIR="$AGENT_DIR/memory"
FRONTEND_LIB="$PROJECT_DIR/julia/frontend/src/lib"
SHARED_FINDINGS="$PROJECT_DIR/shared-findings/incidents.json"
OVERVIEW_DOC="$PROJECT_DIR/meta/docs/agent_system_overview.md"

# Telegram config
source "$PROJECT_DIR/.env.secrets" 2>/dev/null || true
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

SCAN_TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
SCAN_DATE=$(date +"%Y-%m-%d")

log() { echo "[$(date +%H:%M:%S)] $*"; }
send_telegram() {
    [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ] && return 0
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d parse_mode="Markdown" \
        -d text="$1" > /dev/null 2>&1 || true
}

log "Architecture Agent starting scan..."

# ============================================================================
# PHASE 1: Collect Ground Truth
# ============================================================================

# --- 1a. PM2 Processes ---
PM2_JSON=$(pm2 jlist 2>/dev/null || echo "[]")
PM2_PROCESSES=$(echo "$PM2_JSON" | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    result = []
    for p in procs:
        result.append({
            'name': p.get('name', ''),
            'status': p.get('pm2_env', {}).get('status', 'unknown'),
            'restarts': p.get('pm2_env', {}).get('restart_time', 0),
            'cwd': p.get('pm2_env', {}).get('pm_cwd', ''),
            'cron': p.get('pm2_env', {}).get('cron_restart', ''),
            'uptime': p.get('pm2_env', {}).get('pm_uptime', 0),
            'pid': p.get('pid', 0)
        })
    print(json.dumps(result))
except:
    print('[]')
" 2>/dev/null || echo "[]")

# --- 1b. Docker Containers ---
DOCKER_CONTAINERS=$(docker ps --format '{"name":"{{.Names}}","status":"{{.Status}}","ports":"{{.Ports}}","image":"{{.Image}}"}' 2>/dev/null | python3 -c "
import sys, json
containers = []
for line in sys.stdin:
    line = line.strip()
    if line:
        try:
            containers.append(json.loads(line))
        except: pass
print(json.dumps(containers))
" 2>/dev/null || echo "[]")

# --- 1c. Ecosystem Config (declared processes) ---
ECOSYSTEM_APPS=$(node -e "
const cfg = require('$PROJECT_DIR/ecosystem.config.js');
const apps = cfg.apps.map(a => ({
    name: a.name,
    cwd: a.cwd || '',
    script: a.script || '',
    cron: a.cron_restart || '',
    autorestart: a.autorestart !== false
}));
console.log(JSON.stringify(apps));
" 2>/dev/null || echo "[]")

# --- 1d. Port Scan ---
LISTENING_PORTS=$(lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk 'NR>1 {print $1, $9}' | sort -u | python3 -c "
import sys, json, re
ports = {}
for line in sys.stdin:
    parts = line.strip().split()
    if len(parts) >= 2:
        proc = parts[0]
        match = re.search(r':(\d+)$', parts[1])
        if match:
            port = match.group(1)
            if port not in ports:
                ports[port] = proc
print(json.dumps(ports))
" 2>/dev/null || echo "{}")

# --- 1e. Agent Directories ---
AGENT_DIRS=$(python3 -c "
import os, json
project = '$PROJECT_DIR'
agents = []
# Known agent directory patterns
for subdir in ['julia', 'meta/agents', 'thesis/agents']:
    scan_dir = os.path.join(project, subdir)
    if not os.path.isdir(scan_dir):
        continue
    for d in os.listdir(scan_dir):
        full = os.path.join(scan_dir, d)
        if not os.path.isdir(full):
            continue
        # Has SOUL.md or IDENTITY.md = it's an agent
        has_soul = os.path.exists(os.path.join(full, 'SOUL.md'))
        has_identity = os.path.exists(os.path.join(full, 'IDENTITY.md'))
        has_heartbeat = os.path.exists(os.path.join(full, 'HEARTBEAT.md'))
        has_scripts = os.path.isdir(os.path.join(full, 'scripts'))
        if has_soul or has_identity:
            agents.append({
                'name': d,
                'has_soul': has_soul,
                'has_identity': has_identity,
                'has_heartbeat': has_heartbeat,
                'has_scripts': has_scripts,
                'path': os.path.join(subdir, d)
            })
print(json.dumps(agents))
" 2>/dev/null || echo "[]")

# --- 1f. OpenClaw Status ---
OPENCLAW_STATUS="unknown"
if pgrep -f "openclaw" > /dev/null 2>&1; then
    OPENCLAW_STATUS="running"
elif launchctl list 2>/dev/null | grep -q "openclaw"; then
    OPENCLAW_STATUS="registered"
else
    OPENCLAW_STATUS="stopped"
fi

# --- 1g. Skill Directories ---
SKILLS_DATA=$(python3 -c "
import os, json
skills = []
# Julia's orchestrator skills
skill_dirs = [
    ('$PROJECT_DIR/.agent/skills', 'orchestrator'),
    ('$PROJECT_DIR/.claude/skills', 'claude'),
]
for skill_dir, owner in skill_dirs:
    if os.path.isdir(skill_dir):
        for s in os.listdir(skill_dir):
            sp = os.path.join(skill_dir, s)
            if os.path.isdir(sp) and os.path.exists(os.path.join(sp, 'SKILL.md')):
                skills.append({'name': s, 'owner': owner, 'path': sp})
print(json.dumps(skills))
" 2>/dev/null || echo "[]")

# --- 1h. Shared Findings (active incidents) ---
ACTIVE_INCIDENTS=$(python3 -c "
import json
try:
    data = json.load(open('$SHARED_FINDINGS'))
    incidents = data.get('incidents', {})
    print(json.dumps(list(incidents.keys())))
except: print('[]')
" 2>/dev/null || echo "[]")

log "Ground truth collected. Generating topology..."

# ============================================================================
# PHASE 2: Generate Neural Map Graph Data
# ============================================================================

python3 << 'PYTHON_GRAPH_GEN'
import json, os, sys, time
from datetime import datetime

PROJECT_DIR = os.environ.get("PROJECT_DIR", "/Users/raphael/juliaz_agents")
FRONTEND_LIB = os.environ.get("FRONTEND_LIB", f"{PROJECT_DIR}/julia/frontend/src/lib")
MEMORY_DIR = os.environ.get("MEMORY_DIR", f"{PROJECT_DIR}/meta/agents/architecture-agent/memory")
SCAN_TIMESTAMP = os.environ.get("SCAN_TIMESTAMP", datetime.now().isoformat())

# Load collected data from env
pm2_processes = json.loads(os.environ.get("PM2_PROCESSES", "[]"))
docker_containers = json.loads(os.environ.get("DOCKER_CONTAINERS", "[]"))
ecosystem_apps = json.loads(os.environ.get("ECOSYSTEM_APPS", "[]"))
listening_ports = json.loads(os.environ.get("LISTENING_PORTS", "{}"))
agent_dirs = json.loads(os.environ.get("AGENT_DIRS", "[]"))
openclaw_status = os.environ.get("OPENCLAW_STATUS", "unknown")
skills_data = json.loads(os.environ.get("SKILLS_DATA", "[]"))
active_incidents = json.loads(os.environ.get("ACTIVE_INCIDENTS", "[]"))

# ── Node position layout engine ──────────────────────────────────────────
# Arranges nodes in a left-to-right flow with agents below and skills around

def build_graph():
    nodes = []
    edges = []
    node_ids = set()

    # ── Icon mapping (lucide-react icon names) ───────────────────────────
    ICON_MAP = {
        "user": "User",
        "openclaw": "MessageSquare",
        "bridge": "Link",
        "orchestrator": "Cpu",
        "backend": "Zap",
        "database": "Database",
        "cowork-mcp": "BrainCircuit",
        "frontend": "Monitor",
    }

    STATUS_MAP = {}
    for p in pm2_processes:
        STATUS_MAP[p["name"]] = p["status"]

    # ── Helper: determine if a component is healthy ──────────────────────
    def get_health(name):
        s = STATUS_MAP.get(name, "unknown")
        if s == "online":
            return "healthy"
        elif s in ("stopped", "errored", "waiting restart"):
            return "degraded"
        return "unknown"

    # ── Core system nodes (always present) ───────────────────────────────
    core_systems = [
        {
            "id": "user",
            "label": "User Interface",
            "title": "Human Input",
            "icon": "User",
            "category": "core",
            "position": {"x": 0, "y": 300},
            "health": "healthy",
            "port": None,
        },
        {
            "id": "openclaw",
            "label": "Messaging Gateway",
            "title": "OpenClaw",
            "icon": "MessageSquare",
            "category": "core",
            "position": {"x": 350, "y": 300},
            "health": "healthy" if openclaw_status == "running" else "degraded",
            "port": "18789",
        },
        {
            "id": "bridge",
            "label": "The Glue",
            "title": "MCP Bridge (Sync)",
            "icon": "Link",
            "category": "core",
            "position": {"x": 700, "y": 300},
            "health": get_health("bridge"),
            "port": "3001",
        },
        {
            "id": "orchestrator",
            "label": "Intelligence",
            "title": "Julia-Orchestrator",
            "icon": "Cpu",
            "category": "core",
            "position": {"x": 1050, "y": 300},
            "health": get_health("orchestrator"),
            "port": None,
        },
        {
            "id": "cowork-mcp",
            "label": "Second Brain",
            "title": "Cowork MCP (Claude)",
            "icon": "BrainCircuit",
            "category": "core",
            "position": {"x": 1050, "y": 80},
            "health": get_health("cowork-mcp"),
            "port": "3003",
        },
        {
            "id": "backend",
            "label": "Application Layer",
            "title": "REST API (Docker)",
            "icon": "Zap",
            "category": "core",
            "position": {"x": 1400, "y": 200},
            "health": get_health("backend-docker"),
            "port": "3000",
        },
        {
            "id": "database",
            "label": "Persistence",
            "title": "PostgreSQL / Memory",
            "icon": "Database",
            "category": "core",
            "position": {"x": 1400, "y": 420},
            "health": "healthy" if any("postgres" in c.get("image","").lower() for c in docker_containers) else "unknown",
            "port": "5432",
        },
        {
            "id": "frontend",
            "label": "Dashboard",
            "title": "Frontend (React)",
            "icon": "Monitor",
            "category": "core",
            "position": {"x": 0, "y": 80},
            "health": get_health("frontend"),
            "port": "3002",
        },
    ]

    for sys_node in core_systems:
        nodes.append(sys_node)
        node_ids.add(sys_node["id"])

    # ── Core flow edges ──────────────────────────────────────────────────
    core_edges = [
        {"id": "e-user-openclaw", "source": "user", "target": "openclaw", "type": "data_flow", "animated": True},
        {"id": "e-openclaw-bridge", "source": "openclaw", "target": "bridge", "type": "data_flow", "animated": True},
        {"id": "e-bridge-orchestrator", "source": "bridge", "target": "orchestrator", "type": "data_flow", "animated": True},
        {"id": "e-orchestrator-backend", "source": "orchestrator", "target": "backend", "type": "api_call", "animated": False, "label": "REST"},
        {"id": "e-orchestrator-database", "source": "orchestrator", "target": "database", "type": "api_call", "animated": False, "label": "Prisma"},
        {"id": "e-orchestrator-cowork", "source": "orchestrator", "target": "cowork-mcp", "type": "delegation", "animated": True, "label": "Claude"},
        {"id": "e-frontend-backend", "source": "frontend", "target": "backend", "type": "api_call", "animated": False, "label": "API"},
    ]
    edges.extend(core_edges)

    # ── Ambient agent nodes ──────────────────────────────────────────────
    # Detect these from actual agent directories + PM2 processes
    agent_name_map = {
        "health-checker": {"label": "Watchdog", "title": "Health Checker", "icon": "HeartPulse", "schedule": "15min"},
        "security-agent": {"label": "Security", "title": "Sentinel", "icon": "Shield", "schedule": "daily 07:00"},
        "docs-agent": {"label": "Documentation", "title": "Docs Agent", "icon": "FileText", "schedule": "12h"},
        "task-manager": {"label": "Projects", "title": "Task Manager", "icon": "ListTodo", "schedule": "6h"},
        "adhd-agent": {"label": "Hygiene", "title": "ADHD Agent", "icon": "Sparkles", "schedule": "4h"},
        "architecture-agent": {"label": "Architecture", "title": "Arch Agent", "icon": "Network", "schedule": "6h"},
    }

    # PM2 name to directory name mapping
    pm2_to_dir = {
        "sentinel": "security-agent",
        "health-checker": "health-checker",
        "docs-agent": "docs-agent",
        "task-manager": "task-manager",
        "architecture-agent": "architecture-agent",
    }

    # Build set of discovered agents from directories
    discovered_agents = set()
    for ad in agent_dirs:
        name = ad["name"]
        if name in agent_name_map:
            discovered_agents.add(name)

    # Also check PM2 for agents that might not have SOUL.md yet
    for p in pm2_processes:
        dir_name = pm2_to_dir.get(p["name"], p["name"])
        if dir_name in agent_name_map:
            discovered_agents.add(dir_name)

    # Position agents in a row below the main flow
    agent_x_start = 150
    agent_y = 550
    agent_spacing = 220

    for i, agent_name in enumerate(sorted(discovered_agents)):
        info = agent_name_map.get(agent_name, {
            "label": agent_name,
            "title": agent_name.replace("-", " ").title(),
            "icon": "Bot",
            "schedule": "unknown"
        })

        # Get PM2 status
        pm2_name = {v: k for k, v in pm2_to_dir.items()}.get(agent_name, agent_name)
        health = "healthy"  # ambient agents are healthy if they exist (cron-based)
        for p in pm2_processes:
            if p["name"] == pm2_name:
                if p["status"] == "errored":
                    health = "degraded"
                break

        node_id = f"agent-{agent_name}"
        nodes.append({
            "id": node_id,
            "label": info["label"],
            "title": info["title"],
            "icon": info["icon"],
            "category": "agent",
            "position": {"x": agent_x_start + (i * agent_spacing), "y": agent_y},
            "health": health,
            "schedule": info["schedule"],
        })
        node_ids.add(node_id)

        # Agents connect to shared-findings (conceptual hub)
        edges.append({
            "id": f"e-{node_id}-shared",
            "source": node_id,
            "target": "shared-findings",
            "type": "agent_comm",
            "animated": False,
        })

    # Add shared-findings as a hub node if we have agents
    if discovered_agents:
        nodes.append({
            "id": "shared-findings",
            "label": "Cross-Agent Bus",
            "title": "Shared Findings",
            "icon": "Radio",
            "category": "infrastructure",
            "position": {"x": 700, "y": 550},
            "health": "healthy",
        })
        node_ids.add("shared-findings")

    # ── Skill nodes ──────────────────────────────────────────────────────
    # Discover real skills from the filesystem
    oc_skills_x = 300
    orch_skills_x = 1000
    skill_y_top = 120
    skill_y_bottom = 480
    skill_spacing = 130

    oc_skill_count = 0
    orch_skill_count = 0

    for skill in skills_data:
        skill_id = f"skill-{skill['name']}"
        owner = skill["owner"]

        if owner == "orchestrator" or owner == "claude":
            # Position around orchestrator
            is_top = orch_skill_count % 2 == 0
            col = orch_skill_count // 2
            x = orch_skills_x + (col * skill_spacing)
            y = skill_y_top if is_top else skill_y_bottom

            nodes.append({
                "id": skill_id,
                "label": skill["name"],
                "title": skill["name"].replace("-", " ").title(),
                "icon": "Brain",
                "category": "skill",
                "position": {"x": x, "y": y},
                "owner": "orchestrator",
            })
            edges.append({
                "id": f"e-orch-{skill_id}",
                "source": "orchestrator",
                "target": skill_id,
                "type": "skill_injection",
                "animated": False,
            })
            orch_skill_count += 1

    # ── Metadata ─────────────────────────────────────────────────────────
    metadata = {
        "generated_at": SCAN_TIMESTAMP,
        "scan_source": "architecture-agent",
        "pm2_process_count": len(pm2_processes),
        "docker_container_count": len(docker_containers),
        "agent_count": len(discovered_agents),
        "skill_count": len(skills_data),
        "active_incidents": active_incidents,
        "listening_ports": listening_ports,
    }

    return {"nodes": nodes, "edges": edges, "metadata": metadata}


# ── Build and save the graph ─────────────────────────────────────────────
graph = build_graph()

# Save to frontend lib (consumed by ArchitectureDiagram.tsx)
graph_path = os.path.join(FRONTEND_LIB, "architectureGraph.json")
os.makedirs(FRONTEND_LIB, exist_ok=True)
with open(graph_path, "w") as f:
    json.dump(graph, f, indent=2)
print(f"[Architecture Agent] Graph written: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")

# Also update the tooltip descriptions file (backward compat)
desc_path = os.path.join(FRONTEND_LIB, "architectureData.json")
descriptions = {}
# Read existing descriptions if present
try:
    with open(desc_path) as f:
        existing = json.load(f)
        for k, v in existing.items():
            if isinstance(v, dict):
                descriptions[k] = v
            else:
                descriptions[k] = {"description": str(v)}
except:
    pass

# Update with live metadata
for node in graph["nodes"]:
    nid = node["id"]
    if nid not in descriptions and node["category"] == "core":
        descriptions[nid] = {"description": f"{node['title']} — {node['label']}"}

with open(desc_path, "w") as f:
    json.dump(descriptions, f, indent=2)

# ── Change detection ─────────────────────────────────────────────────────
prev_graph_path = os.path.join(MEMORY_DIR, "last_graph.json")
changes = []

try:
    with open(prev_graph_path) as f:
        prev_graph = json.load(f)

    prev_node_ids = {n["id"] for n in prev_graph.get("nodes", [])}
    curr_node_ids = {n["id"] for n in graph["nodes"]}

    added_nodes = curr_node_ids - prev_node_ids
    removed_nodes = prev_node_ids - curr_node_ids

    for nid in added_nodes:
        node = next((n for n in graph["nodes"] if n["id"] == nid), None)
        if node:
            changes.append(f"➕ NEW: {node['title']} ({node['category']})")

    for nid in removed_nodes:
        node = next((n for n in prev_graph["nodes"] if n["id"] == nid), None)
        if node:
            changes.append(f"➖ REMOVED: {node.get('title', nid)} ({node.get('category', '?')})")

    # Health changes
    prev_health = {n["id"]: n.get("health", "unknown") for n in prev_graph.get("nodes", [])}
    for node in graph["nodes"]:
        nid = node["id"]
        old_h = prev_health.get(nid)
        new_h = node.get("health", "unknown")
        if old_h and old_h != new_h:
            if new_h == "degraded":
                changes.append(f"🔴 DEGRADED: {node['title']}")
            elif old_h == "degraded" and new_h == "healthy":
                changes.append(f"🟢 RECOVERED: {node['title']}")

except FileNotFoundError:
    changes.append("📋 First scan — baseline established")
except Exception as e:
    changes.append(f"⚠️ Could not compare with previous scan: {e}")

# Save current as last
os.makedirs(MEMORY_DIR, exist_ok=True)
with open(prev_graph_path, "w") as f:
    json.dump(graph, f, indent=2)

# Save change log
changelog_path = os.path.join(MEMORY_DIR, "changelog.md")
if changes:
    with open(changelog_path, "a") as f:
        f.write(f"\n## {SCAN_TIMESTAMP}\n")
        for c in changes:
            f.write(f"- {c}\n")

# ── Write to shared-findings ─────────────────────────────────────────────
try:
    sf_path = os.environ.get("SHARED_FINDINGS", f"{PROJECT_DIR}/shared-findings/incidents.json")
    with open(sf_path) as f:
        sf = json.load(f)

    sf["_architecture"] = {
        "last_scan": SCAN_TIMESTAMP,
        "node_count": len(graph["nodes"]),
        "edge_count": len(graph["edges"]),
        "changes_detected": len(changes),
        "topology_hash": hash(frozenset(n["id"] for n in graph["nodes"]))
    }

    import tempfile
    tmp = tempfile.NamedTemporaryFile(mode="w", dir=os.path.dirname(sf_path), delete=False, suffix=".tmp")
    json.dump(sf, tmp, indent=2)
    tmp.close()
    os.replace(tmp.name, sf_path)
except Exception as e:
    print(f"[Architecture Agent] Warning: could not update shared-findings: {e}")

# ── Output for Telegram decision ─────────────────────────────────────────
print(f"[Architecture Agent] Changes detected: {len(changes)}")
for c in changes:
    print(f"  {c}")

# Write changes to env file for bash to pick up
changes_file = os.path.join(MEMORY_DIR, ".last_changes")
with open(changes_file, "w") as f:
    f.write("\n".join(changes))

PYTHON_GRAPH_GEN

# ============================================================================
# PHASE 3: Telegram Alert (only on significant changes)
# ============================================================================

CHANGES_FILE="$MEMORY_DIR/.last_changes"
if [ -f "$CHANGES_FILE" ]; then
    CHANGE_COUNT=$(wc -l < "$CHANGES_FILE" | tr -d ' ')
    CHANGES_TEXT=$(cat "$CHANGES_FILE")

    # Only alert on structural changes (new/removed nodes, health changes)
    # Skip "First scan" and minor changes
    if [ "$CHANGE_COUNT" -gt 0 ] && ! echo "$CHANGES_TEXT" | grep -q "First scan"; then
        ALERT_MSG="🏗️ *Architecture Agent*

Topology change detected:

$CHANGES_TEXT

_Scanned at $SCAN_TIMESTAMP_"

        send_telegram "$ALERT_MSG"
        log "Telegram alert sent ($CHANGE_COUNT changes)"
    else
        log "No structural changes — silent"
    fi
else
    log "No changes file found"
fi

# ============================================================================
# PHASE 4: Update Overview Documentation (if significantly stale)
# ============================================================================

# Check if overview doc mentions all discovered agents
if [ -f "$OVERVIEW_DOC" ]; then
    OVERVIEW_AGENT_COUNT=$(grep -c "^\| \*\*" "$OVERVIEW_DOC" 2>/dev/null || echo "0")
    ACTUAL_AGENT_COUNT=$(echo "$AGENT_DIRS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    OVERVIEW_LAST_UPDATE=$(grep -oP "Last updated: \K[0-9-]+" "$OVERVIEW_DOC" 2>/dev/null || echo "unknown")

    if [ "$OVERVIEW_LAST_UPDATE" != "$SCAN_DATE" ]; then
        # Calculate days since last update
        if [ "$OVERVIEW_LAST_UPDATE" != "unknown" ]; then
            DAYS_BEHIND=$(python3 -c "
from datetime import datetime
try:
    last = datetime.strptime('$OVERVIEW_LAST_UPDATE', '%Y-%m-%d')
    now = datetime.strptime('$SCAN_DATE', '%Y-%m-%d')
    print((now - last).days)
except:
    print(0)
" 2>/dev/null || echo "0")

            if [ "$DAYS_BEHIND" -gt 7 ]; then
                log "WARNING: agent_system_overview.md is $DAYS_BEHIND days behind"
                # Don't auto-edit — flag it for the Docs Agent or human
                echo "$SCAN_DATE: Overview doc is $DAYS_BEHIND days stale (last: $OVERVIEW_LAST_UPDATE)" >> "$MEMORY_DIR/staleness.log"
            fi
        fi
    fi
fi

log "Architecture scan complete. Graph: $FRONTEND_LIB/architectureGraph.json"
