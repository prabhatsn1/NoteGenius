/**
 * NoteGenius – TextRank-based sentence ranking.
 * Pure JS implementation (no network required).
 *
 * Algorithm:
 * 1. Split text into sentences
 * 2. Tokenize each sentence
 * 3. Build similarity graph using word overlap (TF-IDF light)
 * 4. Run iterative PageRank to score sentences
 * 5. Return top-N sentences by rank
 */

/** Split text into sentences using regex heuristics. */
export function splitSentences(text: string): string[] {
  // Split on period/exclamation/question followed by space or end
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.map((s) => s.trim()).filter((s) => s.length > 10); // skip very short fragments
}

/** Basic tokenizer: lowercase, strip punctuation, split on whitespace. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Compute word frequency map. */
export function wordFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

/** Compute cosine similarity between two token frequency vectors. */
function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  for (const key of allKeys) {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    dotProduct += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Run TextRank on sentences; returns indices sorted by rank (descending). */
export function textRank(sentences: string[], topN = 5): number[] {
  const n = sentences.length;
  if (n === 0) return [];
  if (n <= topN) return sentences.map((_, i) => i);

  // Tokenize each sentence
  const tokenized = sentences.map(tokenize);
  const freqs = tokenized.map(wordFrequency);

  // Build adjacency matrix (cosine similarity)
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(freqs[i], freqs[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  // PageRank iteration
  const damping = 0.85;
  const maxIter = 50;
  const threshold = 0.0001;
  let scores = new Array(n).fill(1 / n);

  for (let iter = 0; iter < maxIter; iter++) {
    const newScores = new Array(n).fill(0);
    let delta = 0;

    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const outSum = matrix[j].reduce((a, b) => a + b, 0);
        if (outSum > 0) {
          sum += (matrix[j][i] / outSum) * scores[j];
        }
      }
      newScores[i] = (1 - damping) / n + damping * sum;
      delta += Math.abs(newScores[i] - scores[i]);
    }

    scores = newScores;
    if (delta < threshold) break;
  }

  // Return top-N indices sorted by score
  const indexed = scores.map((score, i) => ({ score, i }));
  indexed.sort((a, b) => b.score - a.score);
  return indexed.slice(0, topN).map((x) => x.i);
}

/** Extract top keywords using RAKE-like approach. */
export function extractKeywords(text: string, topN = 15): string[] {
  const tokens = tokenize(text);
  const freq = wordFrequency(tokens);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, topN).map(([word]) => word);
}

// ─── Stop Words ─────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "it",
  "its",
  "this",
  "that",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "not",
  "no",
  "nor",
  "so",
  "if",
  "then",
  "than",
  "too",
  "very",
  "just",
  "about",
  "above",
  "after",
  "again",
  "all",
  "also",
  "am",
  "any",
  "because",
  "before",
  "between",
  "both",
  "each",
  "few",
  "get",
  "got",
  "here",
  "how",
  "into",
  "more",
  "most",
  "much",
  "must",
  "my",
  "new",
  "now",
  "only",
  "other",
  "our",
  "out",
  "own",
  "same",
  "she",
  "some",
  "such",
  "there",
  "these",
  "they",
  "those",
  "through",
  "under",
  "until",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "you",
  "your",
  "we",
  "he",
  "her",
  "him",
  "his",
  "me",
  "them",
  "us",
]);
