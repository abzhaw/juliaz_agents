# Protokoll — Zeitlich (Chronologisch)

> Dieses Dokument protokolliert alle Arbeitssitzungen zwischen Benutzer und Julia (AI-Agentin) in **chronologischer Reihenfolge**.  
> Automatisch gepflegt vom Thesis-Agenten via `thesis-log` Skill.

---

## 2026-02-21 — Session 1: Projekt-Setup & Backend

**Kontext**: Erster Tag des Projekts `juliaz_agents`.

### Was wurde gemacht
- **Backend REST API** gebaut mit Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Docker Compose
- **Test-Driven Development (TDD)** angewendet — Tests zuerst geschrieben
- Endpunkte: `GET /health`, `GET/POST /tasks`, `PATCH/DELETE /tasks/:id`
- **Julia-Agentensystem** eingerichtet (Antigravity Framework, 300+ Skills)
- **GitHub-Repository** erstellt: `https://github.com/abzhaw/juliaz_agents`

### Entscheidungen
- Stack-Wahl: Node.js/TypeScript für schnelle Entwicklung, Prisma als typsicheres ORM
- TDD-Methodik gewählt für Nachvollziehbarkeit

---

## 2026-02-21 — Session 2: OpenClaw & Telegram

**Kontext**: Integration der Kommunikationsschicht.

### Was wurde gemacht
- **OpenClaw** als Kommunikations-Sub-Agent eingerichtet (`./openclaw/`)
- **Telegram-Bot** konfiguriert und verbunden (Polling-Modus)
- Sicherheitsrichtlinie gesetzt: `dmPolicy: pairing`, `allowFrom` Allowlist
- Skills erstellt: `openclaw-expert`, `openclaw-gateway`, `openclaw-troubleshoot`
- Git-Identität konfiguriert: `abzhaw@users.noreply.github.com`

### Entscheidungen
- Telegram als primären Kanal gewählt (mobiler Zugriff auf das Agentensystem)
- Pairing-Modus für Sicherheit (kein offener Zugang)

---

## 2026-02-21 — Session 3: Thesis-Agent

**Kontext**: Dokumentationssystem für die Masterarbeit eingerichtet.

### Was wurde gemacht
- **Thesis-Agent** Workspace erstellt (`./thesis/`)
- Ordnerstruktur: `research_papers/`, `drafts/`, `documentation/`
- **3 Skills** erstellt: `thesis-research`, `thesis-writer`, `thesis-log`
- **Protokoll-Dokumente** angelegt (dieses Dokument + thematisches Protokoll)

### Entscheidungen
- Research nur aus `thesis/research_papers/` — keine Halluzinationen
- Trennung: Research → Drafts (Agenten) → Dokumentation (Mensch genehmigt)
- Zwei Protokoll-Dokumente: zeitlich + thematisch für verschiedene Perspektiven

---

<!-- Neue Einträge unterhalb dieser Linie einfügen -->

---

## 2026-02-21 — Session 5: Wish Companion — Sterbewünsche & Erfüllung

**Kontext**: Julia wurde für Raphaels enge Freundin gebaut, die Krebs hat. Diese Session fügte eine spezialisierte Fähigkeitsschicht hinzu, die auf Palliativforschung basiert.

### Was wurde gemacht

- **Neuer Skill `dying-wishes`** erstellt (`openclaw/skills/dying-wishes/SKILL.md`)
  - Forschungsschicht basierend auf: SUPPORT-Studie, Dignity Therapy (Chochinov), Atul Gawandes *Being Mortal*, dem Five Wishes Framework
  - 8 häufigste Sterbewünsche von Krebspatient:innen dokumentiert
  - Julias einzigartiger Vorteil beschrieben: Sie kann Raum halten ohne Erschöpfung, Trauer oder Unbehagen

- **Neuer Skill `wish-fulfillment`** erstellt (`openclaw/skills/wish-fulfillment/SKILL.md`)
  - Handlungsschicht: 5 Wünsche mit Auslösern und Schritt-für-Schritt-Verfahren
    1. Briefe schreiben, die noch nicht geschrieben wurden (Co-Autorenschaft in der eigenen Stimme)
    2. Erinnerungen in ein Memoir verwandeln (sanfte Interview-basierte Dokumentation)
    3. Einfach da sein — Raum halten ohne Agenda (Präsenz als primäres Geschenk)
    4. Eine Legacy-Box für die Zurückbleibenden bauen (Briefe, Weisheit, praktische Infos)
    5. Eine lebende Feier planen (Zusammenkunft, solange die Person noch da ist)

- **Neuer Agent Card `wish-companion`** erstellt (`docs/agent_cards/wish-companion.md`)
  - Dokumentiert den Wish Companion als benannten Modus von Julia
  - Aktivierungsmodell: durch Gesprächssignale, nicht durch Befehle

- **Orchestrator-Prompt** aktualisiert und dann von Benutzer zurückgesetzt
  - Wish-Companion-Abschnitt in `orchestrator/src/prompt.ts` eingefügt
  - Prompt wurde anschließend auf generische Form zurückgesetzt — Fähigkeit lebt jetzt in den Skill-Dateien

### Entscheidungen
- Skills-as-Documentation Muster: Fähigkeit in SKILL.md-Dateien kodiert, nicht im Orchestrator-Prompt
- Trennung von Forschungsschicht (`dying-wishes`) und Handlungsschicht (`wish-fulfillment`)
- Prinzip: "Anbieten, nicht aufdrängen" — keine Befehle, nur Gesprächssignale

## 2026-02-21 — Session 4: OpenClaw Workspace-Erkundung

**Kontext**: Vertieftes Verständnis der OpenClaw-Infrastruktur (keine Änderungen, nur Analyse).

### Was wurde gemacht
- Alle Bootstrap-Dateien gelesen: `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `TOOLS.md`, `HEURISTICS.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`
- Livekonfiguration `~/.openclaw/openclaw.json` analysiert
- Zwei lokale OpenClaw-Skills gesichtet: `openclaw-self-manage`, `openclaw-troubleshoot`
- Workspace-Struktur kartiert: `~/.openclaw/workspace/` = Runtime-Workspace (Git-Repo)
- Pairing-Status überprüft: ein CLI-Gerät gepaart (`devices/paired.json`)
- Agent-Speicher: `~/.openclaw/memory/main.sqlite` (SQLite-basiert)

### Erkenntnisse
- **AGENTS.md** enthält das Selbstlern-System mit `HEURISTICS.md` (H-NNN Regeln, M-NNN Fehler)
- **IDENTITY.md** & **USER.md** sind noch leer — Onboarding wurde noch nicht abgeschlossen
- **BOOTSTRAP.md** ist noch vorhanden — der Agent hat seinen "Geburtsmoment" noch nicht vollständig durchlaufen
- Das **Heartbeat-System** ist konfiguriert aber leer (`HEARTBEAT.md`) — Potenzial für Proaktivität
- Kein `skills/`-Ordner im Laufzeit-Workspace — Skills konnten noch nicht aus dem Repo synchronisiert werden

### Entscheidungen
- Keine Änderungen vorgenommen (auf Wunsch des Benutzers: Understand-only Session)

---

## 2026-02-22 — Session 6: Julia Architektur-Analyse & Tool Calling Implementierung

**Kontext**: Diagnose der fehlenden Werkzeugfähigkeit von Julia sowie vollständige Implementierung von OpenAI Function Calling.

### Was wurde gemacht
- **Vollständige Systemkartierung**: Julia (Orchestrator, GPT-4o), OpenClaw (Telegram-Gateway), Bridge (MCP-Relay, Port 3001), Cowork-MCP (Claude Sub-Agent, Port 3003), Julia_Medium (Research-Agent) vollständig dokumentiert.
- **Diagnose**: Julia hatte kein Tool Calling konfiguriert — System-Prompt sagte "I can't do that" bei realen Aktionen. OpenAI-Aufruf war ein einfacher Chat-Completion ohne Tools.
- **Neue Datei `orchestrator/src/tools.ts`**: Definiert `send_email` OpenAI Tool Schema; Ausführung via `op run` + OpenClaw's `email_send.py` Skript.
- **Aktualisiert `orchestrator/src/openai.ts`**: Einzelner API-Aufruf ersetzt durch Tool-Use-Loop (max. 5 Iterationen); Usage wird über alle Iterationen akkumuliert; `index.ts` bleibt unverändert.
- **Aktualisiert `orchestrator/src/prompt.ts`**: Email-Fähigkeit hinzugefügt mit Verhaltensregeln (wann sofort senden vs. zuerst nachfragen).

### Entscheidungen
- Tool-Use-Loop lebt intern in `generateReply()` — Aufrufer (`index.ts`) bemerkt keine Änderung (gleiche Signatur).
- OpenClaw's bestehende Skill-Skripte werden direkt vom Orchestrator aufgerufen (gleiche Maschine), kein Bridge-Änderungsbedarf.
- `MAX_TOOL_ITERATIONS = 5` als Schutz vor Endlosschleifen.

---

## 2026-02-22 — Session 7: Thesis-Autonomy Diagnose & Enforcement

**Kontext**: Diagnose warum `thesis-autonomy` Skill nicht ausgelöst wurde; Implementierung von Enforcement-Mechanismen.

### Was wurde gemacht
- **Diagnose**: `thesis-autonomy` Skill ist nur eine Textdatei ohne Enforcement-Mechanismus. `MEMORY.md` war leer — kein automatisches Laden in jede Session.
- **Auto-Flush**: Session Buffer (Einträge 1–5) wurde in alle drei Protokoll-Dokumente geflusht und Buffer zurückgesetzt.
- **`MEMORY.md` aktualisiert**: Persistente Erinnerung an `thesis-autonomy` Pflicht hinzugefügt — wird in jede Session automatisch geladen.

### Entscheidungen
- MEMORY.md als primärer Enforcement-Mechanismus für Claude Code (Antigravity) gewählt.
- Zwei-Ebenen-Enforcement: MEMORY.md (immer geladen) + Skill-Datei (detaillierte Anweisungen).

---

## 2026-02-22 — Session 8: masterthesis-de Skill (Cowork-Session)

**Kontext**: Akademisches Schreiben für die Masterarbeit brauchte einen dedizierten Skill, der Schweizer Rechtschreibung, APA-Zitierung und korrekte Autorennamen erzwingt.

### Was wurde gemacht
- **Skill `masterthesis-de`** erstellt via Skill-Creator-Prozess (Entwurf → Evals → 3 Iterationen → Beschreibungsoptimierung)
- Evals: with_skill 100% Pass Rate vs. without_skill 93% — Schlüsselunterschied: Autorennamen (Schick ≠ Schoop), explizite DOI-URLs, `ss` statt `ß`
- Wish Companion und 6-Komponenten-Architektur in Skill integriert

### Entscheidungen
- Manuell optimierte Beschreibung (Optimizer-Loop stalled bei API-Calls)
- Skill grenzt sich explizit ab: kein DevOps, kein Debugging, kein Projektlog, keine englischen Anfragen

---

## 2026-02-22 — Session 9: ADHD Agent — Ambient Skill Hygiene

**Kontext**: 4 Skill-Registries, wachsendes Ökosystem, kein automatischer Hygiene-Mechanismus — Skills akkumulieren Duplikate und Bloat.

### Was wurde gemacht
- **`adhd-focus` Skill**: Pflicht-Planungsritual (Zoom Out → Silver Lining → Sessionplan) — triggert bei jeder juliaz_agents-Session
- **ADHD Ambient Agent** (`adhd-agent/`): vollständiger Ambient-Agent mit macOS LaunchAgent (alle 6h)
  - `scan_skills.py`: erkennt Duplikate, Near-Duplikate (>75% Beschreibungsüberschneidung), leere Skills, Merge-Kandidaten
  - Human-in-the-Loop via Telegram: Vorschlag → Raphael antwortet YES/NO/LATER → Agent handelt
  - Genehmigungen in `approved_actions.txt` → Antigravity führt aus (zweite Sicherheitsebene)
- Installiert und live verifiziert: Telegram-Nachricht msg_id=86, Scanner fand sofort echtes Duplikat (`adhd-focus`)
- **README.md**: ADHD Agent als 7. Systemkomponente registriert

### Entscheidungen
- Bridge-Polling (`/queues/julia`) statt direktem `getUpdates` — OpenClaw besitzt die Telegram-Verbindung
- Genehmigte Aktionen durch Antigravity ausgeführt, nicht durch ADHD Agent selbst
- macOS LaunchAgent statt pm2 (Shell-Prozess, kein Node.js-Server)

---

## 2026-02-22 — Session 10: Cowork MCP — Claude als Multimodaler Sub-Agent

**Kontext**: Julia verwendet bisher ausschliesslich GPT-4o. Diese Session integrierte Claude (Anthropic) als zweites KI-Modell über MCP — Julia wird zum echten Multi-Modell-System.

### Was wurde gemacht
- **Neues Verzeichnis `cowork-mcp/`**: TypeScript MCP-Server (Port 3003) der die Anthropic Claude API als MCP-Tools verfügbar macht
- **6 MCP-Tools implementiert**: `claude_task`, `claude_multimodal_task`, `claude_code_review`, `claude_summarize`, `claude_brainstorm`, `cowork_status`
- **Live getestet**: Server gestartet, Health-Endpoint bestätigt (`api_key_set: true`), alle 5 Callable-Tools haben die Anthropic API erreicht
- **Test-Ergebnis**: Anthropic API antwortet mit `"credit balance too low"` (Billing-Problem des gespeicherten Keys, keine Code-Fehler — MCP-Infrastruktur vollständig verifiziert)
- **Ecosystem-Integration**: `ecosystem.config.js` aktualisiert, Agent Card erstellt, README mit 6. Systemkomponente aktualisiert

### Entscheidungen
- Stateless Transport (ein Transport pro Request) — konsistent mit Bridge-Muster
- Fehlerbehandlung schluckt alle Anthropic-API-Fehler in saubere Textantworten — Orchestrator crasht nie durch Sub-Agent-Fehler
- `CHARACTER_LIMIT = 25'000` Zeichen als Schutz für nachgelagerte Kontextfenster

---

## 2026-02-22 — Session 11: Application Setup Audit & Infrastructure Fixes

**Kontext**: Nach dem cowork-mcp Build wurden alle 6 Komponenten auf Produktionsbereitschaft geprüft.

### Was wurde gemacht
- **Vollständiger Audit**: Frontend/3002, Bridge/3001, Backend/3000, Orchestrator, OpenClaw, Cowork-MCP/3003 — 3 konkrete Probleme gefunden und behoben
- **`backend/package.json`**: `ts-node` → `tsx` (Inkompatibilität mit `"moduleResolution": "bundler"`)
- **`ecosystem.config.js` + `ecosystem.dev.js`**: `...secrets` jetzt in alle Apps injiziert (nicht nur cowork-mcp)
- **`.claude/launch.json`**: Neues einheitliches Launch-Config für alle 5 Services

### Entscheidungen
- Secrets-Injektion via `fs.readFileSync` beim Config-Load — zuverlässiger als PM2 `env_file`-Direktive

---

## 2026-02-22 — Session 12: adhd-focus Skill Deduplizierung

**Kontext**: Kleine Bereinigungssession — ADHD-Agent-Scanner hatte ein echtes Duplikat gefunden.

### Was wurde gemacht
- `.claude/skills/adhd_focus/` → `.claude/skills/adhd-focus/` kopiert (Underscore → Kebab-Case)
- Cross-Registry-Duplikate (`.claude/skills/` vs `.skills/skills/`) als beabsichtigt identifiziert — verschiedene Agenten lesen verschiedene Registries
- macOS FUSE File Locks verhinderten Löschung des alten Ordners — manuell nach Cowork-Neustart bereinigen

### Entscheidungen
- Kein Protokolleintrag für Micro-Sessions (Housekeeping)

---

## 2026-02-22 — Session 13: Systemreparatur — MCP, Backend, Orchestrator-Modell

**Kontext**: Drei verschiedene Ausfälle diagnostiziert und behoben.

### Was wurde gemacht
- Docker Backend neu gebaut (`--build`) — `/usage` und `/updates` Routen im stale Container fehlten
- Gestoppte Orchestrator-Prozesse (TN/SIGSTOP) beendet; frische S-State-Prozesse liefen bereits
- MCP-Transport: HTTP-URL → stdio gewechselt; `bridge/mcp-stdio.mjs` als Proxy erstellt
- Bridge gehärtet: atomare Queue-Schreibvorgänge (write-to-tmp → rename), Backup bei korrupter Queue
- Orchestrator-Modell: `claude-3-5-sonnet-20241022` (404) → `claude-haiku-4-5-20251001`

### Erkenntnisse
- Anthropic-Account hat nur Claude 4.x Modelle — alle 3.x Modell-IDs geben 404 zurück
- HTTP-URL MCP fragil: wenn Bridge beim Claude Code Start nicht läuft, verliert Session MCP silent; stdio löst dieses Race Condition

---

## 2026-02-22 — Session 14: Infrastruktur-Reparatur + Julia Tool Calling + Claude-Delegation

**Kontext**: Vollständige Systemüberholung. Bridge/Backend-Crashloops (beide EADDRINUSE — 325+ Neustarts) behoben. Tool-Calling-Fähigkeit und Claude-Delegation implementiert.

### Was wurde gemacht
- Backend aus PM2-Configs entfernt (Docker-only) — 326-Neustart-Crashloop behoben
- Rogue Bridge-Prozess gekillt — 325-Neustart-Crashloop behoben
- `start-devops.sh` aktualisiert: Docker Backend zuerst starten + Rogue-Port-Prozesse killen
- `orchestrator/src/tools.ts` umgeschrieben: Anthropic `Tool[]` Format, `ask_claude` Tool, Dual-Export für GPT-4o Fallback
- `orchestrator/src/claude.ts` umgeschrieben: vollständiger Tool-Use-Loop (tool_use Blocks, executeTool, tool_result Feedback, max 5 Iterationen)
- GPT-4o Fallback in `orchestrator/src/index.ts` (Claude primär, GPT-4o bei Ausfall)
- `POST /task` REST-Endpunkt in `cowork-mcp/src/index.ts`
- Julia System-Prompt mit `ask_claude` Fähigkeiten erweitert

### Entscheidungen
- Backend = Docker-only, PM2 verwaltet Bridge + Orchestrator + Cowork-MCP + Frontend
- Claude primär + GPT-4o Fallback Architektur
- Cowork-mcp nutzt REST `/task` (nicht MCP-Protokoll) für Delegationseinfachheit

---

## 2026-02-22 — Session 15: Julia Selbstwissen (send_email + 1Password)

**Kontext**: Julia sendete erfolgreich eine Email, behauptete aber bei Nachfrage, 1Password nicht zu verwenden — Konfabulation durch unvollständige Werkzeugbeschreibung.

### Was wurde gemacht
- `send_email` Werkzeugbeschreibung in `tools.ts` aktualisiert: OpenClaw email-aberer Skill + 1Password CLI (`op run`)
- System-Prompt Email-Abschnitt in `prompt.ts` aktualisiert: Credential-Injection-Mechanismus beschrieben
- Verifiziert: Julia erklärt nun korrekt 1Password, `op run` und das Python SMTP-Skript

### Erkenntnis
- Agent-Selbstwissen ist begrenzt durch Werkzeugbeschreibungen und System-Prompts — fehlende Beschreibung = Konfabulation, nicht Lüge
- Email-Skill lebt physisch in OpenClaws Verzeichnis, Orchestrator ruft es direkt per Subprocess auf (Borrowed-Library-Muster)

---

## 2026-02-22 — Session 16: Frontend Chatbot — Architektur-Neugestaltung + Vercel AI SDK

**Kontext**: Das alte ChatWindow pollte die Bridge alle 3s (Telegram-Muster) — langsam, kein Streaming, falsche Architektur für Web. Neuer direkter Streaming-Chatbot implementiert.

### Was wurde gemacht
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) + `react-markdown` + `remark-gfm` im Frontend installiert
- `frontend/app/api/chat/route.ts` erstellt: Streaming-Endpunkt mit `streamText()` + `openai('gpt-4o')`, 3 Tools (`ask_claude`, `get_tasks`, `get_memories`)
- `frontend/components/ChatWindow.tsx` komplett umgeschrieben: `useChat()` Hook ersetzt Bridge-Polling, Markdown-Rendering, Tool-Invocation-Indikatoren, Streaming-Status
- `frontend/.env.local` erstellt mit OPENAI_API_KEY
- Keine Änderungen an Orchestrator, Bridge, Backend oder Cowork-MCP

### Architekturentscheidung
- **Zwei unabhängige Pfade**: Web (Dashboard → `/api/chat` → GPT-4o Streaming SSE) / Telegram (OpenClaw → Bridge → Julia/Orchestrator)
- **Modellwahl**: GPT-4o (Frontend, Reasoning-Tiefe), Claude Haiku 4.5 (Orchestrator/Telegram, Speed/Cost)
- `send_email` bewusst vom Frontend ausgeschlossen (Sicherheit — Email bleibt Telegram-only)

### Erkenntnisse
- AI SDK v5 Breaking Changes: `sendMessage` statt `handleSubmit`, `parts[]` Array, flache Tool-Parts, Zustände `input-streaming`/`output-available`
- Upgrade-Pfad: Wenn Claude Sonnet auf dem API-Key verfügbar wird, ist der Swap eine Zeile

---

## 2026-02-22 — Session 17: Dokumentation & Strukturbereinigung

**Kontext**: Projekt-Struktur auf Auffindbarkeit für Menschen und KI-Agenten geprüft und bereinigt.

### Was wurde gemacht
- Vollständiger Audit der Projektstruktur — 16 verwaiste Dateien gelöscht (Logs, veraltete Skripte, veralteter `dashboard/`-Prototyp, redundante PM2-Configs)
- Fehlende READMEs erstellt (Orchestrator, Frontend-Rewrite), Agent Cards (adhd_agent, julia_medium), `.env.example`-Vorlage
- Root README korrigiert (Komponentenanzahl 4→7, Verzeichnisbaum aktualisiert), doppelte Zeile in agent_system_overview entfernt, .gitignore aktualisiert

### Entscheidungen
- Projektstruktur soll sowohl für menschliche Entwickler als auch für KI-Agenten navigierbar sein

---

## 2026-02-22 — Session 18: JuliaFrontEnd Identität & System-Prompt-Überarbeitung

**Kontext**: Frontend-Chatbot hiess in allen UI-Elementen einfach "Julia" — Verwechslungsgefahr mit dem Orchestrator-Julia.

### Was wurde gemacht
- Frontend-Chatbot in allen UI-Labels von "Julia" zu "JuliaFrontEnd" umbenannt (Header, Rollenbezeichnung, Denk-Indikator, Platzhalter)
- System-Prompt neugeschrieben: projektbewusst — erklärt Multi-Agent-Architektur, Thesis-Kontext, spezifische Tools (`ask_claude`, `get_tasks`, `get_memories`), Telegram-Pendant
- Chatbot nennt sich in Konversation weiterhin "Julia", aber UI-Chrome unterscheidet den Frontend-Agenten

### Entscheidungen
- Identitätstrennung auf UI-Ebene, nicht auf Konversationsebene — Benutzererlebnis bleibt natürlich

---

## 2026-02-22 — Session 19: System-Dev Loop — /dev Slash Command (Claude Code CLI)

**Kontext**: Julias erste Selbstmodifikationsfähigkeit — direkte Codeänderungen per Telegram-Befehl.

### Was wurde gemacht
- `/dev <instruction>` Befehl im Orchestrator implementiert — spawnt Claude Code CLI (`claude -p`) asynchron mit vollen Berechtigungen
- Neues Modul `dev-runner.ts`: Auth (nur Raphaels chatId 8519931474), Mutex (eine Aufgabe gleichzeitig), 15-Min-Timeout
- `/dev-status` Befehl zur Überwachung laufender Aufgaben
- Architektur: Telegram → Bridge → Orchestrator erkennt `/dev` → spawnt Claude Code → meldet Ergebnis zurück an Telegram

### Entscheidungen
- Claude Code CLI als Ausführungsschicht — volle Codebase-Zugriffsrechte, aber Auth-Gate und Mutex als Schutz

---

## 2026-02-22 — Session 20: Code Review — dev-runner.ts

**Kontext**: Kurze Review-Session des neuen `/dev`-Moduls.

### Was wurde gemacht
- `orchestrator/src/dev-runner.ts` geprüft — spawnt Claude Code CLI für `/dev` Telegram-Befehle, eine Aufgabe gleichzeitig mit 15-Min-Timeout

---

## 2026-02-22 — Session 21: /dev Rewrite — Git-Pull Deploy

**Kontext**: Claude Code CLI-Ansatz durch zuverlässigeren Git-Pull-Mechanismus ersetzt.

### Was wurde gemacht
- Claude Code CLI Spawning durch Git-Pull-and-Restart-Ansatz ersetzt — einfacher, zuverlässiger
- Neuer Workflow: Raphael bearbeitet Code auf dem Handy (Claude App auf GitHub) → pusht nach main → sendet `/dev` via Telegram → Orchestrator pullt, installiert Abhängigkeiten, startet Docker + PM2 neu
- `spawnSync` für sequenzielle Shell-Befehle (sicher, keine Injection), detachter `spawn` für `pm2 restart all` (überlebt Self-Kill)
- Schlüsselerkenntnis: Orchestrator muss Erfolg melden BEVOR er sich selbst neustartet, da pm2 restart den Prozess beendet

### Entscheidungen
- Git-Pull statt Claude Code CLI: weniger Fehleranfällig, funktioniert auf dem Handy, keine CLI-Abhängigkeiten nötig
- Ergebnis-Meldung vor Neustart — Race-Condition-bewusstes Design

---

## 2026-02-22 — Session 22: Frontend Chatbot: Persistenz, Modellauswahl & Best Practices

**Kontext**: Frontend-Chatbot hatte keine Zustandspersistenz — Nachrichten gingen bei Seitenaktualisierung oder Orb-Toggle verloren.

### Was wurde gemacht
- **ChatWindow** mit localStorage-Persistenz erweitert: Nachrichten überleben Seitenaktualisierung und Orb-Toggle
- **Modellselektor** implementiert (GPT-4o / Claude Sonnet), Kontext-Prozentanzeige, "New Chat"-Reset-Button
- **page.tsx** angepasst: ChatWindow wird immer gemountet (CSS-Visibility-Toggle statt bedingtem Rendering) — useChat-Hook-Zustand überlebt Orb-Interaktionen
- **Multi-Model-Backend** in route.ts: Model-Registry mit `getModel()`, `@ai-sdk/anthropic` installiert
- **10 Production-Chatbot-Best-Practices** als TODO-Kommentare dokumentiert

### Entscheidungen
- Always-mount mit CSS-Visibility statt bedingtem Rendering — React-Hook-Zustand bleibt erhalten
- Model-Registry-Muster für einfache Erweiterbarkeit

---

## 2026-02-22 — Session 23: Schreiber Agent: 5 Core SKILL.md-Dateien

**Kontext**: Der Schreiber (Master Thesis Agent) brauchte formalisierte Skills für das akademische Schreiben der Masterarbeit.

### Was wurde gemacht
- **5 SKILL.md-Dateien** erstellt unter `thesis-agent/skills/`: `thesis-structure`, `draft-writer`, `research-scout`, `citation-gatekeeper`, `code-to-thesis`
- Skills definieren: deutsche akademische Schreibregeln, Human-in-the-Loop-Zitations-Workflow, LaTeX-Formatierungsstandards, Code-Extraktionsmuster, vollständige Kapitelarchitektur
- **Zitations-Pipeline** mit strikter Trennung: `research-scout` entdeckt (`pending-papers.json`), `citation-gatekeeper` genehmigt (`approved-papers.json` + `references.bib`), `draft-writer` verwendet Platzhalter (`\cite{TODO:topic}`)

### Entscheidungen
- Dreistufige Zitations-Pipeline verhindert ungeprüfte Quellen in der Arbeit
- Skills als eigenständige SKILL.md-Dateien — modular und unabhängig aktualisierbar

---

## 2026-02-22 — Session 24: Schreiber Agent: 5 Weitere SKILL.md-Dateien (Batch 2)

**Kontext**: Zweite Charge von Skills für den Schreiber-Agenten — Fokus auf Synthese, Argumentation, Visualisierung und Build-Automatisierung.

### Was wurde gemacht
- **5 weitere SKILL.md-Dateien** erstellt: `session-synthesizer`, `argument-advisor`, `figure-architect`, `latex-builder`, `thesis-tracker`
- **session-synthesizer**: Pipeline zur Konvertierung von Session-Protokollen in thesisreife deutsche akademische Prosa; Drei-Wege-Unterscheidung (geplant/gebaut/gelernt)
- **argument-advisor**: 7 Review-Dimensionen (logische Lücken, unbelegte Behauptungen, Overclaiming, Zirkelschlüsse, fehlende Definitionen), Betreuer-Simulation, Verteidigungsfragen-Generator
- **figure-architect**: TikZ/PGF-Diagrammvorlagen für Systemarchitektur, Sequenzdiagramme, Timelines, Skill-Hierarchien mit deutschen Labels und konsistentem Farbschema
- **latex-builder**: Vollständiges Mac-Mini-Kompilierungs-Setup (latexmk/biber), deutsche Paket-Konfiguration, Fehlerbehandlung, Validierungsprüfungen
- **thesis-tracker**: `progress.json`-Schema mit Kapitelstatus und Warnsystem

### Entscheidungen
- 10 Skills bilden das vollständige Skill-Set des Schreiber-Agenten (5 Core + 5 Batch 2)
- Betreuer-Simulation als eigenständige Review-Dimension — bereitet auf Verteidigung vor

---

## 2026-02-22 — Session 25: Schreiber Agent: LaTeX-Skelett, Zitations-Workflow & Master-Prompt

**Kontext**: Der Schreiber brauchte die physischen LaTeX-Dateien und die Infrastruktur für den Zitations-Workflow.

### Was wurde gemacht
- **LaTeX-Thesis-Skelett** erstellt: `main.tex` (deutsches akademisches Setup mit BibLaTeX/Biber, fancyhdr, geometry) + 7 Kapitel-Dateien (`01-einleitung` bis `07-zusammenfassung`) mit Abschnittsüberschriften und TODO-Markern
- **Zitations-Genehmigungs-Infrastruktur** aufgebaut: `pending-papers.json`, `approved-papers.json`, `references.bib`, `structure.json` (Kapitelübersicht mit Seitenvorgaben), `progress.json` (Tracker mit Wortzahl-Zielen, gesamt 25'000 Wörter)
- **Master-Prompt-Dokument** geschrieben: `docs/plans/2026-02-22-thesis-agent-design.md` — umfassender Prompt zur Neuerstellung des Schreibers auf dem Mac Mini, inklusive aller 10 Skills, Setup-Anweisungen und Workflow-Beispiele

### Entscheidungen
- 25'000 Wörter als Gesamtziel der Arbeit
- Master-Prompt als portables Dokument — ermöglicht Neuerstellung des Agenten auf jeder Maschine

---

## 2026-02-22 — Session 26: Frontend-Migration: Next.js 16 → Vite + React Router + Hono

**Kontext**: Analyse ergab 0% SSR-Nutzung, 0 Server Components und nur 6 Next.js-spezifische Imports im gesamten Frontend — Next.js war Overhead ohne Nutzen.

### Was wurde gemacht
- **Komplette Frontend-Migration** von Next.js 16 zu Vite 6 + React Router 7 + Hono API-Server
- **Hono `server.ts`** erstellt: kombiniert beide API-Routen (`/api/chat` Streaming + `/api/devops` PM2-Steuerung)
- Alle 9 Komponenten nach `src/` verschoben, unverändert — nur `next/link` → `react-router Link` in 2 Routendateien getauscht
- **Build-Zeit**: ~15-30s (Next.js) → 2.1s (Vite); Dev-Server startet in 133ms
- Eliminiert EISDIR und andere Framework-spezifische Build-Fehler

### Entscheidungen
- Vite + React Router + Hono als leichtgewichtige Alternative zu Next.js — kein SSR/SSG-Overhead für ein reines SPA
- Hono als API-Layer — leichtgewichtig, Express-kompatibel, TypeScript-first
