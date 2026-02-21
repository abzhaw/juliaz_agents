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
