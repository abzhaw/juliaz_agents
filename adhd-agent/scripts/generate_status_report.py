#!/usr/bin/env python3
"""
ADHD Agent — Status Report Generator
Produces an HTML email report of the full juliaz_agents system state.

Usage:
  python3 generate_status_report.py \
    --scan-output <json_string_or_-> \
    --registries path1 path2 ... \
    --output /tmp/adhd_status.html

Stdin (-): pass JSON output from scan_skills.py via pipe.
"""

import json
import sys
import argparse
import subprocess
import socket
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

# ─── Helpers ──────────────────────────────────────────────────────────────────

SEVERITY_COLOR = {
    "high":   "#e74c3c",
    "medium": "#f39c12",
    "low":    "#27ae60",
    "info":   "#3498db",
}

SEVERITY_ICON = {
    "high":   "🔴",
    "medium": "🟡",
    "low":    "🟢",
    "info":   "🔵",
}

KIND_LABEL = {
    "duplicate":                 "Duplicate",
    "near_duplicate":            "Near-Duplicate",
    "empty":                     "Thin Skill",
    "merge_candidate":           "Merge Candidate",
    "cross_registry_intentional":"Cross-Registry (intentional)",
}


def check_bridge(bridge_url: str) -> tuple[bool, str]:
    """Return (healthy, status_string)."""
    try:
        health_url = bridge_url.rstrip("/") + "/health"
        with urllib.request.urlopen(health_url, timeout=3) as r:
            body = r.read().decode()
            return True, f"Online — {body[:60]}"
    except Exception as e:
        return False, f"Unreachable — {e}"


def registry_label(path_str: str) -> str:
    """Return a short human-readable label for a registry path."""
    p = path_str.lower()
    if ".claude/skills" in p:
        return "Cowork (.claude/skills)"
    if ".skills/skills" in p:
        return "Antigravity (.skills/skills)"
    if "openclaw/skills" in p:
        return "OpenClaw (openclaw/skills)"
    if "julia_medium" in p:
        return "Julia Medium (julia_medium_agent/skills)"
    return Path(path_str).name


def load_skills_by_registry(scan_data: dict) -> dict[str, list[dict]]:
    """Group all skills by their registry label using the scan output structure."""
    by_reg: dict[str, list[dict]] = {}
    for reg in scan_data.get("scanned_registries", []):
        label = registry_label(reg)
        by_reg[label] = []

    # scan_skills.py doesn't include full skill lists — only findings.
    # We reconstruct skill names from affected_paths in findings, but for
    # the full inventory we re-read the registries here.
    for reg in scan_data.get("scanned_registries", []):
        label = registry_label(reg)
        p = Path(reg)
        skills = []
        if p.exists():
            for entry in sorted(p.iterdir()):
                if entry.is_dir() and (entry / "SKILL.md").exists():
                    skill_md = entry / "SKILL.md"
                    name = entry.name
                    try:
                        text = skill_md.read_text(encoding="utf-8")
                        import re
                        m = re.search(r'^name:\s*(.+)$', text, re.MULTILINE)
                        if m:
                            name = m.group(1).strip().strip('"\'')
                    except Exception:
                        pass
                    skills.append({"name": name, "path": str(skill_md)})
        by_reg[label] = skills

    return by_reg


# ─── HTML Builder ─────────────────────────────────────────────────────────────

def build_html(scan_data: dict, bridge_url: str) -> str:
    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y-%m-%d %H:%M UTC")
    scan_ts = scan_data.get("scan_timestamp", timestamp)

    findings = [f for f in scan_data.get("findings", []) if f.get("severity") != "info"]
    info_findings = [f for f in scan_data.get("findings", []) if f.get("severity") == "info"]
    total_skills = scan_data.get("total_skills", "?")

    bridge_ok, bridge_status = check_bridge(bridge_url)
    bridge_badge_color = "#27ae60" if bridge_ok else "#e74c3c"
    bridge_icon = "✅" if bridge_ok else "❌"

    skills_by_registry = load_skills_by_registry(scan_data)

    # ── Finding rows ──
    def finding_row(f: dict) -> str:
        sev = f.get("severity", "low")
        color = SEVERITY_COLOR.get(sev, "#888")
        icon = SEVERITY_ICON.get(sev, "•")
        kind = KIND_LABEL.get(f.get("kind", ""), f.get("kind", ""))
        paths_html = "".join(
            f'<li style="font-size:11px;color:#555;font-family:monospace;">{p}</li>'
            for p in f.get("affected_paths", [])
        )
        return f"""
        <tr>
          <td style="padding:8px 4px;vertical-align:top;">
            <span style="font-size:16px;">{icon}</span>
          </td>
          <td style="padding:8px 12px 8px 4px;vertical-align:top;">
            <div style="font-weight:600;color:{color};font-size:13px;">[{kind.upper()}]</div>
            <div style="font-weight:500;margin-top:2px;">{f.get('title','')}</div>
            <div style="color:#555;font-size:12px;margin-top:4px;">{f.get('description','').replace(chr(10),'<br>')}</div>
            <ul style="margin:6px 0 0 0;padding-left:14px;">{paths_html}</ul>
            <div style="background:#f5f5f5;border-left:3px solid {color};padding:6px 10px;margin-top:6px;font-size:12px;">
              <strong>Proposal:</strong> {f.get('proposal','').replace(chr(10),'<br>')}
            </div>
          </td>
        </tr>"""

    findings_html = ""
    if findings:
        findings_html = f"""
        <h2 style="font-size:16px;color:#e74c3c;margin:24px 0 8px;">
          ⚠️ Active Findings ({len(findings)})
        </h2>
        <table style="width:100%;border-collapse:collapse;">
          {''.join(finding_row(f) for f in findings)}
        </table>"""
    else:
        findings_html = """
        <div style="background:#eafaf1;border:1px solid #82e0aa;border-radius:6px;padding:14px 18px;margin:16px 0;">
          ✨ <strong>System is clean.</strong> No issues found in this scan.
        </div>"""

    # Acknowledged cross-registry duplicates (info)
    ack_html = ""
    if info_findings:
        ack_rows = "".join(
            f'<li style="font-size:12px;color:#555;margin:3px 0;">🔵 {f.get("title","")}</li>'
            for f in info_findings
        )
        ack_html = f"""
        <details style="margin-top:12px;">
          <summary style="cursor:pointer;font-size:13px;color:#3498db;font-weight:500;">
            {len(info_findings)} acknowledged intentional cross-registry item(s)
          </summary>
          <ul style="margin:8px 0 0 0;padding-left:18px;">{ack_rows}</ul>
        </details>"""

    # ── Skills inventory ──
    registry_blocks = ""
    for label, skills in skills_by_registry.items():
        if not skills:
            skills_list = '<li style="color:#aaa;font-size:12px;">— empty registry —</li>'
        else:
            skills_list = "".join(
                f'<li style="font-size:12px;margin:2px 0;color:#333;">'
                f'<span style="font-family:monospace;background:#f0f0f0;padding:1px 5px;border-radius:3px;">{s["name"]}</span>'
                f'</li>'
                for s in skills
            )
        registry_blocks += f"""
        <div style="flex:1;min-width:200px;background:#fafafa;border:1px solid #e0e0e0;
                    border-radius:8px;padding:14px 16px;margin:6px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:#333;">
            {label}
            <span style="font-size:11px;font-weight:400;color:#888;margin-left:6px;">
              ({len(skills)} skill{"s" if len(skills) != 1 else ""})
            </span>
          </div>
          <ul style="margin:0;padding-left:14px;list-style:disc;">{skills_list}</ul>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>🧹 ADHD Agent Status — {timestamp}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;
              box-shadow:0 2px 12px rgba(0,0,0,.08);overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
                padding:28px 32px;color:#fff;">
      <div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;">
        🧹 ADHD Agent
      </div>
      <div style="font-size:14px;opacity:.8;margin-top:4px;">
        Hourly System Status Report
      </div>
      <div style="font-size:12px;opacity:.6;margin-top:8px;">
        {timestamp} &nbsp;·&nbsp; {total_skills} skills scanned
      </div>
    </div>

    <div style="padding:24px 32px;">

      <!-- Health bar -->
      <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#f8f8f8;border:1px solid #e8e8e8;
                    border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#1a1a2e;">{total_skills}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">total skills</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f8f8f8;border:1px solid #e8e8e8;
                    border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:{'#e74c3c' if findings else '#27ae60'};">
            {len(findings)}
          </div>
          <div style="font-size:11px;color:#888;margin-top:2px;">active findings</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f8f8f8;border:1px solid #e8e8e8;
                    border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:{bridge_badge_color};">
            {bridge_icon}
          </div>
          <div style="font-size:11px;color:#888;margin-top:2px;">bridge</div>
        </div>
        <div style="flex:1;min-width:120px;background:#f8f8f8;border:1px solid #e8e8e8;
                    border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#3498db;">4h</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">scan cycle</div>
        </div>
      </div>

      <!-- Bridge detail -->
      <div style="font-size:11px;color:#999;margin-bottom:20px;border-bottom:1px solid #f0f0f0;padding-bottom:14px;">
        Bridge: <span style="color:{bridge_badge_color};">{bridge_status}</span>
      </div>

      <!-- Findings -->
      {findings_html}
      {ack_html}

      <!-- Skills Inventory -->
      <h2 style="font-size:16px;color:#1a1a2e;margin:28px 0 10px;">📦 Skills Inventory</h2>
      <div style="display:flex;flex-wrap:wrap;gap:0;margin:-6px;">
        {registry_blocks}
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#fafafa;border-top:1px solid #f0f0f0;padding:14px 32px;
                font-size:11px;color:#aaa;text-align:center;">
      ADHD Agent · juliaz_agents · Next scan in ~4 hours
      &nbsp;·&nbsp; Reply via Telegram for approval requests
    </div>
  </div>
</body>
</html>"""

    return html


# ─── Telegram Format ──────────────────────────────────────────────────────────

def build_telegram(scan_data: dict, bridge_url: str) -> str:
    """Build a concise Telegram Markdown status report (fits within 4096 char limit)."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total = scan_data.get("total_skills", 0)
    all_findings = scan_data.get("findings", [])
    findings = [f for f in all_findings if f.get("severity") != "info"]
    info_findings = [f for f in all_findings if f.get("severity") == "info"]

    bridge_ok, bridge_status = check_bridge(bridge_url)
    bridge_icon = "✅" if bridge_ok else "❌"

    lines = [
        "🧹 *ADHD Agent — Status Report*",
        f"_{now}_",
        "",
    ]

    # Skills inventory per registry
    lines.append(f"📦 *Skills — {total} total*")
    for reg in scan_data.get("scanned_registries", []):
        label = registry_label(reg)
        p = Path(reg)
        names = []
        if p.exists():
            for e in sorted(p.iterdir()):
                if e.is_dir() and (e / "SKILL.md").exists():
                    names.append(e.name)
        preview = ", ".join(names[:5])
        ellipsis = "…" if len(names) > 5 else ""
        lines.append(f"  • *{label}*: {len(names)} → `{preview}{ellipsis}`")

    lines.append("")

    # Findings
    if findings:
        lines.append(f"⚠️ *Active Findings ({len(findings)})*")
        for f in findings:
            icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(f.get("severity", "low"), "•")
            lines.append(f"  {icon} {f.get('title', '')}")
            prop = f.get("proposal", "").split("\n")[0][:80]
            lines.append(f"     → _{prop}_")
    else:
        lines.append("✨ *System is clean* — no issues found")

    if info_findings:
        lines.append(f"  🔵 {len(info_findings)} cross-registry intentional (acknowledged)")

    lines.append("")

    # Bridge health
    lines.append(f"🔌 *Bridge*: {bridge_icon} {bridge_status[:60]}")
    lines.append("")
    lines.append("_Next scan in \\~4h · Telegram proposals require your YES/NO_")

    return "\n".join(lines)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate ADHD Agent status report")
    parser.add_argument("--scan-output", default="-",
                        help="JSON from scan_skills.py (pass '-' to read from stdin)")
    parser.add_argument("--output",
                        help="Output file path (required for --format html, omit for telegram)")
    parser.add_argument("--format", choices=["html", "telegram"], default="html",
                        help="Output format: 'html' writes a file, 'telegram' prints to stdout")
    parser.add_argument("--bridge-url", default="http://127.0.0.1:3001",
                        help="Bridge URL for health check")
    args = parser.parse_args()

    if args.scan_output == "-":
        raw = sys.stdin.read()
    else:
        raw = args.scan_output

    try:
        scan_data = json.loads(raw)
    except json.JSONDecodeError:
        scan_data = {"findings": [], "total_skills": 0, "scanned_registries": []}

    if args.format == "telegram":
        print(build_telegram(scan_data, args.bridge_url))
    else:
        if not args.output:
            print("ERROR: --output is required for --format html", file=sys.stderr)
            sys.exit(1)
        html = build_html(scan_data, args.bridge_url)
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        print(f"[adhd] Status report written to {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
