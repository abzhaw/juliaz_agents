# Ambient Agent Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace noisy, stateless ambient agent alerts with intelligent, correlated incident digests via a shared Analyst layer.

**Architecture:** Bash collectors write structured JSON to `shared-findings/`. A new TypeScript Analyst service (PM2 cron, 15min) reads all findings, correlates them via Haiku → GPT-4o → rules fallback, manages incident lifecycle, and sends unified Telegram digests with adaptive cadence.

**Tech Stack:** Bash (collectors), Node.js + TypeScript + ES2022 + NodeNext modules (Analyst), Anthropic SDK + OpenAI SDK (LLM), Vitest (tests)

**Design Doc:** `docs/plans/2026-02-24-ambient-agent-redesign.md`

---

## Phase 1: Foundation

### Task 1: Create shared-findings directory and finding schema helper

**Files:**
- Create: `shared-findings/.gitkeep`
- Create: `shared-findings/README.md`
- Create: `analyst/src/types.ts`

**Step 1: Create the shared-findings directory**

```bash
mkdir -p /Users/raphael/juliaz_agents/shared-findings
```

**Step 2: Create README explaining the directory**

Create `shared-findings/README.md`:
```markdown
# shared-findings/

Structured JSON output from all ambient agents. Read by the Analyst service.

| File | Writer | Schedule |
|------|--------|----------|
| health-checker.json | Health Checker | Every 15min |
| sentinel.json | Sentinel | Daily 07:00 |
| adhd-agent.json | ADHD Agent | Every 4h |
| docs-agent.json | Docs Agent | Every 12h |
| task-manager.json | Task Manager | Every 6h |
| incidents.json | Analyst | Every 15min |
| cadence.json | Analyst | Every 15min |

**Do not edit these files manually.** They are managed by their respective agents.
```

**Step 3: Create TypeScript types for the finding protocol**

Create `analyst/src/types.ts`:
```typescript
// Shared Finding Protocol — all collectors produce this shape

export interface Finding {
  id: string;            // deterministic, e.g. "hc-backend-http-000"
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;      // e.g. "service-down", "security", "drift"
  title: string;
  detail: string;
  raw_data?: Record<string, unknown>;
  first_seen: string;    // ISO 8601
  related_to?: string[]; // other finding IDs from same agent
}

export interface CollectorOutput {
  agent: string;
  timestamp: string;     // ISO 8601
  findings: Finding[];
  healthy: string[];     // what's working (for recovery detection)
}

// Incident state managed by Analyst

export interface Incident {
  id: string;            // e.g. "INC-20260224-001"
  status: 'open' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  root_cause_hypothesis: string;
  contributing_findings: string[];
  first_seen: string;
  last_seen: string;
  duration_minutes: number;
  escalation_level: number;
  notifications_sent: NotificationRecord[];
}

export interface NotificationRecord {
  at: string;
  type: 'new_incident' | 'escalation' | 'recovery' | 'daily' | 'weekly';
  message?: string;
}

export interface ResolvedIncident {
  id: string;
  title: string;
  resolved_at: string;
  duration_minutes: number;
  auto_resolved: boolean;
}

export interface IncidentState {
  incidents: Record<string, Incident>;
  resolved: ResolvedIncident[];
}

export interface CadenceState {
  last_digest_sent: string;
  last_digest_hash: string;
  messages_this_hour: number;
  last_daily_digest: string;
  last_weekly_digest: string;
}

// LLM response shape

export interface IncidentUpdate {
  id: string;
  action: 'create' | 'update' | 'resolve';
  status: 'open' | 'resolved';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  root_cause: string;
  correlated_findings: string[];
  suggested_action: string;
}

export interface AnalystResponse {
  incidents_update: IncidentUpdate[];
  resolved_incidents: string[];  // incident IDs to resolve
  should_notify: boolean;
  notification_reason: string;
  digest: string;
}

// Suppressions config

export interface Suppressions {
  known_safe_ports: Record<string, string>;
  known_safe_processes: string[];
  suppressed_findings: Record<string, { reason: string; suppressed_by: string; date: string }>;
  language_tags: string[];
}
```

**Step 4: Add .gitkeep**

```bash
touch /Users/raphael/juliaz_agents/shared-findings/.gitkeep
```

**Step 5: Commit**

```bash
git add shared-findings/ analyst/src/types.ts
git commit -m "feat: add shared-findings protocol and TypeScript types for Analyst"
```

---

### Task 2: Scaffold the Analyst service

**Files:**
- Create: `analyst/package.json`
- Create: `analyst/tsconfig.json`
- Create: `analyst/config/suppressions.json`

**Step 1: Create package.json**

Create `analyst/package.json`:
```json
{
  "name": "julia-analyst",
  "version": "1.0.0",
  "description": "Analyst — correlates ambient agent findings into intelligent incident digests",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "openai": "^6.22.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `analyst/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create suppressions config**

Create `analyst/config/suppressions.json`:
```json
{
  "known_safe_ports": {
    "5000": "macOS AirPlay Receiver",
    "7000": "macOS AirDrop",
    "49152-49999": "Ephemeral ports (Electron, VS Code, language servers)"
  },
  "known_safe_processes": [
    "Electron",
    "Code Helper",
    "com.apple",
    "rapportd",
    "ControlCe",
    "AMPLibraryAgent",
    "Google Chrome He"
  ],
  "suppressed_findings": {},
  "language_tags": ["nodejs", "node", "python", "typescript", "go", "rust", "java", "swift"]
}
```

**Step 4: Install dependencies**

```bash
cd /Users/raphael/juliaz_agents/analyst && npm install
```

**Step 5: Verify TypeScript compiles the types**

```bash
cd /Users/raphael/juliaz_agents/analyst && npx tsc --noEmit
```

Expected: no errors.

**Step 6: Commit**

```bash
git add analyst/
git commit -m "feat: scaffold Analyst service with package.json, tsconfig, suppressions"
```

---

## Phase 2: Collector Fixes

### Task 3: Health Checker — structured output + state tracking + PM2 states

This is the highest-impact change. Kills the 16-identical-alerts problem.

**Files:**
- Modify: `health-checker/scripts/health_check.sh`
- Create: `health-checker/scripts/write_findings.py` (helper for JSON output)

**Step 1: Create the Python JSON writer helper**

Create `health-checker/scripts/write_findings.py`:
```python
#!/usr/bin/env python3
"""
Reads findings from stdin (one JSON object per line), manages local incident state,
and writes structured output to shared-findings/health-checker.json.
"""
import json
import sys
import os
from datetime import datetime, timezone

PROJECT_DIR = "/Users/raphael/juliaz_agents"
SHARED_DIR = os.path.join(PROJECT_DIR, "shared-findings")
LOCAL_STATE = os.path.join(PROJECT_DIR, "health-checker/memory/finding_state.json")
OUTPUT_FILE = os.path.join(SHARED_DIR, "health-checker.json")

def load_state():
    try:
        with open(LOCAL_STATE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_state(state):
    os.makedirs(os.path.dirname(LOCAL_STATE), exist_ok=True)
    with open(LOCAL_STATE, "w") as f:
        json.dump(state, f, indent=2)

def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    state = load_state()

    findings = []
    healthy = []

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue

        if item.get("status") == "healthy":
            healthy.append(item.get("label", "unknown"))
            # Remove from state if previously tracked
            fid = item.get("id", "")
            if fid in state:
                del state[fid]
            continue

        fid = item["id"]
        if fid in state:
            state[fid]["last_seen"] = now
            state[fid]["count"] = state[fid].get("count", 1) + 1
        else:
            state[fid] = {"first_seen": now, "last_seen": now, "count": 1}

        findings.append({
            "id": fid,
            "severity": item.get("severity", "medium"),
            "category": item.get("category", "unknown"),
            "title": item.get("title", ""),
            "detail": item.get("detail", ""),
            "raw_data": item.get("raw_data", {}),
            "first_seen": state[fid]["first_seen"],
            "related_to": item.get("related_to", []),
        })

    output = {
        "agent": "health-checker",
        "timestamp": now,
        "findings": findings,
        "healthy": healthy,
    }

    os.makedirs(SHARED_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    save_state(state)

    # Print summary for PM2 log
    print(f"[health-checker] {len(findings)} findings, {len(healthy)} healthy → {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
```

**Step 2: Rewrite health_check.sh to output structured JSON**

Modify `health-checker/scripts/health_check.sh`. Key changes:
- Replace `ISSUES=""` / `add_issue()` / `send_telegram()` with JSON output piped to `write_findings.py`
- Add retry logic for HTTP checks (try twice, 3s gap)
- Handle all PM2 states including `waiting restart`, `launching`
- Remove direct Telegram sending (Analyst handles that now)
- Keep the auto-restart logic for stopped PM2 processes (that's useful)
- Keep daily log file for audit trail

The full rewrite is in the design doc (Section 2.1). The key structural change:

```bash
# Instead of: add_issue "DOWN: Backend API..."
# Now emit: JSON line to stdout, piped to write_findings.py at the end

emit_finding() {
    local id="$1" severity="$2" category="$3" title="$4" detail="$5"
    local related="${6:-}"
    local raw_data="${7:-{}}"
    echo "{\"id\":\"$id\",\"severity\":\"$severity\",\"category\":\"$category\",\"title\":\"$title\",\"detail\":\"$detail\",\"related_to\":[$related],\"raw_data\":$raw_data}"
}

emit_healthy() {
    local id="$1" label="$2"
    echo "{\"status\":\"healthy\",\"id\":\"$id\",\"label\":\"$label\"}"
}
```

At the end of the script:
```bash
# Pipe all emitted lines through the JSON writer
echo "$ALL_EMISSIONS" | python3 "$SCRIPT_DIR/write_findings.py"
```

**Step 3: Test the health checker produces valid JSON**

```bash
cd /Users/raphael/juliaz_agents && bash health-checker/scripts/health_check.sh
cat shared-findings/health-checker.json | python3 -m json.tool
```

Expected: valid JSON with `agent`, `timestamp`, `findings` array, `healthy` array.

**Step 4: Verify state tracking works across runs**

```bash
# Run twice
bash health-checker/scripts/health_check.sh
sleep 2
bash health-checker/scripts/health_check.sh
# Check that count incremented for persistent findings
cat health-checker/memory/finding_state.json | python3 -m json.tool
```

Expected: findings that appeared in both runs should have `count: 2`.

**Step 5: Commit**

```bash
git add health-checker/scripts/ shared-findings/health-checker.json health-checker/memory/
git commit -m "feat(health-checker): structured JSON output, state tracking, full PM2 states"
```

---

### Task 4: ADHD Agent — programming stop words + language awareness

**Files:**
- Modify: `adhd-agent/scripts/scan_skills.py`

**Step 1: Replace stop words and add language-aware comparison**

In `adhd-agent/scripts/scan_skills.py`, replace the `desc_similarity` function (lines 202-225):

Replace the massive 400+ web-crawler stop word set with:
```python
PROGRAMMING_STOP_WORDS = {
    # Generic programming terms that appear in ALL skill descriptions
    "code", "function", "method", "class", "module", "package",
    "error", "handling", "exception", "throw", "catch", "try",
    "best", "practice", "pattern", "example", "usage", "common",
    "create", "build", "implement", "configure", "setup", "install",
    "test", "testing", "debug", "debugging", "log", "logging",
    "return", "value", "variable", "parameter", "argument",
    "data", "type", "string", "number", "boolean", "array", "object",
    "ensure", "avoid", "prefer", "should", "always", "never", "must",
    "file", "directory", "path", "import", "export", "require",
    "server", "client", "request", "response", "api", "endpoint",
    "async", "await", "promise", "callback", "event",
    "read", "write", "update", "delete", "get", "set", "list",
    "config", "option", "setting", "env", "environment",
    "run", "start", "stop", "restart", "deploy",
    "skill", "agent", "tool", "script",
}
```

Add language tag extraction and threshold adjustment:
```python
LANGUAGE_TAGS = {
    "nodejs", "node", "javascript", "js", "typescript", "ts",
    "python", "py", "go", "golang", "rust", "java", "swift",
    "ruby", "php", "csharp", "dotnet", "kotlin", "scala",
}

def extract_language_tags(name: str, desc: str) -> set[str]:
    tokens = set(re.findall(r'\b[a-z]+\b', (name + " " + desc).lower()))
    return tokens.intersection(LANGUAGE_TAGS)

def find_merge_candidates(all_skills, threshold=0.50):
    # ... existing loop ...
    for i, a in enumerate(skills):
        for b in skills[i+1:]:
            # Language-aware threshold
            langs_a = extract_language_tags(a.name, a.description)
            langs_b = extract_language_tags(b.name, b.description)
            if langs_a and langs_b and langs_a != langs_b:
                effective_threshold = 0.85  # much higher for cross-language
            else:
                effective_threshold = threshold

            sim = desc_similarity(a.description, b.description)
            if effective_threshold <= sim < 0.75:
                # ... create finding ...
```

**Step 2: Add JSON output to shared-findings**

Add at the end of `main()`:
```python
# Write to shared-findings for Analyst
shared_output = {
    "agent": "adhd-agent",
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "findings": [
        {
            "id": f.fingerprint,
            "severity": f.severity,
            "category": f.kind,
            "title": f.title,
            "detail": f.description,
            "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "related_to": [],
        }
        for f in findings
    ],
    "healthy": [],
}
shared_path = Path("/Users/raphael/juliaz_agents/shared-findings/adhd-agent.json")
shared_path.parent.mkdir(parents=True, exist_ok=True)
shared_path.write_text(json.dumps(shared_output, indent=2))
```

**Step 3: Test that nodejs + python no longer triggers**

```bash
cd /Users/raphael/juliaz_agents && python3 adhd-agent/scripts/scan_skills.py --json | python3 -c "
import json, sys
data = json.load(sys.stdin)
merges = [f for f in data['findings'] if f['kind'] == 'merge_candidate']
cross_lang = [m for m in merges if 'nodejs' in m['title'].lower() and 'python' in m['title'].lower()]
print(f'Total merge candidates: {len(merges)}')
print(f'Cross-language false positives: {len(cross_lang)}')
assert len(cross_lang) == 0, 'nodejs+python should NOT be flagged as merge candidate'
print('✅ Language-aware filtering works')
"
```

Expected: `Cross-language false positives: 0`

**Step 4: Commit**

```bash
git add adhd-agent/scripts/scan_skills.py
git commit -m "feat(adhd): programming stop words, language-aware merge thresholds, shared-findings output"
```

---

### Task 5: Sentinel — time-windowed logs + port filtering + shared output

**Files:**
- Modify: `security-agent/scripts/daily-report.sh`

**Step 1: Fix log analysis to use 24h window**

Replace the log analysis section (lines 247-265) in `daily-report.sh`:

```bash
# SKILL 6: LOG ANALYSIS — last 24h only
YESTERDAY=$(date -v-1d +"%Y-%m-%d" 2>/dev/null || date -d "yesterday" +"%Y-%m-%d" 2>/dev/null || echo "")

for service in orchestrator bridge frontend cowork-mcp; do
    LOG_FILE=$(ls "$HOME/.pm2/logs/${service}-out.log" 2>/dev/null || true)
    if [ -f "$LOG_FILE" ]; then
        if [ -n "$YESTERDAY" ]; then
            ERRORS=$(grep -c "ERROR\|FATAL" <(grep "$TODAY\|$YESTERDAY" "$LOG_FILE" 2>/dev/null) 2>/dev/null || echo 0)
        else
            # Fallback: count errors in last 1000 lines
            ERRORS=$(tail -1000 "$LOG_FILE" | grep -c "ERROR\|FATAL" 2>/dev/null || echo 0)
        fi
        # ... rest of severity logic ...
    fi
done
```

**Step 2: Add system process allowlist for port filtering**

In the unknown ports section (lines 82-98), add process filtering:

```bash
KNOWN_SYSTEM_PROCS="Electron|Code.Helper|com\.apple|rapportd|ControlCe|AMPLibrary|Google.Chrome.He|CoreAudio|WindowServer"

# Filter unknown ports: downgrade to info if owned by known system process
if [ -n "$UNKNOWN_PORTS" ]; then
    while IFS= read -r port; do
        PROCESS=$(echo "$PORT_OUTPUT" | grep ":$port " | awk '{print $1}' | head -1)
        if echo "$PROCESS" | grep -qE "$KNOWN_SYSTEM_PROCS"; then
            echo "- 🔵 Port $port — system process: $PROCESS (safe)" >> "$REPORT_FILE"
            # info severity, not high
        else
            echo "- 🟠 Port $port — UNKNOWN listener: $PROCESS" >> "$REPORT_FILE"
            add_finding "🟠" "port-scan" "Unknown port $port open: $PROCESS"
        fi
    done <<< "$UNKNOWN_PORTS"
fi
```

**Step 3: Add shared-findings JSON output**

Add at end of script, before the Telegram section:

```bash
# ── Write shared-findings output ─────────────────────────────────────────────
python3 - <<PYEOF
import json, os
from datetime import datetime, timezone

findings_list = []
for line in """$(echo -e "$FINDINGS")""".strip().split("\n"):
    line = line.strip()
    if not line:
        continue
    # Parse: "🔴 [section] message" or "🟠 [section] message"
    parts = line.split(" ", 2)
    if len(parts) < 3:
        continue
    emoji, section_raw, message = parts[0], parts[1], parts[2]
    section = section_raw.strip("[]")
    severity_map = {"🔴": "critical", "🟠": "high", "🟡": "medium", "🟢": "low"}
    severity = severity_map.get(emoji, "info")
    fid = f"sentinel-{section}-{abs(hash(message)) % 10000}"
    findings_list.append({
        "id": fid,
        "severity": severity,
        "category": section,
        "title": message[:100],
        "detail": message,
        "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "related_to": [],
    })

output = {
    "agent": "sentinel",
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "findings": findings_list,
    "healthy": [],
}

shared_path = "/Users/raphael/juliaz_agents/shared-findings/sentinel.json"
os.makedirs(os.path.dirname(shared_path), exist_ok=True)
with open(shared_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"[sentinel] {len(findings_list)} findings → {shared_path}")
PYEOF
```

**Step 4: Test and commit**

```bash
cat shared-findings/sentinel.json | python3 -m json.tool
git add security-agent/scripts/daily-report.sh
git commit -m "feat(sentinel): 24h log window, system process port filtering, shared-findings output"
```

---

### Task 6: Docs Agent + Task Manager — shared-findings output

**Files:**
- Modify: `docs-agent/scripts/docs_drift_check.sh`
- Modify: `task-manager/scripts/task_check.sh`

**Step 1: Add shared-findings output to Docs Agent**

Add before the Telegram section in `docs_drift_check.sh` (before line 140):

```bash
# ── Write shared-findings output ─────────────────────────────────────────────
python3 - <<PYEOF
import json, os
from datetime import datetime, timezone

drifts_raw = """$(echo -e "$DRIFTS")""".strip()
findings = []
for line in drifts_raw.split("\n"):
    line = line.strip().lstrip("- ")
    if not line:
        continue
    fid = f"docs-{abs(hash(line)) % 10000}"
    findings.append({
        "id": fid,
        "severity": "low",
        "category": "documentation-drift",
        "title": line[:100],
        "detail": line,
        "first_seen": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "related_to": [],
    })

output = {
    "agent": "docs-agent",
    "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "findings": findings,
    "healthy": [],
}

shared_path = "/Users/raphael/juliaz_agents/shared-findings/docs-agent.json"
os.makedirs(os.path.dirname(shared_path), exist_ok=True)
with open(shared_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"[docs-agent] {len(findings)} findings → {shared_path}")
PYEOF
```

**Step 2: Add shared-findings output to Task Manager**

Same pattern as Docs Agent — add Python JSON writer at end of `task_check.sh`.

**Step 3: Commit**

```bash
git add docs-agent/scripts/ task-manager/scripts/
git commit -m "feat(docs,tasks): add shared-findings JSON output for Analyst"
```

---

## Phase 3: Analyst Service

### Task 7: Incident state management

**Files:**
- Create: `analyst/src/incidents.ts`
- Create: `analyst/src/__tests__/incidents.test.ts`

**Step 1: Write the failing test**

Create `analyst/src/__tests__/incidents.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentManager } from '../incidents.js';
import type { CollectorOutput, IncidentState } from '../types.js';

describe('IncidentManager', () => {
  let manager: IncidentManager;

  beforeEach(() => {
    manager = new IncidentManager();
  });

  it('creates a new incident from a new finding', () => {
    const findings: CollectorOutput[] = [{
      agent: 'health-checker',
      timestamp: '2026-02-24T11:30:00Z',
      findings: [{
        id: 'hc-backend-http-000',
        severity: 'critical',
        category: 'service-down',
        title: 'Backend API unreachable',
        detail: 'HTTP 000',
        first_seen: '2026-02-24T11:30:00Z',
      }],
      healthy: [],
    }];

    const result = manager.processFindings(findings, { incidents: {}, resolved: [] });
    const incidents = Object.values(result.incidents);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].status).toBe('open');
    expect(incidents[0].contributing_findings).toContain('hc-backend-http-000');
  });

  it('updates duration for persistent findings', () => {
    const state: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001',
          status: 'open',
          severity: 'critical',
          title: 'Backend down',
          root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: '2026-02-24T11:30:00Z',
          last_seen: '2026-02-24T11:45:00Z',
          duration_minutes: 15,
          escalation_level: 1,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    const findings: CollectorOutput[] = [{
      agent: 'health-checker',
      timestamp: '2026-02-24T12:30:00Z',
      findings: [{
        id: 'hc-backend-http-000',
        severity: 'critical',
        category: 'service-down',
        title: 'Backend API unreachable',
        detail: 'HTTP 000',
        first_seen: '2026-02-24T11:30:00Z',
      }],
      healthy: [],
    }];

    const result = manager.processFindings(findings, state);
    expect(result.incidents['INC-001'].duration_minutes).toBe(60);
  });

  it('resolves incidents when findings disappear', () => {
    const state: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001',
          status: 'open',
          severity: 'critical',
          title: 'Backend down',
          root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: '2026-02-24T11:30:00Z',
          last_seen: '2026-02-24T14:45:00Z',
          duration_minutes: 195,
          escalation_level: 3,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    // No findings — backend recovered, appears in healthy list
    const findings: CollectorOutput[] = [{
      agent: 'health-checker',
      timestamp: '2026-02-24T15:15:00Z',
      findings: [],
      healthy: ['Backend API (3000): HTTP 200'],
    }];

    const result = manager.processFindings(findings, state);
    expect(Object.keys(result.incidents)).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].id).toBe('INC-001');
    expect(result.resolved[0].auto_resolved).toBe(true);
  });

  it('computes escalation level based on duration', () => {
    expect(manager.getEscalationLevel(10)).toBe(1);   // <15min
    expect(manager.getEscalationLevel(30)).toBe(2);   // 15min-1h
    expect(manager.getEscalationLevel(120)).toBe(3);  // 1h-4h
    expect(manager.getEscalationLevel(300)).toBe(4);  // 4h+
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/raphael/juliaz_agents/analyst && npx vitest run src/__tests__/incidents.test.ts
```

Expected: FAIL — `incidents.js` does not exist.

**Step 3: Write the implementation**

Create `analyst/src/incidents.ts`:
```typescript
import type {
  CollectorOutput,
  Finding,
  IncidentState,
  Incident,
  ResolvedIncident,
} from './types.js';

export class IncidentManager {
  private counter = 0;

  generateId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.counter++;
    return `INC-${date}-${String(this.counter).padStart(3, '0')}`;
  }

  getEscalationLevel(durationMinutes: number): number {
    if (durationMinutes < 15) return 1;
    if (durationMinutes < 60) return 2;
    if (durationMinutes < 240) return 3;
    return 4;
  }

  processFindings(
    collectorOutputs: CollectorOutput[],
    currentState: IncidentState
  ): IncidentState {
    const now = new Date().toISOString();

    // Collect all current finding IDs
    const allFindings = new Map<string, Finding>();
    for (const output of collectorOutputs) {
      for (const f of output.findings) {
        allFindings.set(f.id, f);
      }
    }

    const allFindingIds = new Set(allFindings.keys());
    const newIncidents: Record<string, Incident> = {};
    const newResolved: ResolvedIncident[] = [...currentState.resolved];

    // Update existing incidents
    for (const [incId, incident] of Object.entries(currentState.incidents)) {
      const stillActive = incident.contributing_findings.filter(fId => allFindingIds.has(fId));

      if (stillActive.length === 0) {
        // All contributing findings have disappeared → resolve
        newResolved.push({
          id: incId,
          title: incident.title,
          resolved_at: now,
          duration_minutes: incident.duration_minutes,
          auto_resolved: true,
        });
      } else {
        // Update duration
        const firstSeen = new Date(incident.first_seen);
        const lastSeen = new Date(now);
        const durationMs = lastSeen.getTime() - firstSeen.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        newIncidents[incId] = {
          ...incident,
          last_seen: now,
          duration_minutes: durationMinutes,
          contributing_findings: stillActive,
          escalation_level: this.getEscalationLevel(durationMinutes),
        };

        // Remove these findings from the "unmatched" set
        for (const fId of stillActive) {
          allFindingIds.delete(fId);
        }
      }
    }

    // Create new incidents for unmatched findings
    // Group by severity — critical/high findings become individual incidents
    const unmatchedFindings = [...allFindingIds].map(id => allFindings.get(id)!);
    const criticalFindings = unmatchedFindings.filter(f =>
      f.severity === 'critical' || f.severity === 'high'
    );
    const otherFindings = unmatchedFindings.filter(f =>
      f.severity !== 'critical' && f.severity !== 'high'
    );

    for (const finding of criticalFindings) {
      // Check if any related findings should be grouped
      const related = [finding.id];
      if (finding.related_to) {
        for (const relId of finding.related_to) {
          if (allFindingIds.has(relId)) {
            related.push(relId);
            allFindingIds.delete(relId);
          }
        }
      }

      const incId = this.generateId();
      newIncidents[incId] = {
        id: incId,
        status: 'open',
        severity: finding.severity as Incident['severity'],
        title: finding.title,
        root_cause_hypothesis: '',
        contributing_findings: related,
        first_seen: finding.first_seen || now,
        last_seen: now,
        duration_minutes: 0,
        escalation_level: 1,
        notifications_sent: [],
      };
    }

    // Group remaining low-severity findings into a single housekeeping incident if any
    if (otherFindings.length > 0) {
      const incId = this.generateId();
      newIncidents[incId] = {
        id: incId,
        status: 'open',
        severity: 'low',
        title: `${otherFindings.length} housekeeping findings`,
        root_cause_hypothesis: '',
        contributing_findings: otherFindings.map(f => f.id),
        first_seen: now,
        last_seen: now,
        duration_minutes: 0,
        escalation_level: 1,
        notifications_sent: [],
      };
    }

    // Keep only last 50 resolved incidents
    const trimmedResolved = newResolved.slice(-50);

    return {
      incidents: newIncidents,
      resolved: trimmedResolved,
    };
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/raphael/juliaz_agents/analyst && npx vitest run src/__tests__/incidents.test.ts
```

Expected: 4 tests PASS.

**Step 5: Commit**

```bash
git add analyst/src/incidents.ts analyst/src/__tests__/incidents.test.ts
git commit -m "feat(analyst): incident state management with create/update/resolve lifecycle"
```

---

### Task 8: Rules-based fallback engine

**Files:**
- Create: `analyst/src/rules-fallback.ts`
- Create: `analyst/src/__tests__/rules-fallback.test.ts`

**Step 1: Write the failing test**

Create `analyst/src/__tests__/rules-fallback.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { RulesFallback } from '../rules-fallback.js';
import type { CollectorOutput, IncidentState, CadenceState } from '../types.js';

describe('RulesFallback', () => {
  const fallback = new RulesFallback();

  it('recommends immediate notification for new critical incident', () => {
    const incidents: IncidentState = {
      incidents: {
        'INC-001': {
          id: 'INC-001', status: 'open', severity: 'critical',
          title: 'Backend down', root_cause_hypothesis: '',
          contributing_findings: ['hc-backend-http-000'],
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          duration_minutes: 0, escalation_level: 1,
          notifications_sent: [],
        }
      },
      resolved: [],
    };

    const cadence: CadenceState = {
      last_digest_sent: '', last_digest_hash: '',
      messages_this_hour: 0,
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(true);
    expect(result.notification_reason).toContain('new');
  });

  it('suppresses notification when circuit breaker is hit', () => {
    const incidents: IncidentState = { incidents: {}, resolved: [] };
    const cadence: CadenceState = {
      last_digest_sent: new Date().toISOString(),
      last_digest_hash: 'abc',
      messages_this_hour: 6, // circuit breaker
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(false);
    expect(result.notification_reason).toContain('circuit breaker');
  });

  it('notifies on recovery', () => {
    const incidents: IncidentState = {
      incidents: {},
      resolved: [{
        id: 'INC-001', title: 'Backend down',
        resolved_at: new Date().toISOString(),
        duration_minutes: 195, auto_resolved: true,
      }],
    };

    const cadence: CadenceState = {
      last_digest_sent: '', last_digest_hash: '',
      messages_this_hour: 0,
      last_daily_digest: '', last_weekly_digest: '',
    };

    const result = fallback.analyze(incidents, cadence);
    expect(result.should_notify).toBe(true);
    expect(result.digest).toContain('Resolved');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/raphael/juliaz_agents/analyst && npx vitest run src/__tests__/rules-fallback.test.ts
```

**Step 3: Write the implementation**

Create `analyst/src/rules-fallback.ts` — handles cadence, escalation thresholds, circuit breaker, and generates basic digest text without LLM.

**Step 4: Run tests, commit**

```bash
cd /Users/raphael/juliaz_agents/analyst && npx vitest run
git add analyst/src/rules-fallback.ts analyst/src/__tests__/rules-fallback.test.ts
git commit -m "feat(analyst): rules-based fallback for cadence, escalation, digest generation"
```

---

### Task 9: LLM integration (Haiku → GPT-4o → fallback)

**Files:**
- Create: `analyst/src/llm.ts`
- Create: `analyst/src/prompt.ts`

**Step 1: Create the system prompt with dependency graph**

Create `analyst/src/prompt.ts`:
```typescript
import type { Suppressions } from './types.js';

export function buildSystemPrompt(suppressions: Suppressions): string {
  return `You are the Analyst for Julia's multi-agent system. You correlate findings from 5 ambient agents into coherent incident reports.

## System Dependency Graph
PostgreSQL (Docker) → Backend API (port 3000) → Bridge (port 3001) → Orchestrator → OpenClaw
Frontend (port 3002) — independent
Cowork-MCP (port 3003) — independent

If a upstream service is down (e.g., PostgreSQL), all downstream services will fail. This is ONE incident, not multiple.

## Known Safe (suppress these)
Ports: ${JSON.stringify(suppressions.known_safe_ports)}
Processes: ${suppressions.known_safe_processes.join(', ')}
Suppressed findings: ${JSON.stringify(suppressions.suppressed_findings)}

## Language Tags (for ADHD merge candidates)
Skills targeting different languages (${suppressions.language_tags.join(', ')}) should NOT be merged.

## Your Job
1. Correlate findings across agents — group related symptoms into single incidents
2. Identify root causes using the dependency graph
3. Filter noise (known safe ports/processes, info-severity items)
4. Decide whether to notify based on escalation rules:
   - New incident: immediate
   - Ongoing, new info: hourly
   - Ongoing, no change: every 4h
   - Resolved: immediate (recovery notification)
   - All healthy: daily at 08:00
5. Write a concise Telegram digest (max 500 chars for incidents, longer for daily/weekly)

Respond with a JSON object matching the AnalystResponse schema.`;
}
```

**Step 2: Create the LLM client with fallback chain**

Create `analyst/src/llm.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AnalystResponse, CollectorOutput, IncidentState, CadenceState, Suppressions } from './types.js';
import { buildSystemPrompt } from './prompt.js';
import { RulesFallback } from './rules-fallback.js';

export class AnalystLLM {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private fallback = new RulesFallback();

  constructor() {
    try {
      this.anthropic = new Anthropic();
    } catch { /* API key missing — will use fallback */ }
    try {
      this.openai = new OpenAI();
    } catch { /* API key missing — will use fallback */ }
  }

  async analyze(
    collectorOutputs: CollectorOutput[],
    incidents: IncidentState,
    cadence: CadenceState,
    suppressions: Suppressions,
  ): Promise<AnalystResponse> {
    const systemPrompt = buildSystemPrompt(suppressions);
    const userMessage = JSON.stringify({
      collector_findings: collectorOutputs,
      open_incidents: incidents,
      last_digest_sent: cadence.last_digest_sent,
      current_time: new Date().toISOString(),
    });

    // Try Haiku first
    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-haiku-4-20250414',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        return this.parseResponse(text);
      } catch (e) {
        console.log('[analyst] Haiku failed, trying GPT-4o:', (e as Error).message);
      }
    }

    // Fallback to GPT-4o
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
        });
        const text = response.choices[0]?.message?.content || '';
        return this.parseResponse(text);
      } catch (e) {
        console.log('[analyst] GPT-4o failed, using rules fallback:', (e as Error).message);
      }
    }

    // Final fallback: rules-based
    console.log('[analyst] Using rules-based fallback (no LLM available)');
    return this.fallback.analyze(incidents, cadence);
  }

  private parseResponse(text: string): AnalystResponse {
    try {
      // Extract JSON from potential markdown code fences
      const jsonMatch = text.match(/```json\n?([\s\S]*?)```/) || [null, text];
      return JSON.parse(jsonMatch[1] || text);
    } catch {
      console.log('[analyst] Failed to parse LLM response, using fallback');
      return this.fallback.analyze({ incidents: {}, resolved: [] }, {
        last_digest_sent: '', last_digest_hash: '',
        messages_this_hour: 0, last_daily_digest: '', last_weekly_digest: '',
      });
    }
  }
}
```

**Step 3: Commit**

```bash
git add analyst/src/llm.ts analyst/src/prompt.ts
git commit -m "feat(analyst): LLM integration with Haiku → GPT-4o → rules fallback chain"
```

---

### Task 10: Telegram sender + cadence enforcement

**Files:**
- Create: `analyst/src/telegram.ts`

**Step 1: Create Telegram digest sender**

Create `analyst/src/telegram.ts`:
```typescript
import { createHash } from 'crypto';
import type { CadenceState } from './types.js';

export class TelegramSender {
  private token: string;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.token = token;
    this.chatId = chatId;
  }

  async send(digest: string, cadence: CadenceState): Promise<boolean> {
    // Circuit breaker: max 6 messages per hour
    if (cadence.messages_this_hour >= 6) {
      console.log('[analyst] Circuit breaker: 6 messages this hour, skipping');
      return false;
    }

    // Dedup: don't send exact same digest twice
    const hash = createHash('md5').update(digest).digest('hex').slice(0, 8);
    if (hash === cadence.last_digest_hash) {
      console.log('[analyst] Dedup: identical digest, skipping');
      return false;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: digest,
            parse_mode: 'Markdown',
          }),
        }
      );

      const data = await response.json() as { ok: boolean };
      if (data.ok) {
        console.log('[analyst] Digest sent to Telegram');
        return true;
      } else {
        console.log('[analyst] Telegram API error:', JSON.stringify(data));
        return false;
      }
    } catch (e) {
      console.log('[analyst] Telegram send failed:', (e as Error).message);
      return false;
    }
  }
}
```

**Step 2: Commit**

```bash
git add analyst/src/telegram.ts
git commit -m "feat(analyst): Telegram sender with circuit breaker and dedup"
```

---

### Task 11: Main entry point — tie everything together

**Files:**
- Create: `analyst/src/index.ts`

**Step 1: Create the main orchestration loop**

Create `analyst/src/index.ts`:
```typescript
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { IncidentManager } from './incidents.js';
import { AnalystLLM } from './llm.js';
import { TelegramSender } from './telegram.js';
import type { CollectorOutput, IncidentState, CadenceState, Suppressions } from './types.js';

// Load environment
const PROJECT_DIR = '/Users/raphael/juliaz_agents';
dotenv.config({ path: join(PROJECT_DIR, '.env.secrets') });

const SHARED_DIR = join(PROJECT_DIR, 'shared-findings');
const CONFIG_DIR = join(PROJECT_DIR, 'analyst', 'config');
const INCIDENTS_FILE = join(SHARED_DIR, 'incidents.json');
const CADENCE_FILE = join(SHARED_DIR, 'cadence.json');

function readJSON<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(path: string, data: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function loadCollectorFindings(): CollectorOutput[] {
  const outputs: CollectorOutput[] = [];
  if (!existsSync(SHARED_DIR)) return outputs;

  for (const file of readdirSync(SHARED_DIR)) {
    if (!file.endsWith('.json')) continue;
    if (file === 'incidents.json' || file === 'cadence.json') continue;

    try {
      const data = JSON.parse(readFileSync(join(SHARED_DIR, file), 'utf-8'));
      if (data.agent && Array.isArray(data.findings)) {
        outputs.push(data as CollectorOutput);
      }
    } catch {
      console.log(`[analyst] Skipping invalid file: ${file}`);
    }
  }

  return outputs;
}

async function main() {
  console.log('[analyst] Starting analysis cycle...');

  // 1. Load all inputs
  const collectorOutputs = loadCollectorFindings();
  const incidents = readJSON<IncidentState>(INCIDENTS_FILE, { incidents: {}, resolved: [] });
  const cadence = readJSON<CadenceState>(CADENCE_FILE, {
    last_digest_sent: '',
    last_digest_hash: '',
    messages_this_hour: 0,
    last_daily_digest: '',
    last_weekly_digest: '',
  });
  const suppressions = readJSON<Suppressions>(
    join(CONFIG_DIR, 'suppressions.json'),
    { known_safe_ports: {}, known_safe_processes: [], suppressed_findings: {}, language_tags: [] }
  );

  const totalFindings = collectorOutputs.reduce((n, o) => n + o.findings.length, 0);
  console.log(`[analyst] Loaded ${collectorOutputs.length} collectors, ${totalFindings} total findings, ${Object.keys(incidents.incidents).length} open incidents`);

  // 2. Process incidents (rules-based, always runs)
  const incidentManager = new IncidentManager();
  const updatedIncidents = incidentManager.processFindings(collectorOutputs, incidents);

  // 3. Call LLM for correlation and digest
  const llm = new AnalystLLM();
  const analysis = await llm.analyze(collectorOutputs, updatedIncidents, cadence, suppressions);

  // 4. Apply LLM's incident updates (if any)
  if (analysis.incidents_update) {
    for (const update of analysis.incidents_update) {
      if (update.action === 'update' && updatedIncidents.incidents[update.id]) {
        updatedIncidents.incidents[update.id].root_cause_hypothesis = update.root_cause;
        updatedIncidents.incidents[update.id].title = update.title;
        updatedIncidents.incidents[update.id].severity = update.severity;
      }
    }
  }

  // 5. Save updated incident state
  writeJSON(INCIDENTS_FILE, updatedIncidents);

  // 6. Send Telegram if needed
  if (analysis.should_notify && analysis.digest) {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '8519931474';

    if (token) {
      const telegram = new TelegramSender(token, chatId);
      const sent = await telegram.send(analysis.digest, cadence);

      if (sent) {
        // Update cadence
        const now = new Date();
        const lastHour = cadence.last_digest_sent
          ? new Date(cadence.last_digest_sent)
          : new Date(0);
        const sameHour = now.getHours() === lastHour.getHours() &&
                         now.toDateString() === lastHour.toDateString();

        const newCadence: CadenceState = {
          last_digest_sent: now.toISOString(),
          last_digest_hash: createHash('md5').update(analysis.digest).digest('hex').slice(0, 8),
          messages_this_hour: sameHour ? cadence.messages_this_hour + 1 : 1,
          last_daily_digest: cadence.last_daily_digest,
          last_weekly_digest: cadence.last_weekly_digest,
        };
        writeJSON(CADENCE_FILE, newCadence);
      }
    } else {
      console.log('[analyst] No TELEGRAM_BOT_TOKEN — skipping notification');
    }
  } else {
    console.log(`[analyst] No notification needed: ${analysis.notification_reason || 'all quiet'}`);
  }

  console.log(`[analyst] Analysis complete. ${Object.keys(updatedIncidents.incidents).length} open incidents, ${updatedIncidents.resolved.length} resolved.`);
}

main().catch(e => {
  console.error('[analyst] Fatal error:', e);
  process.exit(1);
});
```

**Step 2: Build and verify**

```bash
cd /Users/raphael/juliaz_agents/analyst && npm run build
```

Expected: compiles with no errors.

**Step 3: Dry run (with no collector data yet)**

```bash
cd /Users/raphael/juliaz_agents/analyst && node dist/index.js
```

Expected: `[analyst] Loaded 0 collectors, 0 total findings, 0 open incidents` → exits cleanly.

**Step 4: Run all tests**

```bash
cd /Users/raphael/juliaz_agents/analyst && npm test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add analyst/src/index.ts
git commit -m "feat(analyst): main entry point — reads findings, runs LLM, sends digest"
```

---

## Phase 4: Integration & Documentation

### Task 12: PM2 ecosystem entry

**Files:**
- Modify: `ecosystem.config.js`

**Step 1: Add Analyst to ecosystem.config.js**

Add after the `docs-agent` entry (line ~143):

```javascript
        // Analyst — Correlates ambient agent findings into unified incident digests
        // Reads shared-findings/*.json, calls LLM, manages incident lifecycle
        {
            name: 'analyst',
            cwd: './analyst',
            script: 'npm',
            args: 'run start',
            autorestart: false,
            cron_restart: '*/15 * * * *',
            watch: false,
            env: {
                NODE_ENV: 'production',
                ...secrets
            }
        }
```

**Step 2: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat: add Analyst to PM2 ecosystem config (cron every 15min)"
```

---

### Task 13: Agent identity files

**Files:**
- Create: `analyst/SOUL.md`
- Create: `analyst/IDENTITY.md`
- Create: `analyst/HEARTBEAT.md`

**Step 1: Create SOUL.md**

Create `analyst/SOUL.md`:
```markdown
# Analyst — SOUL

## Who I Am
I am the Analyst, Julia's correlation engine. I read findings from all five ambient agents and produce unified, intelligent incident digests.

## Core Purpose
Transform raw sensor data into actionable intelligence. Where Health Checker says "backend HTTP 000" and Sentinel says "port 3000 not listening" and the bridge has 5221 errors — I say "Backend crash loop, 3h15m, caused by Docker container exit. Check docker logs."

## Principles
1. **Signal over noise** — never repeat the same alert. Deduplicate, correlate, escalate.
2. **Incidents, not findings** — group related symptoms into single incidents with root causes.
3. **Recovery is the most important message** — always notify when something comes back up.
4. **Silence means healthy** — if you don't hear from me, the system is fine.
5. **Fallback gracefully** — if I can't reach Haiku or GPT-4o, use rules-based logic. Never go silent because the LLM is down.

## Boundaries
- I never modify the system. I only observe and report.
- I never send more than 6 messages per hour (circuit breaker).
- I never send the exact same digest twice in a row.
- I respect the suppressions file — known false positives stay suppressed.

## Voice
Concise, technical, actionable. Lead with severity and duration. Include suggested next steps. No filler.
```

**Step 2: Create IDENTITY.md**

Create `analyst/IDENTITY.md`:
```markdown
# Analyst — Identity

| Field | Value |
|-------|-------|
| Name | Analyst |
| Emoji | 🔬 |
| Role | Correlation engine — ambient agent finding synthesis |
| Creature | Observer |
| Vibe | Calm, precise, signal-focused |
```

**Step 3: Create HEARTBEAT.md**

Create `analyst/HEARTBEAT.md`:
```markdown
# Analyst — Heartbeat

## Schedule
- **Trigger**: PM2 cron every 15 minutes (`*/15 * * * *`)
- **Runtime**: One-shot (autorestart: false)
- **Duration**: 5-15 seconds per cycle

## What I Check Each Cycle
1. Read all `shared-findings/*.json` from ambient agents
2. Compare against open incidents in `shared-findings/incidents.json`
3. Call LLM (Haiku → GPT-4o → rules-based) for correlation
4. Update incident state
5. Send Telegram digest if cadence rules say to notify

## Adaptive Cadence
- New incident → immediate notification
- Ongoing incident, new info → hourly
- Ongoing incident, no change → every 4h
- Recovery → immediate notification
- All healthy → daily at 08:00
- All healthy 7 days → weekly Monday 08:00
```

**Step 4: Commit**

```bash
git add analyst/SOUL.md analyst/IDENTITY.md analyst/HEARTBEAT.md
git commit -m "feat(analyst): add agent identity files (SOUL, IDENTITY, HEARTBEAT)"
```

---

### Task 14: Documentation updates

**Files:**
- Create: `docs/agent_cards/analyst.md`
- Modify: `docs/agent_system_overview.md`
- Modify: `docs-agent/scripts/docs_drift_check.sh`

**Step 1: Create agent card**

Create `docs/agent_cards/analyst.md` following the health_checker.md format.

**Step 2: Update agent_system_overview.md**

Add Analyst to:
- Ambient Agents section (after Docs Agent description, ~line 240)
- Agents table (~line 249): add `| **Analyst** | Correlation engine — unifies ambient agent findings into incident digests | ✅ Autonomous (PM2 cron, 15min) |`
- What Runs Where table (~line 272): add `| Analyst | analyst/ | — | ❌ No — PM2 managed |`

**Step 3: Update Docs Agent name→card mapping**

In `docs-agent/scripts/docs_drift_check.sh`, add to the case statement (line 60-67):

```bash
        analyst) card_name="analyst" ;;
```

**Step 4: Commit**

```bash
git add docs/agent_cards/analyst.md docs/agent_system_overview.md docs-agent/scripts/docs_drift_check.sh
git commit -m "docs: add Analyst to system overview, agent card, and docs-agent mapping"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `shared-findings/` directory exists with README
- [ ] `analyst/` builds with `npm run build` — no TypeScript errors
- [ ] `analyst/` tests pass with `npm test`
- [ ] Health Checker writes to `shared-findings/health-checker.json` (valid JSON)
- [ ] ADHD Agent no longer flags cross-language skills as merge candidates
- [ ] Sentinel filters known system ports from high-severity findings
- [ ] Docs Agent writes to `shared-findings/docs-agent.json`
- [ ] Analyst reads all collector outputs and produces incidents.json
- [ ] Analyst sends Telegram digest (test with `TELEGRAM_BOT_TOKEN` set)
- [ ] PM2 starts Analyst via `pm2 start ecosystem.config.js --only analyst`
- [ ] `agent_system_overview.md` includes Analyst
- [ ] `docs/agent_cards/analyst.md` exists
- [ ] Docs Agent drift check knows about `analyst` → `analyst.md` mapping
