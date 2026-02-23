---
name: rag-retrieval-patterns
description: Retrieval-augmented generation patterns — chunking, embedding, vector search, and reranking. Use when Julia needs to search through documents, research papers, logs, or knowledge bases.
---

# RAG Retrieval Patterns

## Core Pipeline
```
Documents → Chunk → Embed → Store → Query → Retrieve → Augment Prompt → LLM
```

## Chunking Strategies
```ts
// Fixed-size chunks with overlap (simple & effective)
function chunkText(text: string, size = 512, overlap = 50): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

// Sentence-based chunking (better for prose/thesis)
const chunks = text.split(/[.!?]+\s/).filter(s => s.length > 50);
```

## Embedding (OpenAI)
```ts
const response = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: chunks,
});
const vectors = response.data.map(d => d.embedding);
```

## Simple In-Memory Vector Search (for small corpora)
```ts
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}

function search(query: number[], store: {text: string, vec: number[]}[], k = 5) {
  return store
    .map(item => ({ ...item, score: cosineSimilarity(query, item.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
```

## Augmented Prompt Pattern
```ts
const results = await search(queryEmbedding, knowledgeBase, 5);
const context = results.map(r => r.text).join('\n\n---\n\n');
const prompt = `Answer based on this context:\n\n${context}\n\nQuestion: ${question}`;
```

## Julia Use Cases
- **Thesis agent**: RAG over research PDFs in `thesis/research_papers/`
- **Security agent**: RAG over past security reports for pattern detection
- **Orchestrator**: RAG over past conversation logs for memory continuity
