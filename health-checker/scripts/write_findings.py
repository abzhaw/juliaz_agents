#!/usr/bin/env python3
"""
Reads findings from stdin (one JSON object per line), manages local incident state,
and writes structured output to shared-findings/health-checker.json.
"""
import json
import sys
import os
from datetime import datetime, timezone

WORKTREE = os.environ.get("PROJECT_DIR", "/Users/raphael/juliaz_agents")
SHARED_DIR = os.path.join(WORKTREE, "shared-findings")
LOCAL_STATE = os.path.join(WORKTREE, "health-checker/memory/finding_state.json")
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
    print(f"[health-checker] {len(findings)} findings, {len(healthy)} healthy -> {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
