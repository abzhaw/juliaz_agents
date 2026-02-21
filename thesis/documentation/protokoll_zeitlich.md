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
