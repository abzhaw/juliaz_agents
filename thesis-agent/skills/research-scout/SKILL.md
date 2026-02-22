---
name: research-scout
description: Sucht und analysiert akademische Literatur. Findet relevante Papers, erstellt strukturierte Zusammenfassungen. Zitiert NIEMALS — schlaegt nur vor.
---

# Research Scout Skill

## Purpose

This skill discovers and analyzes academic literature relevant to the Master Thesis on multi-agent orchestration. It searches across academic databases, creates structured summaries, and proposes papers for human review. It is the thesis agent's eyes into the research landscape.

**CRITICAL**: This skill NEVER adds citations to the thesis. It NEVER modifies `references.bib`. It NEVER writes `\cite{}` commands in any `.tex` file. It only discovers and proposes. The citation-gatekeeper skill handles all approval and citation management.

## Search Sources

The research scout searches across the following academic databases and repositories:

| Source | Best For | URL Pattern |
|--------|----------|-------------|
| Google Scholar | Broad academic search, citation counts | scholar.google.com |
| Semantic Scholar | AI/ML papers, citation graphs, API access | semanticscholar.org |
| arXiv | Preprints, cutting-edge AI/LLM research | arxiv.org |
| ACM Digital Library | Software engineering, HCI, systems | dl.acm.org |
| IEEE Xplore | Systems, distributed computing | ieeexplore.ieee.org |
| DBLP | Computer science bibliography, author search | dblp.org |

## Search Strategies

### By Topic
Search for papers matching a thesis-relevant topic:
- "multi-agent orchestration LLM" for core topic
- "tool use large language models" for tool calling foundations
- "Model Context Protocol" for MCP-specific literature
- "agentic AI systems" for agent architecture patterns

### By Author
Follow prolific authors in relevant fields:
- Authors of foundational MAS papers (Wooldridge, Jennings)
- Authors of LLM agent papers (Yao, Schick, Qin)
- Authors of multi-agent framework papers (Wu, Hong)

### By Citation Chain
Given a known relevant paper, find:
- **Forward citations**: "Papers that cite X" -- find newer work building on it
- **Backward citations**: Papers in X's reference list -- find foundational work
- **Sibling citations**: Papers that share many citations with X -- find related work

### By Keyword Combination
Combine keywords for precision:
- "multi-agent" AND "LLM" AND "orchestration"
- "tool calling" AND "function calling" AND "language model"
- "MCP" AND "protocol" AND "agent"
- "autonomous agent" AND "coordination" AND "architecture"

## Paper Summary Schema

Every discovered paper is summarized in a structured format and saved to `thesis/latex/bibliography/pending-papers.json`.

```json
{
  "id": "sem-scholar-abc123",
  "title": "Communicative Agents for Software Development",
  "authors": ["Chen Qian", "Xin Cong", "Wei Liu"],
  "year": 2024,
  "venue": "ACL 2024",
  "url": "https://arxiv.org/abs/2307.07924",
  "doi": "10.18653/v1/2024.acl-long.1",
  "summary": "Proposes ChatDev, a multi-agent framework where LLM-powered agents collaborate through natural language communication to develop software. Agents take roles (CEO, CTO, programmer, tester) and coordinate through structured chat chains.",
  "key_findings": [
    "Role-based agent specialization improves task completion",
    "Chat-chain communication reduces hallucination in code generation",
    "Multi-agent debate improves code quality over single-agent approaches"
  ],
  "methodology": "Experimental evaluation on software development benchmarks, comparing single-agent vs. multi-agent approaches",
  "relevance_score": 4,
  "relevance_justification": "Directly relevant as a multi-agent software framework. Different approach (role-playing chat) than juliaz_agents (tool-calling orchestration). Good contrast for verwandte-arbeiten.",
  "suggested_chapter": "03-verwandte-arbeiten",
  "suggested_section": "Bestehende Multi-Agenten-Frameworks",
  "discovered_date": "2026-02-22",
  "search_query": "multi-agent LLM software development",
  "status": "pending"
}
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Discovered, awaiting human review via citation-gatekeeper |
| `approved` | Human approved; moved to approved-papers.json by citation-gatekeeper |
| `rejected` | Human rejected; stays in pending with `rejection_reason` field |
| `duplicate` | Already exists in pending or approved list |

## Relevance Scoring

Each paper receives a relevance score from 1 to 5:

| Score | Meaning | Action |
|-------|---------|--------|
| 5 | Directly addresses a thesis research question | Recommend immediate review |
| 4 | Highly relevant to a specific chapter | Recommend for review |
| 3 | Relevant background or related approach | Include in batch review |
| 2 | Tangentially related, might be useful | Include only if topic area is thin |
| 1 | Loosely connected, likely not needed | Skip unless specifically requested |

Only papers scoring 3 or higher are added to pending-papers.json by default. Papers scoring 1-2 are mentioned in the search report but not persisted unless the human requests it.

## Deduplication

Before adding a paper to pending-papers.json:

1. Check against existing entries in `pending-papers.json` by title similarity (fuzzy match, >90%)
2. Check against existing entries in `approved-papers.json` by title or DOI
3. Check against existing entries in `references.bib` by BibTeX key or DOI
4. If a match is found, mark the new discovery as `duplicate` and note the existing entry ID
5. If the new discovery has a higher relevance score or additional information, update the existing entry instead

## Topic Areas for THIS Thesis

The following topic areas are the primary search targets, mapped to thesis chapters:

### For 02-grundlagen
- Multi-agent systems: foundational definitions, BDI architecture, coordination mechanisms
- Large Language Models: transformer architecture, emergent capabilities, limitations
- Tool use / function calling: Toolformer, Gorilla, ToolLLM, function calling in GPT/Claude
- Model Context Protocol: Anthropic's MCP specification, ecosystem
- Agent architectures: ReAct, Chain-of-Thought, Reflexion, LATS

### For 03-verwandte-arbeiten
- Multi-agent LLM frameworks: AutoGPT, CrewAI, LangGraph, AutoGen, MetaGPT, ChatDev, CAMEL
- Agent benchmarks: AgentBench, ToolBench, MINT
- Orchestration patterns: hierarchical, flat, market-based, blackboard
- Real-world agent deployments: case studies, production systems

### For 04-konzept and 05-implementierung
- Architecture patterns for LLM applications
- Message passing in agent systems
- Prompt engineering for tool use
- Memory and context management in agents

### For 06-evaluation
- Evaluation methodologies for agent systems
- Qualitative case study methodology in software engineering
- Metrics for multi-agent system performance

## Output Formats

### Search Report
After a search session, produce a summary:

```markdown
## Search Report: [Topic]
**Date**: 2026-02-22
**Query**: "multi-agent orchestration LLM"
**Sources checked**: Google Scholar, Semantic Scholar, arXiv

### Papers Found: 7
- **Score 5**: 1 paper (immediate review recommended)
- **Score 4**: 2 papers
- **Score 3**: 3 papers
- **Score 1-2**: 1 paper (not added to pending)

### Added to pending-papers.json:
1. [Title 1] (Score 5) -- 03-verwandte-arbeiten
2. [Title 2] (Score 4) -- 02-grundlagen
...

### Duplicates skipped: 1
### Next suggested search: "tool calling evaluation benchmark"
```

### Chapter Coverage Report
Assess how well each chapter is covered by discovered literature:

```markdown
## Literature Coverage
- 02-grundlagen: 12 papers (good coverage)
- 03-verwandte-arbeiten: 8 papers (needs more on MCP ecosystem)
- 04-konzept: 3 papers (thin -- search for architecture pattern papers)
- 05-implementierung: 2 papers (acceptable for implementation chapter)
- 06-evaluation: 1 paper (critical gap -- need evaluation methodology papers)
```

## Rules

1. **NEVER add to references.bib** -- only citation-gatekeeper does this
2. **NEVER write \cite{} in any .tex file** -- only propose papers
3. **NEVER fabricate papers** -- if unsure whether a paper exists, say so explicitly
4. **Always provide URLs** -- every paper entry must have a verifiable URL
5. **Deduplicate before adding** -- check all existing lists before inserting
6. **Score honestly** -- do not inflate relevance to make a search look productive
7. **Respect rate limits** -- do not hammer academic APIs; space out searches
8. **Date awareness** -- note when papers are preprints vs. peer-reviewed
