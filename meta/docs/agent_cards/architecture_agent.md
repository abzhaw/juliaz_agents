# Architecture Agent

**Type**: Ambient Agent
**Directory**: `architecture-agent/`
**Schedule**: PM2 cron every 6 hours (`0 */6 * * *`)
**Created**: 2026-03-08
**System Layer**: Meta-System — maps the development topology, not user-facing

## Role

The Architecture Agent is Julia's cartographer. It scans the actual running system to build a ground-truth topology map, then generates `architectureGraph.json` — the data file that powers the frontend's interactive neural map visualization at `/architecture`.

## What It Does

1. **Scans ground truth**: PM2 processes, Docker containers, listening ports, agent directories, skill folders, OpenClaw status
2. **Generates graph data**: Produces a full node+edge topology in JSON format for the ReactFlow-based frontend diagram
3. **Detects changes**: Diffs against the previous scan to identify new/removed nodes and health transitions
4. **Alerts on structural changes**: Sends Telegram notifications when the system's shape changes
5. **Cross-agent communication**: Writes topology metadata to `shared-findings/incidents.json` so other agents know the current architecture

## Key Files

| File | Purpose |
|------|---------|
| `scripts/architecture_scan.sh` | Main scanner script |
| `memory/last_graph.json` | Previous topology (for diffing) |
| `memory/changelog.md` | Structural change history |
| `SOUL.md` | Agent identity and principles |

## Intelligence Features

- **Change detection**: Compares current scan against previous to flag new agents, removed services, health transitions
- **Health awareness**: Reads PM2 status and Docker state to color-code nodes as healthy/degraded
- **Incident awareness**: Reads shared-findings to know what other agents have flagged
- **Staleness detection**: Flags when `agent_system_overview.md` is more than 7 days behind
- **Atomic writes**: Uses temp files + move to prevent partial JSON corruption

## Frontend Integration

The frontend `ArchitectureDiagram.tsx` consumes `architectureGraph.json`. If the file exists, it renders the live topology with health indicators, agent nodes, and skill connections. If the file doesn't exist (first boot), it falls back to a static hardcoded layout.

## Trigger Behavior

**Silent-unless-changed**: Runs every 6 hours, always regenerates the graph file, but only sends a Telegram alert when:
- A new node appears (new agent, new service, new skill)
- A node disappears (removed agent, stopped service)
- A node's health transitions (healthy → degraded or vice versa)
