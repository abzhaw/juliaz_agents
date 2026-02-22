# Thesis Session Buffer

> Short-term memory for the Thesis Agent. Julia appends an entry here after every substantive user prompt.
> When the buffer reaches **5 entries**, the Thesis Agent autonomously flushes to the three protocol documents and clears this buffer.

---

**Buffer count**: 2
**Last flush**: 2026-02-22 (Sessions 10 + 11 flushed directly — cowork-mcp build, infrastructure audit)
**Flush threshold**: 5 entries

---

## Buffer Entries

### Entry 1 — 2026-02-22 — Context-Continuation: adhd-focus Skill Deduplication

**What happened**: Continued from previous context window (Sessions 1–11 already documented). Resolved the `adhd-focus` skill duplicate flagged by the ADHD agent's scanner on its first run.

**Actions taken**:
- Copied `.claude/skills/adhd_focus/` → `.claude/skills/adhd-focus/` (fixed underscore → kebab-case)
- Confirmed `.skills/skills/adhd-focus/` description is read-only (managed by Cowork) — cannot be updated directly
- `.claude/skills/adhd_focus/` folder deletion blocked by macOS FUSE file locks (Cowork holds handles) — will clean up after next Cowork restart
- Net result: `adhd-focus` (kebab-case) is now the active loaded version; `adhd_focus` (underscore) is a dead remnant pending deletion

**Key finding**: Cross-registry near-duplicates (`.claude/skills/` vs `.skills/skills/`) are intentional — different agents read different registries. ADHD agent should be configured to acknowledge intentional cross-registry duplicates rather than flag them as errors.

**Decisions**:
- No protocol doc entry needed for this micro-session (housekeeping only)
- Raphael: manually delete `<workspace>/.claude/skills/adhd_focus/` from Finder after next Cowork restart

### Entry 2 — 2026-02-22 — System Repair: MCP, Backend Routes, Orchestrator Model

**What happened**: Full infrastructure repair session. Three distinct failures diagnosed and resolved.

**Actions taken**:
- Docker backend rebuilt (`--build`) to expose `/usage` and `/updates` routes that existed in source but not in the stale compiled container
- Stopped orchestrator processes (TN/SIGSTOP state) killed; confirmed fresh S-state processes already running in a separate terminal
- MCP transport switched from HTTP-URL (`"url": "http://localhost:3001/mcp"`) to stdio (`"command": "node", "args": ["bridge/mcp-stdio.mjs"]`); created `bridge/mcp-stdio.mjs` as a lightweight stdio proxy with `talk_to_julia`, `get_julia_reply`, `bridge_status` tools
- Bridge `src/index.ts` hardened: atomic queue writes (write-to-tmp then rename), corrupted-queue backup on load
- Orchestrator model updated from `claude-3-5-sonnet-20241022` (404 — no longer on this account) to `claude-haiku-4-5-20251001` (available); account has migrated to Claude 4.x only

**Key findings**:
- Anthropic account only has Claude 4.x models (`claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`, etc.) — all Claude 3.x model IDs return 404
- HTTP-URL MCP is fragile: if bridge is down at Claude Code startup, the entire session loses MCP silently; stdio avoids this race condition entirely
- OpenAI key (`gpt-4o`) remains healthy throughout

<!-- Next entry goes here -->

---

<!-- Julia appends new entries here. Do not manually edit. -->
