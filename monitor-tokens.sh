#!/usr/bin/env bash
# Token consumption monitor — 10 minute standby report
# Usage: ./monitor-tokens.sh [DURATION_SECONDS] [POLL_INTERVAL_SECONDS]

DURATION=${1:-600}     # 10 minutes default
INTERVAL=${2:-30}      # poll every 30s
BACKEND="http://localhost:3000"
REPORT_FILE="/tmp/token-report-$(date +%Y%m%d-%H%M%S).txt"
SNAPSHOTS_FILE="/tmp/token-snapshots-$$.json"

echo "[]" > "$SNAPSHOTS_FILE"

# ── helpers ────────────────────────────────────────────────────────────────
fetch_usage() {
  curl -s "$BACKEND/usage" 2>/dev/null
}

timestamp_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ── baseline ───────────────────────────────────────────────────────────────
START_TIME=$(date +%s)
START_WALL=$(timestamp_now)

echo "▶ Monitor started at $START_WALL"
echo "  Duration: ${DURATION}s  |  Poll interval: ${INTERVAL}s"
echo ""

BASELINE=$(fetch_usage)
if [[ "$BASELINE" == "" || "$BASELINE" == "null" ]]; then
  echo "ERROR: Backend not reachable at $BACKEND/usage"
  exit 1
fi

# Extract the max id at baseline (most recent record id)
BASELINE_MAX_ID=$(echo "$BASELINE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data:
    print(max(r['id'] for r in data))
else:
    print(0)
" 2>/dev/null || echo "0")

BASELINE_TOTALS=$(echo "$BASELINE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
totals = {}
for r in data:
    m = r['model']
    totals[m] = totals.get(m, {'prompt':0,'completion':0,'total':0,'calls':0})
    totals[m]['prompt']     += r['promptTokens']
    totals[m]['completion'] += r['completionTokens']
    totals[m]['total']      += r['totalTokens']
    totals[m]['calls']      += 1
print(json.dumps(totals))
")

echo "  Baseline snapshot: max id = $BASELINE_MAX_ID"
echo "  Baseline totals (all-time so far):"
echo "$BASELINE_TOTALS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for m, v in d.items():
    print(f'    {m}: {v[\"total\"]} tokens ({v[\"calls\"]} calls)')
"
echo ""

# ── poll loop ──────────────────────────────────────────────────────────────
POLL_NUM=0
while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START_TIME))

  if (( ELAPSED >= DURATION )); then
    break
  fi

  REMAINING=$((DURATION - ELAPSED))
  POLL_NUM=$((POLL_NUM + 1))
  echo "  [$(timestamp_now)] Poll #$POLL_NUM — ${ELAPSED}s elapsed, ${REMAINING}s remaining..."

  sleep "$INTERVAL"
done

# ── final snapshot ─────────────────────────────────────────────────────────
END_WALL=$(timestamp_now)
FINAL=$(fetch_usage)

echo ""
echo "■ Monitor ended at $END_WALL"
echo ""

# ── compute delta ──────────────────────────────────────────────────────────
python3 << PYEOF
import json, sys
from datetime import datetime

baseline_max_id = $BASELINE_MAX_ID
baseline_totals = $BASELINE_TOTALS
start_wall = "$START_WALL"
end_wall = "$END_WALL"
duration = $DURATION

final_data = json.loads('''$FINAL''')

# New records created during monitoring window
new_records = [r for r in final_data if r['id'] > baseline_max_id]

# Aggregate new records by model
delta = {}
for r in new_records:
    m = r['model']
    if m not in delta:
        delta[m] = {'prompt': 0, 'completion': 0, 'total': 0, 'calls': 0, 'timestamps': []}
    delta[m]['prompt']     += r['promptTokens']
    delta[m]['completion'] += r['completionTokens']
    delta[m]['total']      += r['totalTokens']
    delta[m]['calls']      += 1
    delta[m]['timestamps'].append(r['timestamp'])

# Grand totals for window
grand_prompt     = sum(v['prompt']     for v in delta.values())
grand_completion = sum(v['completion'] for v in delta.values())
grand_total      = sum(v['total']      for v in delta.values())
grand_calls      = sum(v['calls']      for v in delta.values())

minutes = duration / 60

sep = "═" * 60

report = f"""
{sep}
  JULIA AGENT — TOKEN CONSUMPTION REPORT
  Monitoring window: {start_wall} → {end_wall}
  Duration: {int(duration/60)} min {duration%60} sec
{sep}

  STANDBY CONSUMPTION (new activity during window)
  ─────────────────────────────────────────────────"""

if not delta:
    report += """
  ✓  NO new token consumption detected during this window.
     Julia was fully idle (no messages, no background tasks).
"""
else:
    report += f"""
  Total API calls : {grand_calls}
  Prompt tokens   : {grand_prompt:,}
  Completion tkns : {grand_completion:,}
  Total tokens    : {grand_total:,}
  Avg per call    : {grand_total // grand_calls if grand_calls else 0:,}
  Rate            : {grand_total / minutes:.1f} tokens/min

  PER-MODEL BREAKDOWN
  ─────────────────────────────────────────────────"""
    for model, v in sorted(delta.items(), key=lambda x: -x[1]['total']):
        rate = v['total'] / minutes
        report += f"""
  Model  : {model}
  Calls  : {v['calls']}
  Prompt : {v['prompt']:,}  |  Completion: {v['completion']:,}  |  Total: {v['total']:,}
  Rate   : {rate:.1f} tokens/min
  Times  : {', '.join(t[11:19] for t in sorted(v['timestamps'])[:5])}{'...' if len(v['timestamps']) > 5 else ''}
"""

report += f"""
  ALL-TIME CUMULATIVE (before this window)
  ─────────────────────────────────────────────────"""
for model, v in sorted(baseline_totals.items(), key=lambda x: -x[1]['total']):
    report += f"""
  {model}: {v['total']:,} tokens across {v['calls']} calls"""

report += f"""

{sep}
  Report generated: {end_wall}
{sep}
"""

print(report)

# Save to file
with open("$REPORT_FILE", "w") as f:
    f.write(report)
print(f"  Report saved to: $REPORT_FILE")
PYEOF
