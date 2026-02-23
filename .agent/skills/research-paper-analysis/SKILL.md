---
name: research-paper-analysis
description: Extracting key points, methodology analysis, literature review patterns. Use when Julia's thesis agent needs to process research papers for Raphael's master's thesis.
---

# Research Paper Analysis

## Key Extraction Framework
```
For each paper, extract:
1. Research question / hypothesis
2. Methodology (quantitative/qualitative/mixed)
3. Key findings (3-5 bullet points)
4. Limitations acknowledged by authors
5. Relevance to Raphael's thesis topic
6. Citation key (AuthorYear format)
```

## Prompt for LLM Analysis
```
Analyze this research paper and extract:
1. **Research Question**: What question does the paper answer?
2. **Methodology**: How was the research conducted?
3. **Key Findings**: Top 3-5 findings (German: Kernaussagen)
4. **Limitations**: What do the authors acknowledge as limitations?
5. **Thesis Relevance**: How does this relate to [thesis topic]?

Format as JSON with these exact keys:
research_question, methodology, findings, limitations, relevance
```

## Literature Review Structure
```markdown
## Literaturüberblick

### Themenbereich 1: [topic]
[Author1, Year] untersucht... und kommt zu dem Schluss, dass...
Im Gegensatz dazu zeigt [Author2, Year], dass...
Diese Befunde werden durch [Author3, Year] gestützt.

### Forschungslücke
Die vorliegende Literatur zeigt, dass [gap] bisher nicht
ausreichend erforscht wurde.
```

## PDF Processing (Node.js)
```bash
# Extract text from PDF
npx pdf2json input.pdf output.json

# Or using pdftotext (poppler)
pdftotext paper.pdf paper.txt
```
