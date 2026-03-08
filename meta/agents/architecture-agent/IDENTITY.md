# Architecture Agent

**Role**: System Topology Scanner & Neural Map Generator
**Type**: Ambient Agent (PM2 cron, every 6 hours)
**Created**: 2026-03-08
**Owner**: Raphael

## Purpose

Maintains a living map of Julia's entire system topology. Scans all running processes, containers, agents, and skills to generate the data that powers the frontend neural map visualization. Detects structural changes and alerts when the system's shape evolves.

## Schedule

- PM2 cron: `0 */6 * * *` (every 6 hours)
- One-shot: runs, generates, exits

## Dependencies

- PM2 (for process list)
- Docker (for container list)
- Node.js (for ecosystem.config.js parsing)
- Python 3 (for graph generation + change detection)
- shared-findings/incidents.json (read/write)

## Outputs

| File | Purpose |
|------|---------|
| `frontend/src/lib/architectureGraph.json` | Live topology for neural map |
| `frontend/src/lib/architectureData.json` | Tooltip descriptions |
| `memory/last_graph.json` | Previous scan (diffing) |
| `memory/changelog.md` | Change history |
