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
