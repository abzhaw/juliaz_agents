---
name: latex-builder
description: Lokale LaTeX-Kompilierung auf dem Mac Mini. Fehlerbehandlung, Paketverwaltung, Template-Setup. Kompiliert die Thesis zu PDF.
---

# LaTeX Builder

Handles all aspects of local LaTeX compilation on the Mac Mini. Manages the build pipeline, resolves errors, configures packages, and produces the final PDF. No cloud services -- everything runs locally.

## Compilation Pipeline

### Primary Method: latexmk

The recommended approach for building the thesis. Handles all intermediate steps automatically.

```bash
cd thesis/latex
latexmk -pdf -interaction=nonstopmode main.tex
```

Flags:
- `-pdf`: Produce PDF output (via pdflatex)
- `-interaction=nonstopmode`: Do not stop on errors (log them and continue)
- Add `-silent` to suppress most console output during clean builds
- Add `-f` to force compilation even after errors (useful for debugging)

### Manual Compilation Sequence

When latexmk is unavailable or for debugging specific steps:

```bash
cd thesis/latex
pdflatex -interaction=nonstopmode main.tex    # First pass: generate .aux files
biber main                                      # Process bibliography
pdflatex -interaction=nonstopmode main.tex    # Second pass: resolve citations
pdflatex -interaction=nonstopmode main.tex    # Third pass: resolve cross-references
```

Important: This project uses **biber** (not bibtex) because BibLaTeX is the bibliography backend. Running `bibtex` instead of `biber` will produce errors about missing .bbl files or garbled citations.

### Continuous Compilation (Live Preview)

For active writing sessions where you want the PDF to update on every save:

```bash
cd thesis/latex
latexmk -pdf -pvc main.tex
```

The `-pvc` flag enables "preview continuously" mode. latexmk watches for file changes and recompiles automatically. Pair with a PDF viewer that supports auto-reload (e.g., Skim on macOS, configured with `latexmk -pvc -view=none` if using a separate viewer).

### Clean Build

Remove all auxiliary files and rebuild from scratch. Useful when the build state is corrupted.

```bash
cd thesis/latex
latexmk -C                    # Remove all generated files including PDF
latexmk -pdf main.tex         # Full rebuild
```

Or manually:
```bash
cd thesis/latex
rm -f *.aux *.bbl *.bcf *.blg *.fdb_latexmk *.fls *.log *.out *.run.xml *.toc *.lof *.lot *.synctex.gz
pdflatex main.tex && biber main && pdflatex main.tex && pdflatex main.tex
```

## Prerequisites

### Full Installation (Recommended)

```bash
brew install --cask mactex
```

This installs the complete TeX Live distribution (~4 GB). Includes all packages, all fonts, and all tools. No need to install additional packages manually.

After installation, ensure the PATH includes the TeX binaries:
```bash
eval "$(/usr/libexec/path_helper)"
# Or add to ~/.zshrc:
export PATH="/Library/TeX/texbin:$PATH"
```

### Minimal Installation (Alternative)

```bash
brew install --cask basictex
```

BasicTeX is much smaller (~100 MB) but requires manual installation of additional packages. After installing BasicTeX:

```bash
# Update package manager
sudo tlmgr update --self

# Install required packages for this thesis
sudo tlmgr install \
    babel-german \
    biblatex \
    biber \
    csquotes \
    microtype \
    tikz \
    pgfplots \
    minted \
    listings \
    xcolor \
    hyperref \
    cleveref \
    geometry \
    fancyhdr \
    setspace \
    titlesec \
    tocloft \
    appendix \
    booktabs \
    caption \
    subcaption \
    float \
    enumitem \
    parskip \
    glossaries \
    acronym \
    todonotes \
    latexmk
```

### Verify Installation

```bash
# Check all tools are available
pdflatex --version
biber --version
latexmk --version

# Check a specific package is installed
kpsewhich biblatex.sty
kpsewhich tikz.sty
```

## German-Specific Package Setup

The thesis is written in German. The following packages and configurations are essential.

### Core German Language Support

```latex
% In preamble of main.tex:

% Encoding and fonts
\usepackage[T1]{fontenc}           % Proper output encoding for umlauts
\usepackage[utf8]{inputenc}        % UTF-8 input (default in modern LaTeX but explicit is safer)
\usepackage{lmodern}               % Latin Modern font (clean, scalable)

% German language
\usepackage[ngerman]{babel}        % New German hyphenation and localization
                                   % Changes "Chapter" to "Kapitel",
                                   % "Table of Contents" to "Inhaltsverzeichnis", etc.

% German quotation marks
\usepackage[autostyle=true]{csquotes}
% Usage: \enquote{Text} produces German-style quotation marks
% Nested: \enquote{Aussen \enquote{Innen} Aussen}

% Typography refinement
\usepackage{microtype}             % Better character protrusion and font expansion
                                   % Makes text look significantly more professional
```

### BibLaTeX Configuration

```latex
% Bibliography with BibLaTeX (NOT bibtex)
\usepackage[
    backend=biber,          % Use biber as backend processor
    style=alphabetic,       % Citation style: [Doe23] -- common in German CS theses
    sorting=nyt,            % Sort by name, year, title
    maxbibnames=99,         % Show all authors in bibliography
    maxcitenames=2,         % Show max 2 authors in citations, then "et al."
    giveninits=true,        % Abbreviate first names in bibliography
    uniquename=init,        % Disambiguate by initials
    url=true,               % Show URLs in bibliography
    doi=true,               % Show DOIs
    isbn=false,             % Hide ISBNs (usually not needed)
    eprint=false            % Hide eprint info
]{biblatex}

\addbibresource{bibliography/references.bib}

% At end of document (before \end{document}):
\printbibliography[heading=bibintoc, title={Literaturverzeichnis}]
```

Alternative citation styles common in German theses:
- `style=alphabetic` -- `[Doe23]` -- most common in German CS
- `style=numeric` -- `[1]` -- compact but less informative
- `style=authoryear` -- `(Doe, 2023)` -- common in social sciences

## Thesis Template Setup

### Page Layout

```latex
\usepackage[
    a4paper,
    left=3cm,               % Extra space on left for binding
    right=2.5cm,
    top=2.5cm,
    bottom=2.5cm,
    bindingoffset=0.5cm     % Additional binding offset
]{geometry}
```

### Line Spacing

```latex
\usepackage{setspace}
\onehalfspacing             % 1.5 line spacing (standard for German theses)
% Use \singlespacing in code listings and captions if needed
```

### Headers and Footers

```latex
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}                          % Clear all headers/footers
\fancyhead[L]{\leftmark}            % Chapter name on the left
\fancyhead[R]{\thepage}             % Page number on the right
\renewcommand{\headrulewidth}{0.4pt}
\renewcommand{\footrulewidth}{0pt}

% Plain style for chapter opening pages
\fancypagestyle{plain}{
    \fancyhf{}
    \fancyfoot[C]{\thepage}
    \renewcommand{\headrulewidth}{0pt}
}
```

### Code Listings

Option A: `minted` (requires Python's Pygments, better syntax highlighting)

```latex
\usepackage{minted}
\setminted{
    fontsize=\footnotesize,
    linenos=true,
    frame=single,
    framesep=2mm,
    breaklines=true,
    tabsize=2
}

% Usage:
% \begin{minted}{typescript}
% const julia = new Orchestrator();
% \end{minted}

% Note: Requires compilation with -shell-escape flag:
% pdflatex -shell-escape main.tex
% latexmk -pdf -shell-escape main.tex
```

Option B: `listings` (no external dependencies, simpler)

```latex
\usepackage{listings}
\lstset{
    basicstyle=\ttfamily\footnotesize,
    numbers=left,
    numberstyle=\tiny,
    frame=single,
    breaklines=true,
    tabsize=2,
    captionpos=b,
    showstringspaces=false,
    keywordstyle=\color{blue},
    commentstyle=\color{green!60!black},
    stringstyle=\color{red!70!black}
}

% Usage:
% \begin{lstlisting}[language=Java, caption={Orchestrator-Initialisierung}]
% const julia = new Orchestrator();
% \end{lstlisting}
```

### Chapter and Section Formatting

```latex
\usepackage{titlesec}

% Optional: customize chapter heading appearance
\titleformat{\chapter}[display]
    {\normalfont\huge\bfseries}    % Format
    {\chaptertitlename\ \thechapter}  % Label
    {20pt}                          % Separation between label and title
    {\Huge}                         % Before-code for title text
```

## Error Handling

### Reading the Log File

After a failed compilation, parse `main.log` for errors:

```bash
# Find all errors in the log
grep -n "^!" thesis/latex/main.log

# Find undefined references
grep "undefined" thesis/latex/main.log

# Find missing files
grep "File .* not found" thesis/latex/main.log

# Find missing packages
grep "LaTeX Error: File .* not found" thesis/latex/main.log
```

### Common Errors and Fixes

**Missing package:**
```
! LaTeX Error: File `csquotes.sty' not found.
```
Fix: `sudo tlmgr install csquotes`

**Undefined control sequence (typo in command):**
```
! Undefined control sequence.
l.42 \beginn{document}
```
Fix: Check for typos. `\beginn` should be `\begin`.

**Undefined reference:**
```
LaTeX Warning: Reference `sec:architektur' on page 12 undefined.
```
Fix: Check that `\label{sec:architektur}` exists somewhere. May need another compilation pass.

**Missing bibliography entry:**
```
Package biblatex Warning: Citation 'doe2023' undefined.
```
Fix: Ensure the key exists in `bibliography/references.bib` and run `biber main`.

**Encoding issues with umlauts:**
```
! Package inputenc Error: Unicode character ae (U+00E4) not set up for use with LaTeX.
```
Fix: Ensure `\usepackage[utf8]{inputenc}` and `\usepackage[T1]{fontenc}` are in the preamble.

**Overfull hbox (text exceeding margins):**
```
Overfull \hbox (15.2pt too wide) in paragraph at lines 120--125
```
Fix: Rephrase the text, add `\allowbreak`, or use `\sloppy` locally. For URLs, use `\url{}` with the `url` package. For code, ensure `breaklines=true` in listings.

**Biber cannot find .bcf file:**
```
INFO - This is Biber ...
ERROR - Cannot find control file 'main.bcf'!
```
Fix: Run `pdflatex main.tex` first to generate the .bcf file, then run `biber main`.

## Validation Checks

Run these checks before considering a build "successful":

### 1. All Graphics Files Exist

```bash
# Extract all \includegraphics references and check they exist
grep -oP '\\includegraphics(\[.*?\])?\{(.*?)\}' thesis/latex/main.tex thesis/latex/chapters/*.tex | \
    grep -oP '\{(.*?)\}' | tr -d '{}' | while read f; do
    if [ ! -f "thesis/latex/$f" ] && [ ! -f "thesis/latex/$f.pdf" ] && [ ! -f "thesis/latex/$f.png" ]; then
        echo "MISSING: $f"
    fi
done
```

### 2. All Citation Keys Exist

```bash
# Extract all \cite{} keys and check against references.bib
grep -oP '\\cite\{(.*?)\}' thesis/latex/chapters/*.tex | grep -oP '\{(.*?)\}' | tr -d '{}' | \
    tr ',' '\n' | sort -u | while read key; do
    if ! grep -q "@.*{${key}," thesis/latex/bibliography/references.bib; then
        echo "MISSING CITATION: $key"
    fi
done
```

### 3. No Orphan References

```bash
# Check for undefined references in the log
grep -c "undefined" thesis/latex/main.log
# Should be 0 after a clean build
```

### 4. No Critical Warnings

```bash
# Check for overfull boxes exceeding tolerance
grep "Overfull.*hbox" thesis/latex/main.log | grep -v "badness"

# Check for missing characters
grep "Missing character" thesis/latex/main.log
```

### 5. TODO Markers

```bash
# Find remaining TODO markers in tex files
grep -rn "TODO" thesis/latex/chapters/ thesis/latex/main.tex
# These should be resolved before final submission
```

## Word Count

Use `texcount` to get word counts per chapter:

```bash
# Overall word count
texcount thesis/latex/main.tex -inc -total

# Per-file breakdown
texcount thesis/latex/chapters/*.tex -inc

# Detailed count (headers, captions, etc. separated)
texcount thesis/latex/main.tex -inc -v
```

If `texcount` is not installed:
```bash
sudo tlmgr install texcount
# or
brew install texcount
```

## Project File Structure

Expected directory layout for the thesis:

```
thesis/latex/
    main.tex                          # Root document
    bibliography/
        references.bib                # BibLaTeX bibliography database
    chapters/
        01-einleitung.tex             # Einleitung
        02-verwandte-arbeiten.tex     # Verwandte Arbeiten
        03-grundlagen.tex             # Grundlagen
        04-konzept.tex                # Konzept und Entwurf
        05-implementierung.tex        # Implementierung
        06-evaluation.tex             # Evaluation
        07-fazit.tex                  # Fazit und Ausblick
    figures/
        fig-04-systemarchitektur.tex  # TikZ figures
        fig-05-nachrichtenfluss.tex
        ...
    frontmatter/
        titlepage.tex                 # Titelseite
        abstract.tex                  # Zusammenfassung / Abstract
        declaration.tex               # Eidesstattliche Erklaerung
        acknowledgments.tex           # Danksagung (optional)
    appendix/
        appendix-a.tex                # Anhang
```

### main.tex Structure

```latex
\documentclass[12pt, a4paper, twoside, openright]{report}

% Packages (as detailed above)
...

\begin{document}

% Front matter (Roman page numbers)
\frontmatter
\input{frontmatter/titlepage}
\input{frontmatter/declaration}
\input{frontmatter/abstract}
\tableofcontents
\listoffigures
\listoftables

% Main content (Arabic page numbers)
\mainmatter
\input{chapters/01-einleitung}
\input{chapters/02-verwandte-arbeiten}
\input{chapters/03-grundlagen}
\input{chapters/04-konzept}
\input{chapters/05-implementierung}
\input{chapters/06-evaluation}
\input{chapters/07-fazit}

% Bibliography
\printbibliography[heading=bibintoc, title={Literaturverzeichnis}]

% Appendix
\appendix
\input{appendix/appendix-a}

\end{document}
```

## Build Automation

### latexmkrc Configuration

Create a `.latexmkrc` file in the thesis/latex directory for project-specific build settings:

```perl
# thesis/latex/.latexmkrc
$pdf_mode = 1;                    # Generate PDF via pdflatex
$bibtex_use = 2;                  # Use biber (detected automatically by latexmk)
$pdflatex = 'pdflatex -interaction=nonstopmode -shell-escape %O %S';
$clean_ext = 'bbl bcf run.xml synctex.gz';  # Additional files to clean
```

With this file in place, simply running `latexmk` in the thesis/latex directory will do the right thing.

## Troubleshooting Checklist

When the build fails:

1. Read the first error in `main.log` (later errors are often cascading)
2. Check if it is a missing package (install via `tlmgr`)
3. Check if it is a syntax error (typo in a command)
4. Check if it is a missing file (figure, bibliography, input)
5. Try a clean build (`latexmk -C && latexmk -pdf`)
6. Check that `biber` (not `bibtex`) is being used
7. Verify the compilation flag `-shell-escape` if using `minted`
8. Check that all `\input{}` paths are correct relative to main.tex
