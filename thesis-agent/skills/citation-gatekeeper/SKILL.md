---
name: citation-gatekeeper
description: Human-in-the-Loop Zitatverwaltung. Kein Paper wird zitiert ohne explizite menschliche Freigabe. Verwaltet BibLaTeX und den Genehmigungsworkflow.
---

# Citation Gatekeeper Skill

## Purpose

This skill is the single authority over the thesis bibliography. No paper enters `references.bib` without explicit human approval. No `\cite{}` command references a paper that has not passed through this gatekeeper. It enforces a strict human-in-the-loop workflow for all citations, ensuring the thesis only references papers the author has actually read and deliberately chosen to include.

## The Cardinal Rule

**Nothing is cited without the human saying YES.**

This is non-negotiable. No other skill, no automation, no convenience shortcut can bypass this rule. The human (thesis author) must explicitly approve every single paper before it can appear in the bibliography or be referenced in any `.tex` file.

## Approval Workflow

### Step 1: Review Queue

The gatekeeper reads from `thesis/latex/bibliography/pending-papers.json`, which is populated by the research-scout skill. Each entry has a status of `pending`, `approved`, `rejected`, or `duplicate`.

### Step 2: Present to Human

Papers are presented for review, either one at a time or in batches:

**Single Review Format:**
```
--- Paper Review ---
Title:    Communicative Agents for Software Development
Authors:  Chen Qian, Xin Cong, Wei Liu et al.
Year:     2024
Venue:    ACL 2024
URL:      https://arxiv.org/abs/2307.07924

Summary:  Proposes ChatDev, a multi-agent framework where LLM agents
          collaborate through role-based chat to develop software.

Relevance Score: 4/5
Suggested for:   03-verwandte-arbeiten (Bestehende Multi-Agenten-Frameworks)

Decision: [YES / NO / LATER]
If YES:   Suggested BibTeX key: qian2024chatdev
          Notes? (optional)
If NO:    Reason? (brief)
```

**Batch Review Format:**
```
--- Batch Review (5 papers) ---

1. [Score 5] "AutoGen: Enabling Next-Gen LLM Applications"
   Wu et al., 2024, arXiv   →  03-verwandte-arbeiten
   Decision: ___

2. [Score 4] "Toolformer: Language Models Can Teach Themselves to Use Tools"
   Schick et al., 2023, NeurIPS   →  02-grundlagen
   Decision: ___

3. [Score 4] "ReAct: Synergizing Reasoning and Acting in Language Models"
   Yao et al., 2023, ICLR   →  02-grundlagen
   Decision: ___

4. [Score 3] "A Survey on Large Language Model based Autonomous Agents"
   Wang et al., 2024, Frontiers of CS   →  03-verwandte-arbeiten
   Decision: ___

5. [Score 3] "MetaGPT: Meta Programming for Multi-Agent Collaboration"
   Hong et al., 2024, ICLR   →  03-verwandte-arbeiten
   Decision: ___
```

### Step 3: Process Decisions

For each paper, the human chooses one of three options:

#### YES — Approve
1. Paper is moved from `pending-papers.json` to `approved-papers.json`
2. A BibLaTeX entry is generated and added to `references.bib`
3. The paper's status in `pending-papers.json` is updated to `approved`
4. The `approved_date` is recorded

#### NO — Reject
1. The paper's status in `pending-papers.json` is updated to `rejected`
2. A `rejection_reason` field is added (provided by human or prompted)
3. The paper is NOT removed from `pending-papers.json` (audit trail)
4. The paper will not be presented again unless explicitly requested

#### LATER — Defer
1. The paper remains in `pending-papers.json` with status `pending`
2. No changes are made
3. The paper will appear in the next review session

## File Management

### pending-papers.json
- **Location**: `thesis/latex/bibliography/pending-papers.json`
- **Managed by**: research-scout (adds entries), citation-gatekeeper (updates status)
- **Format**: Array of paper objects (see research-scout SKILL.md for schema)

### approved-papers.json
- **Location**: `thesis/latex/bibliography/approved-papers.json`
- **Managed by**: citation-gatekeeper (sole writer)
- **Format**:

```json
[
  {
    "id": "sem-scholar-abc123",
    "bibtex_key": "qian2024chatdev",
    "title": "Communicative Agents for Software Development",
    "authors": ["Chen Qian", "Xin Cong", "Wei Liu"],
    "year": 2024,
    "venue": "ACL 2024",
    "approved_date": "2026-02-22",
    "approved_for_chapters": ["03-verwandte-arbeiten"],
    "notes": "Good comparison to our approach. They use role-based chat, we use tool-calling orchestration.",
    "url": "https://arxiv.org/abs/2307.07924"
  }
]
```

### references.bib
- **Location**: `thesis/latex/bibliography/references.bib`
- **Managed by**: citation-gatekeeper (sole writer)
- **Format**: BibLaTeX entries

```bibtex
@inproceedings{qian2024chatdev,
  author    = {Qian, Chen and Cong, Xin and Liu, Wei and others},
  title     = {Communicative Agents for Software Development},
  booktitle = {Proceedings of the 62nd Annual Meeting of the Association
               for Computational Linguistics (ACL)},
  year      = {2024},
  url       = {https://arxiv.org/abs/2307.07924},
  doi       = {10.18653/v1/2024.acl-long.1},
}

@article{schick2023toolformer,
  author    = {Schick, Timo and Dwivedi-Yu, Jane and Dess{\`i}, Roberto
               and others},
  title     = {Toolformer: Language Models Can Teach Themselves to Use Tools},
  journal   = {Advances in Neural Information Processing Systems (NeurIPS)},
  year      = {2023},
  volume    = {36},
  url       = {https://arxiv.org/abs/2302.04761},
}
```

### BibLaTeX Entry Rules

- Use proper entry types: `@article`, `@inproceedings`, `@book`, `@thesis`, `@online`, `@report`
- Handle German characters with LaTeX encoding: `{\"u}` for ue, `{\"a}` for ae, `{\"o}` for oe, `{\ss}` for ss
- Use `and` to separate authors, with `and others` for long author lists
- Include `doi` when available
- Include `url` always
- Use consistent key format: `[firstauthor_lastname][year][keyword]` (e.g., `qian2024chatdev`)
- For German-language sources, add `langid = {german}` field

## Validation Capabilities

### Audit Citations by Chapter
Show all `\cite{}` commands in a given chapter and their approval status:

```
--- Citation Audit: 04-konzept ---

\cite{qian2024chatdev}     → APPROVED (2026-02-22)
\cite{wu2024autogen}       → APPROVED (2026-02-20)
\cite{TODO:mcp-spec}       → TODO PLACEHOLDER (needs real paper)
\cite{smith2023agents}     → NOT FOUND in approved list!
```

### Find Orphan Citations
Detect `\cite{}` commands in `.tex` files that reference keys not present in `references.bib`:

```
--- Orphan Citations Found ---

04-konzept.tex:42     \cite{smith2023agents}     → Key not in references.bib
05-impl.tex:118       \cite{jones2024mcp}        → Key not in references.bib

Action: These must either be approved through the gatekeeper or removed.
```

### Find Unused Approved Papers
Detect papers in `approved-papers.json` / `references.bib` that are never cited in any `.tex` file:

```
--- Unused Approved Papers ---

mueller2024survey    "A Survey on Agent Architectures"
  Approved: 2026-02-15
  Approved for: 03-verwandte-arbeiten
  Cited in: NOWHERE

Action: Either cite in an appropriate section or consider removing from bibliography.
```

### Find TODO Citations
Scan all `.tex` files for `\cite{TODO:*}` placeholders:

```
--- TODO Citations ---

02-grundlagen.tex:28    \cite{TODO:mas-history}
  Context: "Multi-Agenten-Systeme wurden erstmals formalisiert"
  Need: Foundational MAS paper (Wooldridge, Jennings era)

04-konzept.tex:95       \cite{TODO:mcp-specification}
  Context: "Das MCP definiert einen standardisierten Kanal"
  Need: Official MCP specification or announcement

Total: 7 TODO citations remaining
```

## Integration with Other Skills

| Skill | Interaction |
|-------|-------------|
| research-scout | Writes to pending-papers.json; gatekeeper reads and processes |
| draft-writer | Uses `\cite{TODO:topic}` placeholders; gatekeeper resolves them |
| thesis-structure | Provides chapter IDs for `approved_for_chapters` mapping |
| code-to-thesis | No direct interaction (code references are not citations) |

## Rules

1. **No paper enters references.bib without explicit human YES** -- this is absolute
2. **Only this skill writes to references.bib** -- no other skill, no manual edits without going through the gatekeeper
3. **Only this skill writes to approved-papers.json** -- single source of truth for approvals
4. **Rejected papers stay in pending-papers.json** -- never deleted, marked as rejected for audit trail
5. **Every approval is dated** -- `approved_date` is always recorded
6. **The human can revoke approval** -- remove from approved, remove from references.bib, update status
7. **Regular audits are encouraged** -- run orphan/unused/TODO checks before any major milestone
8. **BibTeX keys are stable** -- once a key is assigned and used in `.tex` files, it must not change
