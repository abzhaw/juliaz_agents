#!/usr/bin/env python3
"""
ADHD Agent — Skill Scanner
Scans all registries, finds duplicates, near-duplicates, empty skills,
and merge candidates. Outputs JSON findings to stdout.

Usage: python3 scan_skills.py [--registries path1 path2 ...] [--json]
       python3 scan_skills.py [--exceptions path/to/exceptions.json]
       python3 scan_skills.py [--no-exceptions]  # ignore all exception rules
"""

import re
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict

# ─── Default registry paths ───────────────────────────────────────────────────

BASE = Path("/Users/raphael/Documents/Devs/juliaz_agents")

DEFAULT_REGISTRIES = [
    BASE / ".claude/skills",
    BASE / ".skills/skills",
    BASE / "openclaw/skills",
    BASE / "julia_medium_agent/skills",
]

DEFAULT_EXCEPTIONS_FILE = BASE / "adhd-agent/config/exceptions.json"

# ─── Types ────────────────────────────────────────────────────────────────────

@dataclass
class Skill:
    name: str
    path: str
    registry: str
    description: str
    body_length: int  # lines in SKILL.md body (below frontmatter)
    has_references: bool

@dataclass
class Finding:
    kind: str            # duplicate | near_duplicate | empty | merge_candidate | orphan | cross_registry_intentional
    severity: str        # high | medium | low | info
    title: str
    description: str
    affected_paths: list
    proposal: str
    fingerprint: str     # stable ID for deduplication across runs

# ─── Exception Loading ────────────────────────────────────────────────────────

def load_exceptions(exceptions_file: Path) -> dict:
    """
    Load exception rules from exceptions.json.

    Supported keys:
      cross_registry_intentional: list of {normalized_name, reason, added}
        → suppresses duplicate/near_duplicate findings for that skill name
          when it appears across different registries.

      registry_pair_rules: list of {registry_a_pattern, registry_b_pattern, reason}
        → suppresses ALL cross-registry duplicate findings between any two
          registries whose paths match both patterns. Useful for declaring
          that e.g. .claude/skills ↔ .skills/skills are always intentionally
          separate (different agents read different registries).
    """
    if not exceptions_file.exists():
        return {"cross_registry_intentional": [], "registry_pair_rules": []}
    try:
        data = json.loads(exceptions_file.read_text(encoding="utf-8"))
        data.setdefault("cross_registry_intentional", [])
        data.setdefault("registry_pair_rules", [])
        return data
    except Exception as e:
        print(f"⚠️  Could not load exceptions file ({exceptions_file}): {e}", flush=True)
        return {"cross_registry_intentional": [], "registry_pair_rules": []}


def is_cross_registry_exception(skill_name: str, registry_a: str, registry_b: str, exceptions: dict) -> bool:
    """
    Return True if this cross-registry pair should be treated as intentional
    (i.e., suppressed from high-severity findings).

    Checks two rule types:
    1. Named skill exception: skill appears by name in cross_registry_intentional.
    2. Registry-pair rule: both registries match a registry_pair_rules entry.
    """
    norm = normalize_name(skill_name)

    # Check specific named exceptions
    for exc in exceptions.get("cross_registry_intentional", []):
        exc_name = normalize_name(exc.get("normalized_name", ""))
        if exc_name and exc_name == norm:
            return True

    # Check registry-pair rules (catches any skill between two declared registry pairs)
    for rule in exceptions.get("registry_pair_rules", []):
        pat_a = rule.get("registry_a_pattern", "")
        pat_b = rule.get("registry_b_pattern", "")
        if not pat_a or not pat_b:
            continue
        match_fwd = pat_a in registry_a and pat_b in registry_b
        match_rev = pat_a in registry_b and pat_b in registry_a
        if match_fwd or match_rev:
            return True

    return False


# ─── Parser ───────────────────────────────────────────────────────────────────

def parse_skill_md(path: Path) -> tuple[str, str, int]:
    """Returns (name, description, body_line_count)"""
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return "", "", 0

    name = ""
    description = ""
    body_lines = 0

    in_frontmatter = False
    frontmatter_done = False
    fm_lines = []
    body_line_list = []

    for i, line in enumerate(text.splitlines()):
        if i == 0 and line.strip() == "---":
            in_frontmatter = True
            continue
        if in_frontmatter and line.strip() == "---":
            in_frontmatter = False
            frontmatter_done = True
            continue
        if in_frontmatter:
            fm_lines.append(line)
        elif frontmatter_done:
            body_line_list.append(line)

    # Parse name and description from frontmatter
    fm_text = "\n".join(fm_lines)
    name_match = re.search(r'^name:\s*(.+)$', fm_text, re.MULTILINE)
    if name_match:
        name = name_match.group(1).strip().strip('"\'')

    # Description can be multiline (YAML block scalar)
    desc_match = re.search(r'^description:\s*[>|]?\s*\n((?:[ \t]+.+\n?)*)', fm_text, re.MULTILINE)
    if desc_match:
        description = " ".join(desc_match.group(1).split()).strip()
    else:
        desc_match = re.search(r'^description:\s*(.+)$', fm_text, re.MULTILINE)
        if desc_match:
            description = desc_match.group(1).strip().strip('"\'')

    body_lines = len([l for l in body_line_list if l.strip()])

    return name, description, body_lines


def load_registry(registry_path: Path) -> list[Skill]:
    skills = []
    if not registry_path.exists():
        return skills

    for entry in sorted(registry_path.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        if not skill_md.exists():
            continue

        name, description, body_lines = parse_skill_md(skill_md)
        if not name:
            name = entry.name  # fallback to folder name

        has_refs = (entry / "references").exists() or (entry / "assets").exists()

        skills.append(Skill(
            name=name,
            path=str(skill_md),
            registry=str(registry_path),
            description=description,
            body_length=body_lines,
            has_references=has_refs,
        ))

    return skills


# ─── Detection Logic ──────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    return re.sub(r'[-_\s]+', '-', name.lower().strip())


def desc_similarity(a: str, b: str) -> float:
    """Jaccard similarity on meaningful tokens (programming-domain stop words removed)."""
    if not a or not b:
        return 0.0

    # Programming-domain stop words — terms that appear in ALL skill descriptions
    # and don't indicate actual similarity
    stop_words = {
        # Generic programming terms
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
        "skill", "agent", "tool", "script", "command",
        # Common English filler words
        "the", "and", "for", "with", "that", "this", "from",
        "not", "are", "was", "but", "can", "has", "had",
        "will", "may", "use", "how", "when", "what", "which",
        "also", "more", "than", "into", "been", "each",
        "your", "their", "about", "between", "through",
    }

    tokens_a = set(re.findall(r'\b[a-z]{2,}\b', a.lower())) - stop_words
    tokens_b = set(re.findall(r'\b[a-z]{2,}\b', b.lower())) - stop_words
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def find_exact_duplicates(all_skills: list[Skill], exceptions: dict) -> list[Finding]:
    findings = []
    by_norm_name: dict[str, list[Skill]] = {}
    for s in all_skills:
        key = normalize_name(s.name)
        by_norm_name.setdefault(key, []).append(s)

    for norm_name, skills in by_norm_name.items():
        if len(skills) < 2:
            continue

        paths = [s.path for s in skills]
        registries = [s.registry for s in skills]

        # Check if ALL affected registry pairs are covered by an exception rule
        all_pairs_excepted = True
        for i, sa in enumerate(skills):
            for sb in skills[i+1:]:
                if sa.registry != sb.registry:
                    if not is_cross_registry_exception(norm_name, sa.registry, sb.registry, exceptions):
                        all_pairs_excepted = False
                        break
                else:
                    # Same registry — never excepted (genuine duplicate)
                    all_pairs_excepted = False
                    break

        if all_pairs_excepted:
            # Emit a low-severity info finding (acknowledged, not noise)
            findings.append(Finding(
                kind="cross_registry_intentional",
                severity="info",
                title=f"Cross-registry intentional: {norm_name}",
                description=(
                    f"'{norm_name}' appears in {len(skills)} registries, but this is acknowledged as intentional "
                    f"(different agents read different registries):\n"
                    + "\n".join(f"  • {p}" for p in paths)
                ),
                affected_paths=paths,
                proposal="No action needed. Edit config/exceptions.json to remove the exception if this becomes unintentional.",
                fingerprint=f"cross_registry_intentional::{norm_name}",
            ))
            continue

        # Prefer .skills/ (anthropic bundled) as authoritative
        authoritative = next((s for s in skills if ".skills" in s.registry), skills[0])
        candidates_to_remove = [s for s in skills if s != authoritative]

        findings.append(Finding(
            kind="duplicate",
            severity="high",
            title=f"Duplicate skill: {norm_name}",
            description=(
                f"The skill '{norm_name}' exists in {len(skills)} registries:\n"
                + "\n".join(f"  • {p}" for p in paths)
            ),
            affected_paths=paths,
            proposal=(
                f"Keep '{authoritative.path}' as the authoritative copy.\n"
                f"Remove: {', '.join(s.path for s in candidates_to_remove)}"
            ),
            fingerprint=f"duplicate::{norm_name}",
        ))

    return findings


def find_near_duplicates(all_skills: list[Skill], exceptions: dict, threshold: float = 0.75) -> list[Finding]:
    findings = []
    seen_pairs = set()

    for i, a in enumerate(all_skills):
        for b in all_skills[i+1:]:
            if normalize_name(a.name) == normalize_name(b.name):
                continue  # already caught as exact duplicate

            # Skip cross-registry near-duplicates that are covered by an exception
            if a.registry != b.registry:
                if is_cross_registry_exception(a.name, a.registry, b.registry, exceptions) or \
                   is_cross_registry_exception(b.name, a.registry, b.registry, exceptions):
                    continue

            # Language-aware: different languages can't be near-duplicates
            langs_a = extract_language_tags(a.name, a.description)
            langs_b = extract_language_tags(b.name, b.description)
            if langs_a and langs_b and not langs_a.intersection(langs_b):
                continue

            sim = desc_similarity(a.description, b.description)
            if sim >= threshold:
                pair_key = tuple(sorted([a.path, b.path]))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                findings.append(Finding(
                    kind="near_duplicate",
                    severity="medium",
                    title=f"Near-duplicate: '{a.name}' ≈ '{b.name}' ({int(sim*100)}% similar)",
                    description=(
                        f"These two skills have very similar descriptions ({int(sim*100)}% overlap):\n"
                        f"  • {a.path}\n"
                        f"  • {b.path}\n"
                        f"  Desc A: {a.description[:120]}...\n"
                        f"  Desc B: {b.description[:120]}..."
                    ),
                    affected_paths=[a.path, b.path],
                    proposal=f"Review and consider merging '{a.name}' and '{b.name}' into a single skill.",
                    fingerprint=f"near_dup::{normalize_name(a.name)}::{normalize_name(b.name)}",
                ))

    return findings


def find_empty_skills(all_skills: list[Skill]) -> list[Finding]:
    findings = []
    for s in all_skills:
        if s.body_length < 5:
            findings.append(Finding(
                kind="empty",
                severity="medium" if s.body_length == 0 else "low",
                title=f"Thin skill: '{s.name}' ({s.body_length} content lines)",
                description=f"Skill at {s.path} has very little content ({s.body_length} non-empty lines).",
                affected_paths=[s.path],
                proposal=f"Either flesh out '{s.name}' with real instructions, or delete it if unused.",
                fingerprint=f"empty::{s.path}",
            ))
    return findings


LANGUAGE_TAGS = {
    "nodejs", "node", "javascript", "js", "typescript", "ts",
    "python", "py", "go", "golang", "rust", "java", "swift",
    "ruby", "php", "csharp", "dotnet", "kotlin", "scala",
}

def extract_language_tags(name: str, desc: str) -> set[str]:
    """Extract programming language identifiers from skill name and description."""
    tokens = set(re.findall(r'\b[a-z]+\b', (name + " " + desc).lower()))
    return tokens.intersection(LANGUAGE_TAGS)


def find_merge_candidates(all_skills: list[Skill], threshold: float = 0.50) -> list[Finding]:
    """Like near_duplicates but for skills from the same registry that could be merged."""
    findings = []
    by_registry: dict[str, list[Skill]] = {}
    for s in all_skills:
        by_registry.setdefault(s.registry, []).append(s)

    seen_pairs = set()
    for registry, skills in by_registry.items():
        for i, a in enumerate(skills):
            for b in skills[i+1:]:
                if normalize_name(a.name) == normalize_name(b.name):
                    continue

                # Language-aware: don't suggest merging skills for different languages
                langs_a = extract_language_tags(a.name, a.description)
                langs_b = extract_language_tags(b.name, b.description)
                if langs_a and langs_b and not langs_a.intersection(langs_b):
                    continue  # different programming languages — skip entirely

                sim = desc_similarity(a.description, b.description)
                if threshold <= sim < 0.75:
                    pair_key = tuple(sorted([a.path, b.path]))
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)
                    findings.append(Finding(
                        kind="merge_candidate",
                        severity="low",
                        title=f"Possible merge: '{a.name}' + '{b.name}' ({int(sim*100)}% overlap)",
                        description=(
                            f"These same-registry skills partially overlap ({int(sim*100)}%):\n"
                            f"  • {a.path}\n"
                            f"  • {b.path}"
                        ),
                        affected_paths=[a.path, b.path],
                        proposal=f"Consider merging '{a.name}' and '{b.name}' to reduce cognitive overhead.",
                        fingerprint=f"merge::{normalize_name(a.name)}::{normalize_name(b.name)}",
                    ))
    return findings


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="ADHD Agent skill scanner")
    parser.add_argument("--registries", nargs="+", help="Override registry paths")
    parser.add_argument("--json", action="store_true", help="Output JSON (default: human-readable)")
    parser.add_argument("--min-severity", choices=["info","low","medium","high"], default="low",
                        help="Minimum severity to include in output (default: low; use 'info' to see all)")
    parser.add_argument("--exceptions", default=str(DEFAULT_EXCEPTIONS_FILE),
                        help="Path to exceptions.json (default: adhd-agent/config/exceptions.json)")
    parser.add_argument("--no-exceptions", action="store_true",
                        help="Ignore all exception rules (audit mode — shows everything)")
    args = parser.parse_args()

    registry_paths = [Path(p) for p in args.registries] if args.registries else DEFAULT_REGISTRIES

    # Load exceptions (unless --no-exceptions flag is set)
    if args.no_exceptions:
        exceptions = {"cross_registry_intentional": [], "registry_pair_rules": []}
    else:
        exceptions = load_exceptions(Path(args.exceptions))

    all_skills = []
    for rp in registry_paths:
        skills = load_registry(rp)
        all_skills.extend(skills)

    findings: list[Finding] = []
    findings += find_exact_duplicates(all_skills, exceptions)
    findings += find_near_duplicates(all_skills, exceptions)
    findings += find_empty_skills(all_skills)
    findings += find_merge_candidates(all_skills)

    # Filter by severity
    severity_order = {"high": 4, "medium": 3, "low": 2, "info": 1}
    min_sev = severity_order[args.min_severity]
    findings = [f for f in findings if severity_order.get(f.severity, 0) >= min_sev]
    findings.sort(key=lambda f: severity_order.get(f.severity, 0), reverse=True)

    # Write to shared-findings for Analyst consumption
    from datetime import datetime, timezone
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
    shared_path = Path(BASE / "shared-findings" / "adhd-agent.json")
    shared_path.parent.mkdir(parents=True, exist_ok=True)
    shared_path.write_text(json.dumps(shared_output, indent=2))

    if args.json:
        output = {
            "scanned_registries": [str(p) for p in registry_paths],
            "total_skills": len(all_skills),
            "exceptions_file": args.exceptions if not args.no_exceptions else "(disabled)",
            "findings": [asdict(f) for f in findings],
        }
        print(json.dumps(output, indent=2))
    else:
        print(f"📊 Scanned {len(all_skills)} skills across {len(registry_paths)} registries")
        if not args.no_exceptions:
            n_exc = (len(exceptions.get("cross_registry_intentional", [])) +
                     len(exceptions.get("registry_pair_rules", [])))
            print(f"📋 Exception rules loaded: {n_exc}")
        print(f"🔍 Found {len(findings)} issues\n")
        for f in findings:
            sev_icon = {"high": "🔴", "medium": "🟡", "low": "🟢", "info": "🔵"}[f.severity]
            print(f"{sev_icon} [{f.kind.upper()}] {f.title}")
            print(f"   {f.description}")
            print(f"   → {f.proposal}")
            print()

if __name__ == "__main__":
    main()
