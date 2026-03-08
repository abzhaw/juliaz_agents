---
name: code-to-thesis
description: Liest juliaz_agents-Quellcode (READ-ONLY) und extrahiert Architekturmuster, Code-Beispiele und Implementierungsdetails fuer die Thesis. Formatiert als LaTeX-Listings.
---

# Code-to-Thesis Skill

## Purpose

This skill bridges the gap between the living codebase of juliaz_agents and the academic prose of the thesis. It reads source code, extracts architecture patterns, selects representative code snippets, and formats everything as LaTeX-ready content for the Konzept and Implementierung chapters. It turns working software into documented, explained, and cited implementation evidence.

**ABSOLUTE RULE: This skill is READ-ONLY. It never modifies any file in the juliaz_agents source tree. It reads, analyzes, extracts, and formats -- nothing more.**

## System Architecture Knowledge

The code-to-thesis skill maintains a comprehensive understanding of the juliaz_agents system. This knowledge is used to navigate the codebase efficiently and produce accurate descriptions.

### Component Map

| Component | Location | Language | Purpose | Key Files |
|-----------|----------|----------|---------|-----------|
| Julia Orchestrator | `orchestrator/src/` | TypeScript | Central agent, GPT-4o, tool calling | `index.ts`, `openai.ts`, `claude.ts`, `prompt.ts`, `tools.ts` |
| OpenClaw | `openclaw/` | Python | Telegram gateway, sibling agent | Skills in `openclaw/skills/` |
| Bridge | `bridge/src/` | TypeScript | MCP relay between agents, ~200 lines | `index.ts` |
| Cowork-MCP | `cowork-mcp/src/` | TypeScript | Claude as sub-agent via MCP | `index.ts` |
| Backend | `backend/` | TypeScript | REST API + Postgres via Docker | API routes, DB models |
| Frontend | `frontend/` | TypeScript | Next.js 15 + Vercel AI SDK dashboard | `app/page.tsx`, components |
| ADHD Agent | `.agent/skills/` | Skill files | Ambient system hygiene scanner | Skill definitions |

### Communication Flow

```
User (Telegram) → OpenClaw → Bridge (MCP, port 3001) → Julia Orchestrator
                                                              ↓
                                                         GPT-4o (tool calling)
                                                              ↓
                                                     Cowork-MCP (port 3003) → Claude
                                                              ↓
                                                         Backend (port 3000) → Postgres
                                                              ↓
                                                         Frontend (port 3002)
```

## Extraction Operations

### 1. Code Snippet Extraction

Extract a specific code segment and format it as a LaTeX listing:

**Input**: File path + line range or function name
**Output**: LaTeX listing block

```latex
\begin{listing}[htbp]
\begin{minted}[
  linenos,
  fontsize=\small,
  breaklines,
  frame=single,
  framesep=2mm,
  bgcolor=codebg
]{typescript}
async function generateReply(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto",
  });

  // Tool-use loop: execute tools and feed results back
  let reply = response.choices[0].message;
  while (reply.tool_calls?.length) {
    const results = await executeTools(reply.tool_calls);
    messages.push(reply, ...results);
    reply = (await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: TOOL_DEFINITIONS,
    })).choices[0].message;
  }

  return reply.content ?? "";
}
\end{minted}
\caption{Die zentrale Tool-Calling-Schleife des Julia-Orchestrators. Die Funktion
\texttt{generateReply} sendet Nachrichten an GPT-4o und fuehrt zurueckgegebene
Werkzeugaufrufe iterativ aus, bis das Modell eine finale Textantwort liefert.}
\label{lst:generate-reply}
\end{listing}
```

### 2. Architecture Pattern Description

Analyze code to identify and describe architectural patterns in German academic prose:

**Input**: Component name or pattern to describe
**Output**: LaTeX paragraph(s) explaining the pattern

```latex
\subsection{Tool-Calling-Schleife}
\label{sec:tool-calling-schleife}

Der Orchestrator implementiert eine iterative Tool-Calling-Schleife
(siehe \cref{lst:generate-reply}), die dem ReAct-Muster
\cite{TODO:react-yao2023} folgt. In jedem Iterationsschritt sendet
das System die aktuelle Nachrichtenhistorie an das GPT-4o-Modell.
Enthaelt die Antwort des Modells einen oder mehrere Werkzeugaufrufe
(\texttt{tool\_calls}), werden diese lokal ausgefuehrt und die
Ergebnisse als neue Nachrichten an die Historie angehaengt.
Dieser Prozess wiederholt sich, bis das Modell eine reine
Textantwort ohne Werkzeugaufrufe zurueckgibt.
```

### 3. API Documentation Extraction

Read actual endpoint definitions and document them:

**Input**: API route file or endpoint path
**Output**: LaTeX table or description of the API

```latex
\begin{table}[htbp]
\centering
\caption{REST-API-Endpunkte des Backend-Servers}
\label{tab:api-endpoints}
\begin{tabular}{llp{6cm}}
\toprule
\textbf{Methode} & \textbf{Pfad} & \textbf{Beschreibung} \\
\midrule
GET  & \texttt{/api/sessions}     & Listet alle aktiven Sitzungen auf \\
POST & \texttt{/api/messages}     & Sendet eine neue Nachricht an Julia \\
GET  & \texttt{/api/messages/:id} & Ruft eine einzelne Nachricht ab \\
POST & \texttt{/api/tools/invoke} & Fuehrt ein Werkzeug direkt aus \\
\bottomrule
\end{tabular}
\end{table}
```

### 4. Configuration Documentation

Extract and explain configuration files:

**Input**: Config file path (e.g., `ecosystem.config.js`, `docker-compose.yml`)
**Output**: LaTeX listing with German explanation

```latex
\begin{listing}[htbp]
\begin{minted}[fontsize=\small, breaklines]{javascript}
// ecosystem.config.js — PM2-Prozesskonfiguration
module.exports = {
  apps: [
    { name: "orchestrator", script: "orchestrator/dist/index.js" },
    { name: "bridge",       script: "bridge/dist/index.js" },
    { name: "backend",      script: "backend/dist/index.js" },
    { name: "frontend",     script: "npm", args: "start",
      cwd: "./frontend" },
    { name: "openclaw",     script: "openclaw/main.py",
      interpreter: "python3" },
    { name: "cowork-mcp",   script: "cowork-mcp/dist/index.js" },
  ],
};
\end{minted}
\caption{PM2-Konfiguration fuer die sechs Dienste des juliaz\_agents-Systems.
Jeder Dienst wird als eigenstaendiger Prozess verwaltet und bei Absturz
automatisch neu gestartet.}
\label{lst:ecosystem-config}
\end{listing}
```

### 5. Data Flow Description

Trace actual message passing through the code and describe it:

**Input**: A user action (e.g., "user sends a Telegram message")
**Output**: Step-by-step data flow description in LaTeX

```latex
\subsection{Nachrichtenfluss}
\label{sec:nachrichtenfluss}

Der Weg einer Benutzernachricht durch das System laesst sich in fuenf
Schritten beschreiben:

\begin{enumerate}
  \item Der Benutzer sendet eine Nachricht ueber Telegram an den
        OpenClaw-Bot.
  \item OpenClaw leitet die Nachricht ueber eine WebSocket-Verbindung
        an die Bridge (Port 3001) weiter.
  \item Die Bridge transformiert die Nachricht in das MCP-Format und
        leitet sie an den Julia-Orchestrator weiter.
  \item Der Orchestrator verarbeitet die Nachricht mittels GPT-4o,
        fuehrt gegebenenfalls Werkzeugaufrufe aus und generiert
        eine Antwort.
  \item Die Antwort durchlaeuft den umgekehrten Pfad zurueck zum
        Benutzer.
\end{enumerate}
```

## Code Selection Guidelines

### What to Include

- **Representative patterns**: Show the tool-calling loop once, not every tool implementation
- **Architectural decisions**: Code that shows WHY something was designed a certain way
- **Integration points**: Where components connect (bridge message format, MCP protocol usage)
- **Configuration**: Deployment configs that show the system topology
- **Error handling**: How the system handles failures (relevant for evaluation)

### What to Exclude

- **Boilerplate**: Standard imports, package.json, tsconfig.json (unless specifically relevant)
- **Generated code**: Build artifacts in `dist/` directories
- **Secrets and credentials**: NEVER include API keys, tokens, or 1Password references
- **Log files**: Runtime logs are not code
- **Node modules**: Third-party library code

### Truncation Rules

- Maximum listing length: 40 lines (break into multiple listings if longer)
- Use `// ...` or `# ...` to indicate omitted code
- Always show complete functions or logical units -- do not cut in the middle of a block
- If a file is relevant but too long, show the key section and note the total file length:
  ```latex
  % Note: Full file is 247 lines; only the core loop is shown here
  ```

## LaTeX Formatting Standards

### Listing Environment

Use the `minted` package for syntax highlighting:

```latex
% In preamble:
\usepackage{minted}
\usemintedstyle{friendly}
\definecolor{codebg}{rgb}{0.97,0.97,0.97}

% Standard options for all listings:
\begin{minted}[
  linenos,           % Line numbers
  fontsize=\small,   % Readable but compact
  breaklines,        % Wrap long lines
  frame=single,      % Border around code
  framesep=2mm,      % Padding inside border
  bgcolor=codebg     % Light gray background
]{typescript}
```

### Caption and Label Conventions

Every listing MUST have:
- `\caption{}`: German description of what the code shows and why it matters
- `\label{lst:descriptive-name}`: For cross-referencing from text

Caption style:
- Start with what the code IS: "Die zentrale Tool-Calling-Schleife..."
- Then explain significance: "...die iterativ Werkzeugaufrufe ausfuehrt"
- Keep under 3 lines

### Inline Code References

Use `\texttt{}` for inline code references in running text:

```latex
Die Funktion \texttt{generateReply()} in \texttt{openai.ts} bildet
den Kern der Orchestrierungslogik (siehe \cref{lst:generate-reply}).
```

## Chapter-Specific Extraction Patterns

### For 04-konzept (Architecture)

Focus on:
- Component boundaries and interfaces
- Design decisions visible in code structure
- Communication protocols and message formats
- Configuration that reveals architectural choices

Produce:
- Architecture diagrams described in LaTeX (for TikZ or included images)
- Component responsibility tables
- Interface descriptions

### For 05-implementierung (Implementation)

Focus on:
- Concrete code implementing the concepts from chapter 04
- Technology-specific details (TypeScript patterns, Python skills, Next.js features)
- Deployment and operations code
- Testing and monitoring setup

Produce:
- Annotated code listings with German explanations
- Technology comparison tables
- Implementation decision rationale

### For 06-evaluation (Evaluation)

Focus on:
- Code that demonstrates system capabilities (case study evidence)
- Error handling and resilience patterns
- Performance-relevant code sections
- Metrics collection and logging

Produce:
- Code examples that support evaluation claims
- System behavior documentation
- Failure mode illustrations

## Rules

1. **READ-ONLY** -- never modify any source file, configuration, or data in the juliaz_agents repository
2. **No secrets** -- never extract or display API keys, tokens, passwords, or 1Password references
3. **Accurate representation** -- code snippets must match the actual source; never fabricate or "improve" code for the thesis
4. **Version awareness** -- note when code has changed since last extraction; snippets should reflect the current state
5. **Appropriate granularity** -- show enough code to make the point, but not so much that it becomes a code dump
6. **Always annotate** -- every code listing needs a German caption explaining its purpose in the thesis context
7. **Cross-reference** -- link listings to the sections that discuss them using `\cref{}`
8. **File attribution** -- always note which source file a snippet comes from, either in the caption or a comment
