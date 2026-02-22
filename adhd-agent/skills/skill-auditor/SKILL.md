---
name: skill-auditor
description: >
  Audit all skill registries in the juliaz_agents ecosystem for duplicates,
  near-duplicates, empty skills, and merge candidates. Use this when asked to
  "clean up skills", "find duplicate skills", "audit the agent system", or
  "what skills are redundant?". Always produces a JSON findings report and
  a prioritized list of proposals for Raphael to approve via Telegram.
---

# Skill Auditor

Scans all four skill registries and surfaces issues. This is the detection
half of the ADHD Agent — the Telegram approval loop is the action half.

## Registries Scanned

| Registry | Path | What lives here |
|---|---|---|
| Cowork/Antigravity | `.claude/skills/` | Skills created in this IDE |
| Anthropic bundled | `.skills/skills/` | Packaged .skill files |
| OpenClaw | `openclaw/skills/` | OpenClaw's own capabilities |
| Julia medium agent | `julia_medium_agent/skills/` | Julia's research skills |

## Running the Scanner

```bash
cd /path/to/adhd-agent

# Normal runs (respects exceptions.json)
python3 scripts/scan_skills.py                        # human-readable output
python3 scripts/scan_skills.py --json                 # JSON output
python3 scripts/scan_skills.py --min-severity medium  # filter low findings
python3 scripts/scan_skills.py --min-severity info    # show ALL findings incl. acknowledged

# Audit mode (ignores exceptions — see everything as-is)
python3 scripts/scan_skills.py --no-exceptions

# Custom exceptions file
python3 scripts/scan_skills.py --exceptions /path/to/my-exceptions.json
```

## Finding Types

**`duplicate`** (🔴 high) — Same normalized skill name exists in 2+ registries.
Action: Keep the authoritative copy (`.skills/` preferred), remove the others.

**`near_duplicate`** (🟡 medium) — Different names but >75% description overlap.
Action: Review both — likely one should absorb the other.

**`empty`** (🟡 medium / 🟢 low) — SKILL.md body has fewer than 5 content lines.
Action: Either flesh it out or delete it. Empty skills confuse triggering.

**`merge_candidate`** (🟢 low) — Same-registry skills with 50–75% overlap.
Action: Consider merging if they serve the same purpose.

**`cross_registry_intentional`** (🔵 info) — Skill appears in multiple registries, but this
is declared intentional in `config/exceptions.json`. Surfaced only with `--min-severity info`.
Action: None. Remove the exception rule if it becomes unintentional.

## Exception Rules (`config/exceptions.json`)

Some cross-registry duplicates are intentional — the same skill exists in multiple registries
because different agents read different registries. Adding an exception rule suppresses the
false-positive and converts it to a low-noise `info` finding.

### Two types of exception rules:

**`cross_registry_intentional`** — suppress by skill name:
```json
{
  "cross_registry_intentional": [
    {
      "normalized_name": "my-skill",
      "reason": "Explain why this cross-registry presence is intentional.",
      "added": "YYYY-MM-DD"
    }
  ]
}
```

**`registry_pair_rules`** — suppress ALL duplicates between two registries:
```json
{
  "registry_pair_rules": [
    {
      "registry_a_pattern": ".claude/skills",
      "registry_b_pattern": ".skills/skills",
      "reason": "These registries serve different agents — cross-duplicates are always intentional.",
      "added": "YYYY-MM-DD"
    }
  ]
}
```

**Current exceptions** (as of 2026-02-22):
- `adhd-focus` is explicitly excepted (Cowork vs Antigravity registries)
- The `.claude/skills` ↔ `.skills/skills` registry pair is globally excepted for the same reason

## Fingerprints

Every finding has a stable `fingerprint` (e.g., `duplicate::adhd-focus`).
This is used to:
- Avoid re-proposing the same thing every cycle
- Match snooze records
- Track what was approved/rejected in `memory/actions.json`

## Output Format (JSON)

```json
{
  "scanned_registries": [...],
  "total_skills": 22,
  "exceptions_file": "adhd-agent/config/exceptions.json",
  "findings": [
    {
      "kind": "duplicate",
      "severity": "high",
      "title": "Duplicate skill: some-skill",
      "description": "...",
      "affected_paths": ["..."],
      "proposal": "...",
      "fingerprint": "duplicate::some-skill"
    },
    {
      "kind": "cross_registry_intentional",
      "severity": "info",
      "title": "Cross-registry intentional: adhd-focus",
      "description": "Acknowledged — no action needed.",
      "affected_paths": ["..."],
      "proposal": "Edit config/exceptions.json to remove the exception if this becomes unintentional.",
      "fingerprint": "cross_registry_intentional::adhd-focus"
    }
  ]
}
```
