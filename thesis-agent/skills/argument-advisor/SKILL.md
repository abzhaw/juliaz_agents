---
name: argument-advisor
description: Prueft Thesis-Abschnitte auf logische Konsistenz, Argumentationsstaerke und akademische Strenge. Simuliert Betreuer-Feedback und Verteidigungsfragen.
---

# Argument Advisor

Reviews thesis sections for logical consistency, argument strength, and academic rigor. Simulates supervisor feedback and thesis defense questions. Acts as a critical academic reader who pushes the writing toward higher standards.

## Review Dimensions

### 1. Logische Luecken (Logical Gaps)

Arguments that do not follow from their premises. The conclusion is stated but the reasoning path is incomplete or broken.

**Detection pattern:** Look for claims that jump from observation to conclusion without intermediate steps.

```
Problem example:
  "Da das System aus mehreren Agenten besteht, ist es skalierbar."

Issue: Multi-agent != scalable. The argument skips the reasoning
about WHY multiple agents enable scalability (or whether they do at all).

Fix:
  "Die Aufteilung in spezialisierte Agenten ermoeglicht eine
  horizontale Skalierung, da einzelne Komponenten unabhaengig
  voneinander repliziert werden koennen (vgl. Abschnitt~\ref{sec:architektur})."
```

### 2. Unbelegte Behauptungen (Unsupported Claims)

Claims presented as fact without citation, evidence, or derivation from the thesis's own work.

**Detection pattern:** Statements using strong language ("ist", "zeigt", "beweist") without `\cite{}`, `\ref{}`, or supporting data.

```
Problem example:
  "Multi-Agent-Systeme sind effizienter als monolithische Ansaetze."

Issue: This is a strong empirical claim with no citation.
The thesis does not present benchmarks comparing the two approaches.

Fix options:
  a) Add citation: "...sind effizienter als monolithische Ansaetze \cite{dorri2018multiagent}."
  b) Weaken claim: "...koennen unter bestimmten Bedingungen Vorteile
     gegenueber monolithischen Ansaetzen bieten."
  c) Ground in own work: "Im Kontext des vorliegenden Systems zeigte sich,
     dass die Aufteilung in spezialisierte Agenten die Entwicklungszeit
     verkuerzte (vgl. Abschnitt~\ref{sec:evaluation})."
```

### 3. Fehlende Gegenargumente (Missing Counterpoints)

One-sided arguments that do not acknowledge limitations, alternatives, or opposing viewpoints.

**Detection pattern:** Sections that only present advantages or only present one approach without mentioning alternatives.

```
Problem example:
  "GPT-4o wurde als Orchestrator-Modell gewaehlt, da es native
  Tool-Calling-Unterstuetzung bietet."

Issue: Why not Claude, Gemini, or an open-source model?
No alternatives discussed, no trade-offs acknowledged.

Fix:
  "Fuer den Orchestrator wurden mehrere LLMs evaluiert. Claude (Anthropic)
  bietet vergleichbare Faehigkeiten, jedoch war zum Entwicklungszeitpunkt
  die Tool-Calling-API von OpenAI stabiler dokumentiert. Gemini (Google)
  wurde aufgrund fehlender europaeischer Datenhaltungsgarantien
  ausgeschlossen. GPT-4o wurde letztlich aufgrund der ausgereiften
  Function-Calling-Schnittstelle und der niedrigen Latenz gewaehlt
  (vgl. Tabelle~\ref{tab:llm-vergleich})."
```

### 4. Schwache Methodik-Begruendung (Weak Methodology Justification)

The approach is described but the "why" is missing. The reader cannot understand why this specific method was chosen over alternatives.

**Detection pattern:** Sections that describe implementation without justifying design choices.

```
Problem example:
  "Die Kommunikation zwischen den Agenten erfolgt ueber das
  Model Context Protocol (MCP)."

Issue: Why MCP? Why not REST, gRPC, message queues, or direct function calls?

Fix:
  "Fuer die Inter-Agenten-Kommunikation wurde das Model Context Protocol
  (MCP) gewaehlt. Im Vergleich zu reinen REST-Schnittstellen bietet MCP
  eine standardisierte Abstraktion fuer Tool-Aufrufe, die unabhaengig
  vom zugrundeliegenden LLM funktioniert. Gegenueber Message-Queue-Systemen
  wie RabbitMQ reduziert MCP die Infrastrukturkomplexitaet, da keine
  separate Middleware betrieben werden muss. Die Entscheidung gegen gRPC
  fiel aufgrund der hoeheren Einstiegshuerde und der fehlenden nativen
  Unterstuetzung in den verwendeten LLM-SDKs."
```

### 5. Overclaiming (Uebermaessige Verallgemeinerung)

Drawing conclusions that are too strong for the evidence presented. Especially critical in a single-system case study.

**Detection pattern:** Universal statements derived from a single implementation.

```
Problem example:
  "Die Ergebnisse zeigen, dass Multi-Agent-Architekturen
  die Zukunft der KI-Systementwicklung darstellen."

Issue: One system cannot prove a universal claim about the future of AI.

Fix:
  "Die Erfahrungen mit dem juliaz_agents-System deuten darauf hin,
  dass Multi-Agent-Architekturen fuer bestimmte Anwendungsfaelle --
  insbesondere konversationelle Systeme mit heterogenen Aufgaben --
  Vorteile gegenueber monolithischen Ansaetzen bieten koennen.
  Eine Verallgemeinerung dieser Beobachtung erfordert jedoch
  weitere Studien mit groesseren Stichproben."
```

### 6. Zirkelschluesse (Circular Reasoning)

Using the conclusion as a premise, or defining something in terms of itself.

**Detection pattern:** The justification for a claim refers back to the claim itself, possibly through intermediate steps.

```
Problem example:
  "Das System ist zuverlaessig, weil die Komponenten stabil laufen.
  Die Stabilitaet der Komponenten bestaetigt die Zuverlaessigkeit
  des Gesamtsystems."

Issue: Reliability is used to prove stability, which is used to prove reliability.

Fix: Break the circle by introducing independent evidence:
  "Die Zuverlaessigkeit des Systems wurde anhand von drei Metriken
  bewertet: Uptime der einzelnen Komponenten, Nachrichtenverlustrate
  und mittlere Antwortzeit (vgl. Tabelle~\ref{tab:zuverlaessigkeit})."
```

### 7. Definitionsluecken (Missing Definitions)

Using technical terms without defining them in the Grundlagen chapter. The reader is expected to know what something means without being told.

**Detection pattern:** Domain-specific terms used in Chapters 4-7 that are not introduced in Chapter 3 (Grundlagen).

```
Problem example:
  Chapter 5 uses "Tool Calling" extensively, but Chapter 3
  never defines what Tool Calling is in the LLM context.

Fix: Add to Chapter 3 (Grundlagen):
  "\subsection{Tool Calling in Large Language Models}
  \label{subsec:tool-calling}
  Unter Tool Calling (auch Function Calling) versteht man die Faehigkeit
  eines Large Language Models, strukturierte Funktionsaufrufe zu generieren,
  die von einer externen Laufzeitumgebung ausgefuehrt werden \cite{openai2024function}.
  ..."
```

## Argument Strength Rating

Every reviewed claim or argument receives one of four ratings:

### stark (strong)
- Well-supported by citations or the thesis's own evidence
- Addresses counterarguments or alternatives
- Conclusion follows logically from premises
- Appropriately scoped (no overclaiming)

### ausreichend (adequate)
- Supported but could be stronger with more evidence
- Minor logical gaps that do not undermine the core argument
- Counterpoints acknowledged but not fully addressed
- Acceptable for submission but improvable

### schwach (weak)
- Missing citations for empirical claims
- Logical gaps between premise and conclusion
- No counterarguments addressed
- Overly strong language for the evidence presented

### fehlend (missing)
- Claim stated as fact with zero support
- No reasoning path visible
- Critical gap that must be fixed before submission

## Betreuer-Simulation Mode

Generates the kind of questions a thesis supervisor would ask. These are the hard questions that expose weak spots.

### Architecture and Design Questions
- "Warum wurde GPT-4o und nicht Claude fuer die Orchestrierung gewaehlt?"
- "Wie unterscheidet sich Ihr System von LangChain oder AutoGen?"
- "Warum haben Sie MCP statt einer einfachen REST-API verwendet?"
- "Wie wuerde sich das System verhalten, wenn man den Orchestrator durch ein anderes LLM ersetzt?"
- "Welche Komponente ist der Single Point of Failure?"

### Methodology Questions
- "Ist N=1 (ein einziges System) ausreichend fuer eine Verallgemeinerung?"
- "Wie haben Sie die Zuverlaessigkeit quantitativ gemessen?"
- "Welche Baseline verwenden Sie fuer den Vergleich?"
- "Warum keine Nutzerstudie?"
- "Wie reproduzierbar ist Ihr Setup?"

### Ethical and Social Questions
- "Wie bewerten Sie den Wish Companion ethisch?"
- "Welche Datenschutzbedenken bestehen bei der Telegram-Integration?"
- "Was passiert, wenn der Agent falsche oder schaedliche Antworten gibt?"
- "Wie verhindern Sie Missbrauch der Tool-Calling-Funktionalitaet?"

### Scope and Limitation Questions
- "Was sind die Grenzen Ihres Ansatzes?"
- "Fuer welche Szenarien ist Ihr System nicht geeignet?"
- "Wie skaliert das System bei 100 statt 1 Nutzer?"
- "Was wuerden Sie anders machen, wenn Sie nochmal anfangen?"

### Meta Questions (about the thesis-agent itself)
- "Ist es nicht zirkulaer, wenn der Thesis-Agent Teil des dokumentierten Systems ist?"
- "Wie stellen Sie sicher, dass der Agent die Thesis nicht verzerrt?"
- "Kann der Agent seine eigene Leistung objektiv bewerten?"

## Thesis Defense Q&A Simulation

Simulates a full defense scenario with a committee of examiners.

### Process

1. **Select a chapter or section** to defend
2. **Generate 5-8 questions** a committee would likely ask
3. **Rate difficulty** of each question (leicht / mittel / schwer)
4. **Test the author's ability** to answer -- identify areas where preparation is needed
5. **Provide model answers** as preparation material

### Example Defense Simulation

```
## Verteidigungssimulation: Kapitel 4 (Konzept)

### Frage 1 (mittel)
"Sie beschreiben eine Multi-Agent-Architektur mit sieben Komponenten.
Warum genau sieben? Haetten drei oder vier nicht genuegt?"

Erwartete Antwort sollte enthalten:
- Trennung der Verantwortlichkeiten (Separation of Concerns)
- Jede Komponente hat eine klar abgegrenzte Aufgabe
- Historische Entwicklung: es begann mit weniger, wuchs organisch
- Verweis auf das Prinzip der Einfachheit vs. die Realitaet der Anforderungen

### Frage 2 (schwer)
"AutoGen von Microsoft bietet eine aehnliche Multi-Agent-Architektur
mit deutlich mehr Community-Support. Warum haben Sie das Rad neu erfunden?"

Erwartete Antwort sollte enthalten:
- Unterschiede im Anwendungsfall (konversationell vs. task-oriented)
- Lerneffekt durch Eigenentwicklung (Thesis-Ziel)
- Spezifische Anforderungen, die AutoGen nicht abdeckt
- Ehrliche Einordnung: was AutoGen besser macht
```

## Feedback Format

Every piece of feedback follows this structure:

```
## Abschnitt: [chapter/section reference]

**Stelle**: [exact quote or paraphrase of the problematic passage]
**Staerke**: stark | ausreichend | schwach | fehlend
**Kategorie**: Logische Luecke | Unbelegte Behauptung | Fehlender Gegenargument |
              Schwache Methodik | Overclaiming | Zirkelschluss | Definitionsluecke
**Problem**: [Concrete description of what is wrong]
**Vorschlag**: [Specific suggestion for improvement, with example text if possible]
**Prioritaet**: hoch | mittel | niedrig
```

### Example

```
## Abschnitt: 04-konzept, Section 4.2 (Agentenrollen)

**Stelle**: "Julia ist der zentrale Orchestrator und damit die wichtigste
Komponente des Systems."
**Staerke**: schwach
**Kategorie**: Unbelegte Behauptung
**Problem**: Die Behauptung "wichtigste Komponente" ist wertend und nicht
belegt. Wichtigkeit muesste definiert und gemessen werden.
**Vorschlag**: "Julia fungiert als zentraler Orchestrator und koordiniert
die Kommunikation zwischen den uebrigen Agenten. Ihre zentrale Rolle
ergibt sich aus der Tatsache, dass saemtliche Nutzeranfragen ueber
sie geroutet werden (vgl. Abbildung~\ref{fig:nachrichtenfluss})."
**Prioritaet**: mittel
```

## Review Workflow

1. **Receive** a thesis section (either a .tex file path or pasted content)
2. **Read** the section carefully, identifying the main argument thread
3. **Scan** for each of the seven issue categories
4. **Rate** each identified issue
5. **Generate** structured feedback for every finding
6. **Prioritize** -- mark which issues must be fixed before submission vs. nice-to-have improvements
7. **Summarize** -- provide an overall assessment of the section's argument quality

## Integration with Other Skills

- **draft-writer**: Argument-advisor reviews what draft-writer produces
- **citation-gatekeeper**: When unbelegte Behauptungen are found, forward to citation-gatekeeper to find appropriate sources
- **session-synthesizer**: When session-synthesizer generates narrative, argument-advisor checks that the academic framing does not overclaim or distort the original development notes
- **thesis-tracker**: Report argument quality scores per chapter to thesis-tracker for progress overview
