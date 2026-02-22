# Protokoll — Thematisch

> Dieses Dokument strukturiert alle Arbeitsinhalte nach **Themen und Konzepten**.  
> Automatisch gepflegt vom Thesis-Agenten via `thesis-log` Skill.

---

## 🏗️ Thema: System-Architektur

### Multi-Agent-Orchestrierung
- **Julia** = primärer Orchestrator (Antigravity Framework)
- **OpenClaw** = Kommunikations-Sub-Agent (Channels: WhatsApp, Telegram, Slack)
- **Thesis-Agent** = Dokumentations-Sub-Agent (Forschung, Schreiben, Logging)
- Prinzip: Julia koordiniert, Sub-Agenten besitzen ihre Domäne vollständig

### Architektur-Muster
- **Separation of Concerns**: Jeder Agent hat klar definierte Grenzen (read/write access control)
- **Tool Use**: Agenten agieren über Skills (SKILL.md Dateien) mit klaren Triggern
- **Memory**: Jeder Agent hat eigene MEMORY.md für persistenten Kontext

---

## 🔧 Thema: Backend-Entwicklung

### REST API — Tasks Service
- **Stack**: Node.js 18 · Express · TypeScript · Prisma ORM · PostgreSQL 15 · Docker
- **TDD-Ansatz**: Tests zuerst (Vitest), dann Implementierung
- **API-Design**: RESTful, JSON, stateless
- **Endpunkte**: CRUD für Tasks (`/tasks`)

### Infrastruktur
- Docker Compose orchestriert: API + PostgreSQL-Datenbank
- Prisma Migrations für Schema-Versionierung
- TypeScript für Typsicherheit

---

## 💬 Thema: Kommunikationsschicht (OpenClaw)

### Kanal-Integration
- **Telegram**: Primärer Kanal, Polling-Modus, Bot-Token via Env-Variable
- **Sicherheitsmodell**: dmPolicy `pairing` → unbekannte User bekommen Paarungscode
- `allowFrom` Allowlist für genehmigte User-IDs

### Selbstlern-Mechanismus (AGENTS.md)
- `HEURISTICS.md` speichert generalisierbare Regeln (H-NNN) und Fehler (M-NNN)
- Agent liest Heuristiken vor jeder Aufgabe, schreibt danach seine Erfahrungen
- Drei aktive Heuristiken: `health check first`, `--force recovery sequence`, `write it down`

### Bootstrap & Onboarding
- `BOOTSTRAP.md` = Geburtsmoment des Agenten (noch nicht gelöscht → Onboarding unvollständig)
- `IDENTITY.md` & `USER.md` noch leer — müssen im ersten Telegram-Gespräch befüllt werden
- `HEARTBEAT.md` = leeres Checklisten-System für proaktive Aufgaben (Emails, Kalender)

- Gateway läuft auf `ws://127.0.0.1:18789` (loopback-only)
- Julia delegiert Kommunikationsaufgaben → OpenClaw führt aus → gibt Ergebnis zurück
- OpenClaw ist für Julia eine Black Box (nur Input/Output sichtbar)

---

## 📚 Thema: Dokumentation & Wissensmanagement

### Thesis-Agent System
- **Forschung**: Nur aus `thesis/research_papers/` — Rückverfolgbarkeit gewährleistet
- **Schreiben**: Drafts zuerst → Mensch genehmigt → Dokumentation
- **Protokollierung**: Zeitlich (chronologisch) + Thematisch (konzeptuell)

### Skill-Design-Prinzipien
- SKILL.md mit YAML Frontmatter (name, description, trigger)
- Klare Einschränkungen (was der Agent NICHT tun darf)
- Mandatory Checklists für kritische Operationen

---

## 🔐 Thema: Sicherheit & Zugangskontrolle

### Agent-Grenzen
- Jeder Agent hat `config.yaml` mit `read_only` / `read_write` Regeln
- Sub-Agenten können nicht die Hauptworkspace-Dateien modifizieren
- Secrets nur in `.env.secrets` (nie in Commits)

### OpenClaw-Sicherheit
- Gateway nie außerhalb Loopback ohne Tailscale
- `tools.exec.security: deny` für channel-facing Agents
- Regelmäßige `openclaw security audit`

---

<!-- Neue thematische Abschnitte oder Ergänzungen unten einfügen -->

---

## 🩺 Thema: Empathische KI & Palliativbegleitung

### Wish Companion — Konzept
- Julia bekommt eine spezialisierte Fähigkeitsschicht für Menschen mit terminaler Erkrankung
- Basiert auf Palliativforschung: SUPPORT-Studie, Dignity Therapy, Atul Gawande, Five Wishes Framework
- Kernbefund der Forschung: Sterbende wünschen sich vor allem **Zeuge sein** (gehört werden), **Vermächtnis** hinterlassen, und **Gesagtes sagen**

### Die 5 erfüllbaren Wünsche
Definiert durch das Kriterium: Kann Julia das mit ihren bestehenden Fähigkeiten tatsächlich tun?

| # | Wunsch | Julias Rolle |
|---|--------|-------------|
| 1 | Briefe schreiben | Co-Autorin in der Stimme der Person |
| 2 | Erinnerungen dokumentieren | Interviewerin + Memoir-Schreiberin |
| 3 | Einfach da sein | Zeugin ohne Agenda |
| 4 | Legacy-Box aufbauen | Strukturierte Lebensdokumentation |
| 5 | Lebende Feier planen | Veranstaltungsplanerin + Redenschreiberin |

### Architektonische Entscheidung: Skills vs. System-Prompt
- Die Fähigkeit lebt in SKILL.md-Dateien (OpenClaw-Ebene), nicht im Orchestrator-Prompt
- Vorteil: Modularität — die Fähigkeit kann unabhängig aktualisiert werden
- Skill `dying-wishes` = Forschungsschicht (Warum und Was)
- Skill `wish-fulfillment` = Handlungsschicht (Wie und Wann)

### Ethische Prinzipien im Design
- **Nie aufdrängen**: Aktivierung nur durch Gesprächssignale der Person
- **Nie minimieren**: Kein "bleib positiv", kein "es wird gut"
- **Nie eilen**: Kein Produktivitätsdenken — diese Arbeit ist heilig
- **Immer in der Stimme der Person**: Briefe/Memoiren spiegeln sie, nicht Julia

### Bedeutung für die Masterarbeit
- Zeigt wie KI-Agenten ethisch für vulnerable Zielgruppen gestaltet werden können
- Beispiel für research-grounded skill design (kein Raten — alle Wünsche aus Literatur abgeleitet)
- Demonstriert den Unterschied zwischen task-completing AI und presence-offering AI

---

## 🤖 Thema: Agentic Tool Use & Aktionsfähigkeit

### OpenAI Function Calling in Julia
- Julia (Orchestrator) wurde mit OpenAI Tool Calling ausgestattet — erster Schritt von reaktivem Chat-Agent zu aktivem Handlungsagenten.
- Architektur-Muster: Tool-Use-Loop intern in `generateReply()`, Aufrufer (`index.ts`) unverändert.
- Erstes Tool: `send_email` — sendet über OpenClaw's `email_send.py` Skript via SMTP + 1Password-Credentials.
- Erweiterbar: Neue Tools nur in `tools.ts` hinzufügen, Loop-Logik und Orchestrator bleiben unberührt.

### Diagnose: Gap zwischen Fähigkeitsanspruch und Realität
- System-Prompt sagte "If you can't do something, say so clearly" — keine Tools = kein Handeln.
- Fehler: Julia antwortete auf "Send an email" mit "I can't send emails directly" obwohl OpenClaw die Infrastruktur hatte.
- Lösung: Tool-Definitionen im System-Prompt bekanntgeben + OpenAI Function Calling aktivieren.

---

## 📋 Thema: Dokumentations-Enforcement & Autonomie

### thesis-autonomy Skill — Enforcement-Problem
- `thesis-autonomy` Skill existiert als Textdatei aber hatte keinen technischen Enforcement-Mechanismus.
- Claude Code (Antigravity) lädt Skills nicht automatisch — ohne MEMORY.md-Eintrag werden Skills vergessen.
- Lösung: Persistente Anweisung in MEMORY.md eingetragen → wird in jede Session automatisch injiziert.

### Zwei-Ebenen-Dokumentationssystem
- **Kurzzeit**: `thesis/memory/session_buffer.md` — Rolling Buffer (5 Einträge → auto-flush)
- **Langzeit**: Drei Protokoll-Dokumente (zeitlich, thematisch, project_log) — permanente Dokumentation
- **Enforcement**: MEMORY.md-Eintrag bei Claude Code; Skill-Datei für detaillierte Anweisungen

---

## 🧹 Thema: Autonome Systemhygiene & Ambient Agents

### ADHD Agent — Konzept
- Agenten produzieren Komplexität (Skills, Duplikate, Bloat) schneller als Menschen sie bereinigen können
- Lösung: Ein dedizierter Ambient Agent überwacht das System kontinuierlich und schlägt Bereinigungen vor
- Kernprinzip: **Erkennen ≠ Handeln** — Agent schlägt vor, Mensch entscheidet

### Architekturmuster: Human-in-the-Loop bei destruktiven Operationen
- Jede vorgeschlagene Änderung geht über Telegram an Raphael (YES/NO/LATER)
- Genehmigte Aktionen landen in `memory/approved_actions.txt` — Antigravity führt aus
- Zweischichtige Sicherheit: Telegram-Genehmigung + Antigravity-Ausführung mit Sichtbarkeit

### Technisches Muster: Bridge-Aware Polling
- Problem: Zwei Prozesse (ADHD Agent + OpenClaw) können nicht beide `getUpdates` pollen — sie stehlen sich gegenseitig Nachrichten
- Lösung: ADHD Agent sendet via Bot API, empfängt über Bridge REST (`/queues/julia`)
- OpenClaw verarbeitet alle eingehenden Telegram-Nachrichten und leitet sie an die Bridge weiter — ADHD Agent pollt dort
- Dieses Muster zeigt wie Agenten sich über geteilte Infrastruktur koordinieren müssen

### Bedeutung für Masterarbeit
- Zeigt **Eigenverantwortung im Multi-Agent-System**: Kein Mensch kann jeden Agenten dauerhaft beaufsichtigen
- **Ambient Computing**: Agenten, die kontinuierlich im Hintergrund arbeiten ohne explizite Anfragen
- **Trust-by-Design**: System baut Vertrauen durch Transparenz (Telegram-Vorschläge) statt blinde Automatisierung
- Dokumentiert den Unterschied zwischen reaktiven Agenten (warten auf Befehl) und proaktiven Agenten (beobachten, vorschlagen)

---

## 📐 Thema: Skill-Design & Planung (adhd-focus)

### Silver Lining als Planungsinstrument
- Jede Session beginnt mit einer Pflichtfrage: "Was ermöglicht dieser Task wenn er gelingt?"
- Ergebnis: ein Silver Lining-Satz — "Wir tun X damit Y Z kann, weil W"
- Verhindert lokale Optimierung auf Kosten des Gesamtsystems

### 5-Schritt-Ritual
1. **Zoom Out**: 5-Whys, First Principles oder Outcome Mapping
2. **Problem Map**: Bekanntes, Annahmen, Unbekanntes, Risiken, Julia-Implikationen
3. **Silver Lining**: Ein Satz, der als Maßstab für alle Entscheidungen gilt
4. **Sessionplan**: Scope (IN/OUT), Schritte, Done-When, Risiken
5. **Julia Sync**: Bridge-Status, beteiligte Agenten, Kontext-Übergabe

### Bedeutung für Masterarbeit
- Strukturiertes Denken als Vorbedingung für agentenbasiertes Handeln
- Zeigt wie Agenten nicht nur ausführen, sondern auch planen müssen

---

## 🤝 Thema: Multi-Modell-Orchestrierung & MCP-Integration

### Cowork MCP — Claude als Peer-Agent

- Julia wurde bisher als **Single-Model-System** betrieben (GPT-4o als einziges KI-Modell)
- Mit `cowork-mcp` wird Julia zum **Multi-Modell-System**: Orchestrator kann Aufgaben gezielt an Claude (Anthropic) oder GPT-4o (OpenAI) delegieren
- Architekturmuster: **Capability Routing** — Jedes Modell hat Stärken (Claude: Multimodal/Vision, Code Review; GPT-4o: Primär-Loop/Conversation)

### MCP als Integrationslayer

- **MCP (Model Context Protocol)** als universelles Protokoll: Agenten kommunizieren über Tools, nicht über direkte API-Aufrufe
- `cowork-mcp` exposes Claude als 6 typisierte Tools — jeder Agent im System kann Claude nutzen ohne die Anthropic API direkt zu kennen
- Stateless Transport: Jeder Request erzeugt einen neuen Transport — keine Session-Affinity-Probleme, horizontal skalierbar
- Transport-Typ: Streamable HTTP (Port 3003) — konsistent mit dem bestehenden Bridge-Pattern (Port 3001)

### Tool-Design-Prinzipien im cowork-mcp

| Tool | Stärke | Einsatzbeispiel |
|---|---|---|
| `claude_task` | Allgemein: Reasoning, Schreiben, Analyse | Julia delegiert komplexe Schreibaufgaben |
| `claude_multimodal_task` | Vision: Bilder + Text | Screenshot-Analyse, OCR, Diagramm-Interpretation |
| `claude_code_review` | Strukturiert: Severity-Ratings | Automatisches Code-Review in CI-Workflows |
| `claude_summarize` | Effizient: Kontextreduktion | Lange Logs / Dokumente vor Weiterverarbeitung kürzen |
| `claude_brainstorm` | Kreativ: Ideengenerierung | Planung neuer Features oder Lösungsansätze |
| `cowork_status` | Betrieb: Health Check | Erreichbarkeit des Sub-Agenten prüfen |

### Fehlerresilienz im Multi-Agent-System

- `cowork-mcp` gibt bei API-Fehler (Rate Limit, Billing, Timeout) immer einen sauberen Textstring zurück — kein uncaught Exception
- Orchestrator und Sub-Agent sind **entkoppelt**: Fehler im Sub-Agent crashen nicht den Hauptloop
- `CHARACTER_LIMIT = 25'000` Zeichen: Schutz für nachgelagerte Kontextfenster (GPT-4o, Claude)

### Bedeutung für die Masterarbeit

- Zeigt praktisch wie **Modell-Heterogenität** in Multi-Agent-Systemen implementiert wird
- **MCP als Abstraktionslayer**: Tools abstrahieren Modell-Details — der Orchestrator kennt kein SDK, nur Toolnamen
- **Testbarkeit durch Separation**: `cowork-mcp` kann isoliert getestet werden (wie demonstriert: `test.mjs`)
- Dokumentiert den Unterschied zwischen **Tight Coupling** (direkte API-Calls) und **Loose Coupling** (MCP-Tools mit Fehlerkapselung)

---

## 🖥️ Thema: Frontend-Chatbot & Streaming-Architektur

### Architekturwandel: Polling → Streaming

- **Vorher**: Frontend-Chat pollte Bridge alle 3s → Telegram-Muster (langsam, ~8-15s Roundtrip, kein Streaming)
- **Nachher**: Eigener `/api/chat`-Endpunkt im Frontend mit Vercel AI SDK → direkte SSE-Verbindung zu GPT-4o
- **Zwei unabhängige Pfade**: Web (Dashboard → `/api/chat` → GPT-4o) / Telegram (OpenClaw → Bridge → Julia)
- Bridge bleibt als Telegram-Relay — Dashboard pollt sie nicht mehr

### Vercel AI SDK v5 — Technische Muster

| Komponente | Funktion |
|---|---|
| `streamText()` | Serverseitig: Stream von GPT-4o, Tool-Ausführung, SSE-Response |
| `useChat()` | Clientseitig: React Hook für Nachrichtenzustand, Streaming-Darstellung |
| `DefaultChatTransport` | Konfiguriert API-Endpunkt für den Chat-Hook |
| `convertToModelMessages()` | Konvertiert UI-Format (`parts[]`) in Modell-Format |
| `stopWhen: stepCountIs(5)` | Begrenzt Tool-Use-Iterationen |

### Modellstrategie — Capability Routing nach Oberfläche

| Oberfläche | Modell | Warum |
|---|---|---|
| Frontend-Chatbot | GPT-4o | Reasoning-Tiefe, Streaming, funktioniert mit aktuellem API-Key |
| Orchestrator/Telegram | Claude Haiku 4.5 | Schnell, günstig, Tool-Calling ausreichend |
| Cowork-MCP | Claude Haiku 4.5 | Sub-Agent für delegierte Aufgaben |

### Agent-Selbstwissen als Designprinzip

- Tool-Beschreibungen SIND das Selbstwissen des Agenten über seine Fähigkeiten
- Unvollständige Beschreibung → Agent konfabuliert (behauptet fälschlicherweise, etwas nicht zu nutzen)
- Kein Lügen — sondern falsches internes Modell durch fehlende Information
- Lösung: Mechanismus-Details (z.B. 1Password, `op run`) in Tool-Beschreibungen aufnehmen

### Persistenz, Modellauswahl & Best Practices (Session 22)

- **localStorage-Persistenz**: Nachrichten überleben Seitenaktualisierung und Orb-Toggle
- **Always-mount-Muster**: ChatWindow wird immer gerendert (CSS-Visibility-Toggle statt bedingtem Rendering) — useChat-Hook-Zustand bleibt erhalten
- **Modellselektor**: GPT-4o / Claude Sonnet auswählbar im UI, Multi-Model-Backend mit `getModel()` Registry
- **Kontextanzeige**: Prozentindikator zeigt Auslastung des Kontextfensters
- **10 Best Practices** als TODO-Kommentare dokumentiert — Produktionsreife-Checkliste

### Bedeutung für die Masterarbeit

- Zeigt Evolution von **synchronem Polling** zu **asynchronem Streaming** in Multi-Agent-Frontends
- **Surface-spezifische Modellwahl**: Nicht ein Modell für alles, sondern das beste Modell pro Anwendungsfall
- Demonstriert Integration moderner AI SDK Patterns (Vercel AI SDK v5) in bestehendes Multi-Agent-System
- Agent-Selbstwissen als neuartiges Designkonzept: Was ein Agent über sich selbst weiss, bestimmt die Qualität seiner Selbstauskünfte

---

## 🧹 Thema: Projektstruktur & Dokumentationshygiene

### Strukturbereinigung (Session 17)
- Vollständiger Audit der Projektstruktur auf Auffindbarkeit für Menschen und KI-Agenten
- 16 verwaiste Dateien gelöscht: Logs, veraltete Skripte, `dashboard/`-Prototyp, redundante PM2-Configs
- Fehlende READMEs (Orchestrator, Frontend), Agent Cards (`adhd_agent`, `julia_medium`), `.env.example` erstellt
- Root README korrigiert (Komponentenanzahl 4→7), .gitignore aktualisiert
- Prinzip: Projektstruktur muss sowohl für menschliche als auch KI-Nutzer navigierbar sein

---

## 🖥️ Thema: Frontend-Identität & Agent-Namensgebung

### JuliaFrontEnd — Identitätstrennung (Session 18)
- Problem: Frontend-Chatbot und Orchestrator-Julia hiessen beide "Julia" — Verwechslungsgefahr
- Lösung: UI-Labels umbenannt zu "JuliaFrontEnd" (Header, Rollenbezeichnung, Denk-Indikator, Platzhalter)
- System-Prompt neugeschrieben: projektbewusst — erklärt Architektur, Tools, Telegram-Pendant
- Designentscheidung: Chatbot nennt sich in Konversation weiterhin "Julia" — Trennung nur auf UI-Chrome-Ebene
- Bedeutung: Zeigt wie Agent-Identität in Multi-Agent-Systemen explizit verwaltet werden muss

---

## 🔄 Thema: Selbstmodifikation & DevOps-Automatisierung

### /dev Slash Command — Julias Selbstmodifikationsfähigkeit (Sessions 19–21)
- **Iteration 1 (Session 19)**: `/dev <instruction>` implementiert — spawnt Claude Code CLI (`claude -p`) asynchron
  - Auth: nur Raphaels chatId, Mutex (eine Aufgabe gleichzeitig), 15-Min-Timeout
  - `/dev-status` zur Überwachung; Architektur: Telegram → Bridge → Orchestrator → Claude Code → Ergebnis
- **Code Review (Session 20)**: `dev-runner.ts` geprüft — Sicherheitsschichten bestätigt
- **Iteration 2 (Session 21)**: Claude Code CLI durch Git-Pull-and-Restart ersetzt
  - Neuer Workflow: Code auf Handy bearbeiten (Claude App) → push → `/dev` via Telegram → Orchestrator pullt, installiert, startet neu
  - `spawnSync` für Shell-Befehle, detachter `spawn` für `pm2 restart all` (überlebt Self-Kill)
  - Schlüsselerkenntnis: Erfolg melden BEVOR Neustart — Race-Condition-bewusstes Design

### Architektonische Erkenntnisse
- Claude Code CLI als Ausführungsschicht war fragil (Pfad-Abhängigkeiten, CLI-Version)
- Git-Pull-Deploy ist robuster: funktioniert vom Handy, keine lokalen CLI-Abhängigkeiten
- Selbstmodifikation erfordert explizite Behandlung des "Orchestrator startet sich selbst neu"-Problems

### Bedeutung für die Masterarbeit
- Zeigt evolutionären Designprozess: Erste Lösung verworfen, einfachere Lösung gefunden
- Self-modifying agents als Forschungsthema: Wie gibt man einem Agenten die Fähigkeit, sich selbst zu aktualisieren?
- Race-Condition bei Selbst-Neustart als konkretes technisches Problem dokumentiert

---

## 📝 Thema: Schreiber Agent & Thesis-Automatisierung

### Skill-Architektur (Sessions 23–24)

Der Schreiber (Master Thesis Agent) wurde mit 10 spezialisierten SKILL.md-Dateien ausgestattet, aufgeteilt in zwei Chargen:

**Core-Skills (Batch 1)**:
| Skill | Funktion |
|---|---|
| `thesis-structure` | Kapitelarchitektur, Abschnittsüberschriften, Seitenvorgaben |
| `draft-writer` | Deutsche akademische Prosa, LaTeX-Formatierung, TODO-Marker |
| `research-scout` | Quellen entdecken → `pending-papers.json` |
| `citation-gatekeeper` | Quellen genehmigen → `approved-papers.json` + `references.bib` |
| `code-to-thesis` | Code-Extraktion aus dem Projekt in thesisreife Beschreibungen |

**Erweiterte Skills (Batch 2)**:
| Skill | Funktion |
|---|---|
| `session-synthesizer` | Session-Protokolle → deutsche akademische Prosa (geplant/gebaut/gelernt) |
| `argument-advisor` | 7 Review-Dimensionen, Betreuer-Simulation, Verteidigungsfragen |
| `figure-architect` | TikZ/PGF-Vorlagen: Architektur, Sequenzdiagramme, Timelines |
| `latex-builder` | Mac-Mini-Kompilierung (latexmk/biber), Fehlerbehandlung |
| `thesis-tracker` | `progress.json`-Schema, Kapitelstatus, Warnsystem |

### Zitations-Pipeline — Dreistufiges Genehmigungsverfahren
- **Entdeckung**: `research-scout` findet Quellen → schreibt in `pending-papers.json`
- **Genehmigung**: `citation-gatekeeper` prüft → verschiebt zu `approved-papers.json` + `references.bib`
- **Verwendung**: `draft-writer` nutzt nur genehmigte Quellen; unbekannte Quellen als `\cite{TODO:topic}`
- Prinzip: Kein Zitat ohne menschliche Genehmigung — verhindert halluzinierte Referenzen

### LaTeX-Skelett & Infrastruktur (Session 25)
- **main.tex**: Deutsches akademisches Setup (BibLaTeX/Biber, fancyhdr, geometry)
- **7 Kapitel-Dateien**: `01-einleitung` bis `07-zusammenfassung` mit Abschnittsüberschriften und TODO-Markern
- **progress.json**: Wortzahl-Tracker mit 25'000-Wörter-Gesamtziel
- **structure.json**: Kapitelübersicht mit Seitenvorgaben

### Master-Prompt als Portabilitäts-Dokument
- `docs/plans/2026-02-22-thesis-agent-design.md` — vollständiger Prompt zur Neuerstellung des Schreibers
- Enthält alle 10 Skills, Setup-Anweisungen, Workflow-Beispiele
- Ermöglicht Reproduktion auf dem Mac Mini ohne Session-Kontext

### Bedeutung für die Masterarbeit
- **Skill-als-Wissen-Muster**: Agenten-Fähigkeiten als formalisierte, modulare Wissensdokumente
- **Human-in-the-Loop-Zitation**: Verhindert das grösste Risiko bei KI-unterstütztem Schreiben (halluzinierte Quellen)
- Betreuer-Simulation als Qualitätssicherung — Agent spielt Gegenposition
- Portabler Master-Prompt als Muster für reproduzierbare Agenten-Konfiguration

---

## 🔀 Thema: Frontend-Technologie-Migration

### Next.js 16 → Vite + React Router + Hono (Session 26)

**Analyse**: 0% SSR-Nutzung, 0 Server Components, nur 6 Next.js-spezifische Imports — Framework-Overhead ohne Nutzen.

**Migration**:
- Next.js 16 ersetzt durch Vite 6 (Build), React Router 7 (Routing), Hono (API-Server)
- Hono `server.ts` kombiniert beide API-Routen: `/api/chat` (Streaming) + `/api/devops` (PM2-Steuerung)
- Alle 9 Komponenten unverändert nach `src/` verschoben — nur `next/link` → `react-router Link` in 2 Dateien

**Ergebnis**:
| Metrik | Next.js | Vite + Hono |
|---|---|---|
| Build-Zeit | ~15-30s | 2.1s |
| Dev-Server-Start | mehrere Sekunden | 133ms |
| Framework-Fehler (EISDIR etc.) | häufig | eliminiert |

### Entscheidungen
- Vite + React Router + Hono als leichtgewichtige Alternative — kein SSR/SSG-Overhead für ein reines SPA
- Hono als API-Layer: leichtgewichtig, Express-kompatibel, TypeScript-first
- Migration bestätigt Prinzip: Framework-Wahl anhand tatsächlicher Nutzung, nicht theoretischer Features

### Bedeutung für die Masterarbeit
- Dokumentiert datengetriebene Technologieentscheidung (Nutzungsanalyse vor Migration)
- Zeigt wie Agenten bei Migrationen helfen: Analyse der Codebasis → Identifikation der tatsächlichen Framework-Nutzung → Migration
- Konkretes Beispiel für "Right-sizing" der Technologie in einem Agentensystem

