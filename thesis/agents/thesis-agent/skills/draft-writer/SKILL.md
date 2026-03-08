---
name: draft-writer
description: Schreibt Erstentwuerfe in deutschem Wissenschaftsstil als LaTeX. Nimmt Notizen, Stichpunkte und Session-Logs als Input und produziert akademische Prosa.
---

# Draft Writer Skill

## Purpose

This skill transforms raw input -- bullet points, verbal notes, session logs, code analysis, scattered thoughts -- into polished first drafts written in Wissenschaftsdeutsch (German academic prose), formatted as LaTeX ready for `\input{}` inclusion. It is the primary writing engine of the Schreiber agent.

## Input Formats

The draft writer accepts any of the following as input material:

- **Bullet points**: Unstructured lists of ideas or facts
- **Session logs**: Entries from `thesis/memory/session_buffer.md` or protocol files
- **Code analysis**: Output from the code-to-thesis skill (architecture descriptions, code snippets)
- **Verbal descriptions**: Informal German or English explanations of concepts
- **Research summaries**: Paper summaries from the research-scout skill
- **Existing drafts**: Earlier versions that need rewriting or expansion
- **Mixed language**: German and English input is accepted; output is always German

## Output Format

All output is LaTeX source code, structured as follows:

```latex
% =============================================================================
% Section: [Section Title]
% Chapter: [Chapter ID, e.g., 04-konzept]
% Draft version: 1
% Date: 2026-02-22
% Status: DRAFT — Requires human review
% =============================================================================

\section{Kommunikationsarchitektur}
\label{sec:kommunikationsarchitektur}

Das juliaz\_agents-System verwendet eine nachrichtenbasierte Architektur,
in der die einzelnen Agenten ueber ein zentrales Bridge-Modul kommunizieren.
Die Kommunikation basiert auf dem Model Context Protocol (MCP), welches
in \cref{sec:mcp-grundlagen} eingefuehrt wurde.

% TODO: verify — ist WebSocket die einzige Transportschicht?
Die Bridge-Komponente stellt eine WebSocket-Verbindung bereit, ueber die
saemtliche Nachrichten zwischen Orchestrator und Sub-Agenten weitergeleitet
werden.

\cite{TODO:mcp-specification}
```

## German Academic Writing Rules

### Voice and Tense

| Context | Rule | Example |
|---------|------|---------|
| Indirect speech (citing others) | Konjunktiv I | "Mueller zeige, dass Multi-Agenten-Systeme..." |
| Describing methods | Passiv | "Es wurde ein System implementiert, das..." |
| Established facts | Praesens | "Das System besteht aus sechs Komponenten." |
| General claims | Impersonal construction | "Es laesst sich feststellen, dass..." |
| Describing past work | Praeteritum | "Die Architektur wurde in drei Iterationen entwickelt." |

### Person and Perspective

- **NEVER** use first person ("ich", "wir", "mein")
- Use "der Autor" when self-reference is unavoidable: "Der Autor entschied sich fuer TypeScript aufgrund..."
- Prefer passive constructions: "Es wurde entschieden..." over "Der Autor entschied..."
- For the thesis itself: "In der vorliegenden Arbeit wird..." or "Diese Arbeit untersucht..."

### Hedging and Precision

- Use hedging for claims that are not fully proven:
  - "Es deutet darauf hin, dass..."
  - "Dies legt nahe, dass..."
  - "Moeglicherweise laesst sich..."
- Use strong language only for well-supported statements:
  - "Die Ergebnisse zeigen eindeutig, dass..."
  - "Es steht fest, dass..."
- Quantify where possible: "in fuenf von sechs Faellen" instead of "meistens"

### Sentence Structure

- Prefer clear, structured sentences over long nested constructions
- Use connectors for logical flow:
  - Causal: "da", "weil", "aufgrund dessen"
  - Contrastive: "jedoch", "dennoch", "im Gegensatz dazu"
  - Additive: "darueber hinaus", "ferner", "zusaetzlich"
  - Sequential: "zunaechst", "anschliessend", "abschliessend"
- Place the verb correctly in subordinate clauses (German V2/V-final rules)
- Maintain consistent terminology throughout — do not use synonyms for technical terms

### Terminology Consistency

The draft writer maintains awareness of the project glossary. Key terms and their consistent German translations:

| English Term | German Term (used in thesis) |
|-------------|----------------------------|
| Multi-agent system | Multi-Agenten-System |
| Orchestrator | Orchestrator (not translated) |
| Tool calling | Tool Calling / Werkzeugaufruf |
| Sub-agent | Sub-Agent |
| Gateway | Gateway (not translated) |
| Skill | Skill (not translated, in agent context) |
| Bridge | Bridge (not translated) |
| Prompt engineering | Prompt Engineering (not translated) |
| Model Context Protocol | Model Context Protocol (MCP) |

When a term appears for the first time, introduce it with the English original: "das sogenannte Tool Calling (Werkzeugaufruf), also die Faehigkeit eines LLM, externe Funktionen aufzurufen"

## Citation Handling

### The Cardinal Rule

**NEVER invent citations.** The draft writer does not have access to the bibliography and must not pretend it does.

### Placeholder Citations

When a claim requires a source, insert a placeholder:

```latex
% Claim needing a citation:
Multi-Agenten-Systeme wurden erstmals in den 1980er Jahren formalisiert \cite{TODO:mas-history}.

% Specific paper known but not yet approved:
Das MCP-Protokoll definiert einen standardisierten Kommunikationskanal
zwischen LLM und Werkzeugen \cite{TODO:mcp-anthropic-2024}.
```

### Citation Context Comments

Add a comment explaining what kind of source is needed:

```latex
% TODO: cite — need foundational MAS paper, preferably Wooldridge or Jennings
Die Koordination autonomer Agenten erfordert sowohl Kommunikationsprotokolle
als auch gemeinsame Wissensrepresentationen \cite{TODO:mas-coordination}.
```

## Cross-Referencing

Use `\label{}` and `\cref{}` (from the cleveref package) consistently:

```latex
% Setting a label
\section{Architekturuebersicht}
\label{sec:architekturuebersicht}

% Referencing it
Wie in \cref{sec:architekturuebersicht} dargestellt, besteht das System
aus sechs Hauptkomponenten.

% For figures and listings
\begin{figure}[htbp]
  \centering
  \includegraphics[width=\textwidth]{images/architecture.pdf}
  \caption{Architekturuebersicht des juliaz\_agents-Systems}
  \label{fig:architektur}
\end{figure}

% Reference:
\cref{fig:architektur} zeigt die Gesamtarchitektur des Systems.
```

### Label Conventions

| Type | Prefix | Example |
|------|--------|---------|
| Chapter | `ch:` | `\label{ch:konzept}` |
| Section | `sec:` | `\label{sec:tool-calling}` |
| Figure | `fig:` | `\label{fig:architektur}` |
| Table | `tab:` | `\label{tab:vergleich}` |
| Listing | `lst:` | `\label{lst:bridge-code}` |
| Equation | `eq:` | `\label{eq:latenz}` |

## Uncertainty Markers

The draft writer explicitly marks anything that is uncertain, incomplete, or needs verification:

```latex
% TODO: verify — is this number accurate?
% TODO: expand — this paragraph needs more detail
% TODO: source — claim needs citation
% TODO: rephrase — awkward German, needs native review
% TODO: merge — overlaps with section X
```

## Scope and Boundaries

### What this skill DOES:
- Write section-level drafts (one `\section{}` or `\subsection{}` at a time)
- Transform unstructured input into structured academic prose
- Apply consistent formatting, voice, and terminology
- Insert appropriate placeholders for citations and cross-references
- Mark uncertainty and incompleteness explicitly

### What this skill does NOT do:
- Write entire chapters at once (too large, too error-prone)
- Add entries to `references.bib` (that is citation-gatekeeper's job)
- Modify the thesis structure (that is thesis-structure's job)
- Read source code directly (that is code-to-thesis's job; draft-writer uses its output)
- Make claims about papers it has not seen (research-scout provides summaries)

## Workflow

1. Receive input material and target section (e.g., "Write section 4.2 about the MCP bridge based on these notes")
2. Check with thesis-structure which chapter/section this belongs to
3. Review existing content in adjacent sections for consistency
4. Write the draft in LaTeX, following all rules above
5. Add the draft header comment block with metadata
6. Mark all uncertainties with TODO comments
7. Present the draft to the human for review
