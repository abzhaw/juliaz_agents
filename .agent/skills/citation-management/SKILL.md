---
name: citation-management
description: APA/AMA/Chicago citations, bibliography generation, DOI lookup. Use when Julia's thesis agent needs to format references for Raphael's master's thesis.
---

# Citation Management

## APA 7th Edition (most common in German universities)

### Journal Article
```
Author, A. A., & Author, B. B. (Year). Title of article. Journal Name, Volume(Issue), Pages. https://doi.org/...

Müller, T., & Schmidt, K. (2024). Multi-agent systems in enterprise environments. 
Journal of AI Research, 15(3), 120–145. https://doi.org/10.xxxx/xxxxx
```

### Book
```
Author, A. A. (Year). Title of book (Edition). Publisher.
```

### Website / Online Source
```
Author, A. A. (Year, Month Day). Title of page. Site Name. URL
```

## In-Text Citations (APA)
```
Einmalige Quelle:       (Müller, 2024)
Direktes Zitat:         (Müller, 2024, S. 23)
Zwei Autoren:           (Müller & Schmidt, 2024)
Drei+ Autoren:          (Müller et al., 2024)
Ohne Autor:             (Kurztitel, Jahr)
```

## DOI Lookup
```bash
# Resolve a DOI to get full citation metadata
curl "https://api.crossref.org/works/10.1234/example" | jq '{
  title: .message.title[0],
  authors: [.message.author[] | "\(.family), \(.given)"],
  year: .message.published."date-parts"[0][0],
  journal: .message["container-title"][0]
}'
```

## Zotero Integration (recommended)
- Export bibliography as `.bib` file
- Include in thesis directory: `thesis/references.bib`
- Use Pandoc + `--citeproc` for automatic formatting

## Common Formatting Notes (German Theses)
- "Literaturverzeichnis" = References section title
- "ebd." = ibid (same source as previous footnote)
- "vgl." = cf. (see also)
- "S." = page (Seite), "Ss." = pages
