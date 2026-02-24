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
