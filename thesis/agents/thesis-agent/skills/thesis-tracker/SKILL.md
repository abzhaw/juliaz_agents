---
name: thesis-tracker
description: Fortschrittsverfolgung der Masterarbeit. Wortanzahl pro Kapitel, Fertigstellungsgrad, fehlende Elemente, Deadlines. Haelt den Ueberblick.
---

# Thesis Tracker

Maintains a comprehensive view of thesis progress. Tracks word counts, chapter statuses, TODO markers, citations, figures, and deadlines. Produces progress reports and warnings to keep the writing on track.

## Progress Data File

The tracker maintains `thesis/progress.json` as its central data store. This file is updated after every significant writing session.

```json
{
  "thesis_title": "Agentenbasierte KI-Systeme: Multi-Agent-Orchestrierung am Beispiel von juliaz_agents",
  "target_words": 25000,
  "deadline": "2026-04-30",
  "last_updated": "2026-02-22T14:30:00Z",
  "chapters": [
    {
      "id": "01-einleitung",
      "title": "Einleitung",
      "file": "chapters/01-einleitung.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 3000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 4,
      "todos": [],
      "uncited_claims": 0,
      "figures": 0
    },
    {
      "id": "02-verwandte-arbeiten",
      "title": "Verwandte Arbeiten",
      "file": "chapters/02-verwandte-arbeiten.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 3000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 5,
      "todos": [],
      "uncited_claims": 0,
      "figures": 0
    },
    {
      "id": "03-grundlagen",
      "title": "Grundlagen",
      "file": "chapters/03-grundlagen.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 4000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 6,
      "todos": [],
      "uncited_claims": 0,
      "figures": 2
    },
    {
      "id": "04-konzept",
      "title": "Konzept und Entwurf",
      "file": "chapters/04-konzept.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 5000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 5,
      "todos": [],
      "uncited_claims": 0,
      "figures": 4
    },
    {
      "id": "05-implementierung",
      "title": "Implementierung",
      "file": "chapters/05-implementierung.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 5000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 6,
      "todos": [],
      "uncited_claims": 0,
      "figures": 4
    },
    {
      "id": "06-evaluation",
      "title": "Evaluation",
      "file": "chapters/06-evaluation.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 3000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 4,
      "todos": [],
      "uncited_claims": 0,
      "figures": 2
    },
    {
      "id": "07-fazit",
      "title": "Fazit und Ausblick",
      "file": "chapters/07-fazit.tex",
      "status": "leer",
      "word_count": 0,
      "target_words": 2000,
      "last_modified": null,
      "sections_complete": 0,
      "sections_total": 3,
      "todos": [],
      "uncited_claims": 0,
      "figures": 0
    }
  ],
  "overall": {
    "total_words": 0,
    "completion_percent": 0,
    "uncited_claims": 0,
    "todo_markers": 0,
    "figures_count": 0,
    "figures_target": 12,
    "citations_count": 0,
    "citations_target": 40
  }
}
```

## Chapter Statuses

Each chapter progresses through five stages:

### leer (Empty)
- The .tex file either does not exist or contains only the chapter heading and section stubs
- No substantive content has been written
- Word count: 0 or near 0

### notizen (Notes)
- Outline exists with bullet points, key phrases, or rough notes
- Structure is visible but prose is not written
- May contain TODO markers and placeholder text
- Word count: typically under 30% of target

### entwurf (Draft)
- First complete draft of the chapter
- All sections have prose, though it may be rough
- Citations may be incomplete (TODO markers for missing sources)
- Word count: 60-100% of target

### ueberarbeitet (Revised)
- Draft has been reviewed and revised
- Argument-advisor feedback has been addressed
- Citations are complete or nearly complete
- Language has been polished
- Word count: 90-110% of target

### final (Final)
- Ready for submission
- No TODO markers remaining
- All citations resolved
- All figures present and referenced
- Spell-checked and grammar-checked
- Word count: within 10% of target

## Tracking Capabilities

### Word Count per Chapter

Uses `texcount` to parse .tex files and count words accurately, excluding LaTeX commands, comments, and environments like `minted` or `lstlisting`.

```bash
# Count words in a specific chapter
texcount -inc -total thesis/latex/chapters/04-konzept.tex

# Count all chapters
for f in thesis/latex/chapters/*.tex; do
    echo "$(basename $f): $(texcount -total -brief $f 2>/dev/null | grep -oP '\d+' | head -1) words"
done
```

When `texcount` is unavailable, fall back to a rough estimate:

```bash
# Rough word count (less accurate, includes some LaTeX commands)
cat thesis/latex/chapters/04-konzept.tex | \
    sed 's/\\[a-zA-Z]*\({[^}]*}\)*//g' | \
    sed 's/%.*//g' | \
    wc -w
```

### TODO Markers

Scans .tex files for TODO markers in various formats:

```bash
# Standard TODO comments
grep -rn "% TODO" thesis/latex/chapters/

# TODO in citation placeholders
grep -rn "\\\\cite{TODO" thesis/latex/chapters/

# Inline TODO notes (if using todonotes package)
grep -rn "\\\\todo{" thesis/latex/chapters/
grep -rn "\\\\todo\[" thesis/latex/chapters/

# Missing content markers
grep -rn "\\\\missingfigure" thesis/latex/chapters/
grep -rn "FIXME" thesis/latex/chapters/
```

### Uncited Claims

Identifies claims that should have citations but do not. Heuristic detection:

```bash
# Find sentences with strong claims but no \cite nearby
# (Heuristic: lines containing "zeigt", "beweist", "ist bekannt" without \cite)
grep -n "zeigt\|beweist\|ist bekannt\|wurde gezeigt\|laut Studien" thesis/latex/chapters/*.tex | \
    grep -v "\\\\cite"
```

Also detects placeholder citations:
```bash
grep -rn "\\\\cite{TODO" thesis/latex/chapters/
grep -rn "\\\\cite{?}" thesis/latex/chapters/
grep -rn "\[QUELLE\]" thesis/latex/chapters/
```

### Figure Count and References

```bash
# Count figures defined
grep -c "\\\\begin{figure}" thesis/latex/chapters/*.tex

# Count figure references
grep -oP "\\\\ref\{fig:[^}]+\}" thesis/latex/chapters/*.tex | sort -u | wc -l

# Find figures that are defined but never referenced
comm -23 \
    <(grep -oP "\\\\label\{fig:[^}]+\}" thesis/latex/chapters/*.tex thesis/latex/figures/*.tex | grep -oP "fig:[^}]+" | sort -u) \
    <(grep -oP "\\\\ref\{fig:[^}]+\}" thesis/latex/chapters/*.tex | grep -oP "fig:[^}]+" | sort -u)
```

### Citation Count and Integrity

```bash
# Count unique citations used
grep -ohP "\\\\cite\{[^}]+\}" thesis/latex/chapters/*.tex | \
    tr ',' '\n' | grep -oP "[a-zA-Z0-9_-]+" | sort -u | wc -l

# Find citations used but not in .bib file
grep -ohP "\\\\cite\{[^}]+\}" thesis/latex/chapters/*.tex | \
    tr ',' '\n' | grep -oP "[a-zA-Z0-9_-]+" | sort -u | while read key; do
    grep -q "@.*{${key}," thesis/latex/bibliography/references.bib || echo "MISSING: $key"
done

# Find .bib entries never cited
grep -oP "@\w+\{([^,]+)," thesis/latex/bibliography/references.bib | \
    grep -oP "\{(.+)," | tr -d '{,' | while read key; do
    grep -rq "\\\\cite{.*${key}" thesis/latex/chapters/*.tex || echo "UNUSED: $key"
done
```

## Progress Reports

### Standard Report

Generated on demand, provides a snapshot of current progress.

```
=== Thesis Progress Report ===
Stand: 2026-02-22

Titel: Agentenbasierte KI-Systeme: Multi-Agent-Orchestrierung
       am Beispiel von juliaz_agents

Gesamtfortschritt: 8,400 / 25,000 Woerter (33.6%)
Deadline: 2026-04-30 (67 Tage verbleibend)

Kapitel                        Woerter   Ziel    %     Status
--------------------------------------------------------------
01 Einleitung                    1,200   3,000   40%   entwurf
02 Verwandte Arbeiten              800   3,000   27%   notizen
03 Grundlagen                    2,100   4,000   53%   entwurf
04 Konzept und Entwurf           2,500   5,000   50%   entwurf
05 Implementierung               1,800   5,000   36%   notizen
06 Evaluation                        0   3,000    0%   leer
07 Fazit und Ausblick                0   2,000    0%   leer

Offene Punkte:
- 12 TODO-Markierungen gesamt
- 5 unbelegte Behauptungen
- 3 fehlende Abbildungen
- 8 Zitate noch als Platzhalter

Naechste Prioritaeten:
1. Kapitel 06 (Evaluation) beginnen — noch leer
2. TODO-Markierungen in Kapitel 04 aufloesen (4 Stueck)
3. Fehlende Abbildungen in Kapitel 05 erstellen
```

### Per-Chapter Detail Report

```
=== Kapitel 04: Konzept und Entwurf ===
Status: entwurf
Woerter: 2,500 / 5,000 (50%)
Letzte Aenderung: 2026-02-20

Abschnitte:
  [x] 4.1 Systemarchitektur
  [x] 4.2 Agentenrollen
  [ ] 4.3 Kommunikationsprotokoll
  [ ] 4.4 Skill-System
  [x] 4.5 Entwurfsentscheidungen

TODOs:
  Zeile 45: % TODO: MCP-Vergleich mit REST ergaenzen
  Zeile 78: % TODO: Diagramm Skill-Hierarchie einfuegen
  Zeile 112: \cite{TODO:langchain-comparison}
  Zeile 134: % TODO: Gegenargumente fuer Agent-Architektur

Abbildungen:
  [x] fig:systemarchitektur (referenziert Zeile 52)
  [x] fig:agentenrollen (referenziert Zeile 89)
  [ ] fig:skill-hierarchie (referenziert Zeile 80, aber nicht erstellt)
  [ ] fig:kommunikationsprotokoll (noch nicht referenziert)

Zitate: 8 verwendet, 1 Platzhalter
```

## Warnings

The tracker generates warnings when it detects potential issues.

### Inactivity Warning
```
WARNUNG: Kapitel 05 (Implementierung) wurde seit 7 Tagen nicht bearbeitet.
Status: notizen — noch kein Entwurf geschrieben.
```

Triggers when a chapter with status below "final" has not been modified in N days:
- `leer`: warn after 3 days
- `notizen`: warn after 5 days
- `entwurf`: warn after 7 days
- `ueberarbeitet`: warn after 14 days

### Imbalance Warning
```
WARNUNG: Kapitel 04 (5,200 Woerter) ist deutlich laenger als Kapitel 06 (800 Woerter).
Verhaeltnis zum Ziel: 104% vs. 27%. Moegliche Unausgewogenheit.
```

Triggers when a chapter exceeds its target by more than 20% while another chapter is below 30%.

### Deadline Warning
```
WARNUNG: 30 Tage bis Deadline. Aktueller Fortschritt: 52%.
Benoetigt: ~400 Woerter/Tag um das Ziel zu erreichen.
Kapitel 06 und 07 sind noch leer.
```

Calculates required daily word count to meet the deadline, factoring in current completion rate.

### Empty Section Warning
```
WARNUNG: Folgende Abschnitte enthalten keinen Inhalt:
- 04-konzept, Section 4.3 (Kommunikationsprotokoll)
- 04-konzept, Section 4.4 (Skill-System)
- 06-evaluation, alle Abschnitte
```

### Orphan Reference Warning
```
WARNUNG: 2 Abbildungen definiert aber nie referenziert:
- fig:bridge-detail (figures/fig-05-bridge-detail.tex)
- fig:timeline-v1 (figures/fig-05-timeline-v1.tex)
```

### Citation Health Warning
```
WARNUNG: 3 Zitate in .bib aber nie verwendet:
- smith2024agents
- brown2023orchestration
- mueller2024thesis

5 Zitate verwendet aber fehlend in .bib:
- \cite{TODO:mcp-spec}
- \cite{TODO:openai-function-calling}
- \cite{langchain2024}
- \cite{autogen2024}
- \cite{dorri2018multiagent}
```

## Update Workflow

### After a Writing Session

1. **Scan** all .tex files for changes (compare modification dates)
2. **Count** words in each modified chapter
3. **Detect** new/resolved TODO markers
4. **Update** `progress.json` with new counts and timestamps
5. **Check** for warning conditions
6. **Report** changes since last update

```bash
# Quick update script concept:
for chapter in thesis/latex/chapters/*.tex; do
    name=$(basename "$chapter" .tex)
    words=$(texcount -total -brief "$chapter" 2>/dev/null | grep -oP '\d+' | head -1)
    todos=$(grep -c "TODO\|FIXME\|\\\\todo{" "$chapter" 2>/dev/null)
    modified=$(stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%S" "$chapter" 2>/dev/null)
    echo "$name: $words words, $todos TODOs, modified $modified"
done
```

### Automatic Status Inference

The tracker can infer chapter status from observable metrics:

- **leer**: word_count < 50
- **notizen**: word_count < (target * 0.3) AND contains TODO markers or bullet lists
- **entwurf**: word_count >= (target * 0.5) AND still has TODO markers
- **ueberarbeitet**: word_count >= (target * 0.8) AND TODO markers < 3
- **final**: word_count >= (target * 0.9) AND TODO markers == 0 AND uncited_claims == 0

These are heuristics. The actual status can be overridden manually.

## Integration with Existing Documentation System

The thesis-tracker connects to the existing documentation infrastructure:

### Session Buffer (`thesis/memory/session_buffer.md`)
- When the session buffer flushes (every 5 entries), the tracker checks if any thesis writing was done
- Maps session activities to chapter progress updates

### Protocol Documents
- Uses chronological protocol dates to track the writing timeline
- Uses thematic protocol to verify that all major themes have corresponding chapter coverage

### Git History
- Can compare `progress.json` across commits to see progress over time
- Tracks which chapters were modified in each commit

## Markdown Summary Output

For quick overviews (e.g., in chat or documentation), generates a compact Markdown summary:

```markdown
## Thesis Progress — 2026-02-22

| Kapitel | Woerter | Ziel | Fortschritt | Status |
|---------|---------|------|-------------|--------|
| 01 Einleitung | 1,200 | 3,000 | 40% | entwurf |
| 02 Verwandte Arbeiten | 800 | 3,000 | 27% | notizen |
| 03 Grundlagen | 2,100 | 4,000 | 53% | entwurf |
| 04 Konzept | 2,500 | 5,000 | 50% | entwurf |
| 05 Implementierung | 1,800 | 5,000 | 36% | notizen |
| 06 Evaluation | 0 | 3,000 | 0% | leer |
| 07 Fazit | 0 | 2,000 | 0% | leer |
| **Gesamt** | **8,400** | **25,000** | **33.6%** | |

**TODOs**: 12 | **Unbelegte Behauptungen**: 5 | **Deadline**: 67 Tage
```

## Rate of Progress Tracking

Beyond snapshots, the tracker monitors writing velocity:

```json
{
  "velocity": {
    "last_7_days": {
      "words_written": 2400,
      "words_per_day": 343,
      "chapters_touched": ["03-grundlagen", "04-konzept"],
      "todos_resolved": 4,
      "todos_added": 2
    },
    "projected_completion": "2026-04-15",
    "on_track": true
  }
}
```

This requires storing historical snapshots. The tracker saves a daily snapshot to `thesis/progress-history/YYYY-MM-DD.json` for trend analysis.

## Quick Commands

Common operations the tracker supports:

- **Status**: Show full progress report
- **Chapter N**: Show detail report for a specific chapter
- **Update**: Rescan all files and refresh progress.json
- **Warnings**: Show all active warnings
- **Velocity**: Show writing speed and projected completion
- **Compare**: Compare current progress to N days ago
- **Summary**: Generate compact Markdown summary
