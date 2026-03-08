#!/bin/bash

# ============================================================
# Session Logger — Append a session entry to project_log.md
#
# Usage: ./log_session.sh "Session Title" "What was done (markdown)"
#
# This is Layer 3 of the auto-documentation system.
# Called by Cowork/Antigravity at end of every substantive session.
# ============================================================

set -euo pipefail

PROJECT_DIR="/Users/raphael/juliaz_agents"
PROJECT_LOG="$PROJECT_DIR/thesis/documentation/project_log.md"
SESSION_BUFFER="$PROJECT_DIR/thesis/memory/session_buffer.md"
TODAY=$(date +"%Y-%m-%d")
NOW=$(date +"%H:%M")

TITLE="${1:-Untitled Session}"
DESCRIPTION="${2:-No description provided.}"
SOURCE="${3:-unknown}"  # cowork, antigravity, manual

# Ensure log exists
if [ ! -f "$PROJECT_LOG" ]; then
    echo "ERROR: project_log.md not found at $PROJECT_LOG" >&2
    exit 1
fi

mkdir -p "$(dirname "$SESSION_BUFFER")"

# Append to project_log.md
cat >> "$PROJECT_LOG" << ENTRY

---

## $TODAY — $TITLE

> Auto-logged by $SOURCE session at $NOW

$DESCRIPTION
ENTRY

# Also append to session buffer for thesis synthesis later
cat >> "$SESSION_BUFFER" << BUFFER

### $TODAY $NOW — $TITLE (via $SOURCE)
$DESCRIPTION

---
BUFFER

echo "✅ Session logged: $TITLE ($TODAY $NOW)"
