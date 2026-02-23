/**
 * NoteGenius – Naive lexicon-based sentiment analyzer.
 * Returns a score from −1 (very negative) to +1 (very positive).
 * Works fully offline; no network required.
 */

const POSITIVE_WORDS = new Set([
  "good",
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "fantastic",
  "awesome",
  "love",
  "happy",
  "glad",
  "pleased",
  "delighted",
  "perfect",
  "beautiful",
  "brilliant",
  "outstanding",
  "superb",
  "terrific",
  "positive",
  "success",
  "successful",
  "agree",
  "agreed",
  "approval",
  "approve",
  "best",
  "better",
  "celebrate",
  "accomplished",
  "achieve",
  "benefit",
  "comfortable",
  "confident",
  "creative",
  "efficient",
  "enjoy",
  "excited",
  "exciting",
  "favorable",
  "fine",
  "fortunate",
  "helpful",
  "impressive",
  "improved",
  "incredible",
  "inspired",
  "interesting",
  "joyful",
  "nice",
  "optimistic",
  "promising",
  "remarkable",
  "satisfied",
  "smooth",
  "strong",
  "valuable",
  "welcome",
  "win",
  "won",
  "worth",
  "worthy",
  "ready",
  "progress",
  "resolved",
]);

const NEGATIVE_WORDS = new Set([
  "bad",
  "terrible",
  "awful",
  "horrible",
  "poor",
  "worst",
  "hate",
  "angry",
  "sad",
  "disappointed",
  "frustrated",
  "annoyed",
  "upset",
  "fail",
  "failed",
  "failure",
  "wrong",
  "problem",
  "issue",
  "concern",
  "worried",
  "worry",
  "difficult",
  "hard",
  "painful",
  "unfortunately",
  "sadly",
  "regret",
  "unhappy",
  "disagree",
  "rejected",
  "reject",
  "block",
  "blocked",
  "blocker",
  "broken",
  "bug",
  "confusing",
  "complicated",
  "critical",
  "danger",
  "dangerous",
  "delay",
  "delayed",
  "deny",
  "deprecated",
  "destroy",
  "disaster",
  "error",
  "expensive",
  "impossible",
  "inadequate",
  "incomplete",
  "insecure",
  "invalid",
  "lacking",
  "lost",
  "missing",
  "negative",
  "never",
  "nightmare",
  "obsolete",
  "overdue",
  "overwhelm",
  "risk",
  "risky",
  "severe",
  "slow",
  "stuck",
  "threat",
  "trouble",
  "unable",
  "unclear",
  "unfair",
  "unfortunate",
  "unstable",
  "urgent",
  "vulnerable",
  "weak",
]);

const NEGATION_WORDS = new Set([
  "not",
  "n't",
  "no",
  "never",
  "neither",
  "nor",
  "hardly",
  "barely",
  "scarcely",
  "rarely",
  "don't",
  "doesn't",
  "didn't",
  "won't",
  "wouldn't",
  "couldn't",
  "shouldn't",
  "isn't",
  "aren't",
  "wasn't",
]);

/**
 * Compute sentiment score for a text segment.
 * @returns number from -1 to +1
 */
export function analyzeSentiment(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .split(/\s+/);

  let score = 0;
  let wordCount = 0;
  let negated = false;

  for (const word of words) {
    if (NEGATION_WORDS.has(word)) {
      negated = true;
      continue;
    }

    if (POSITIVE_WORDS.has(word)) {
      score += negated ? -1 : 1;
      wordCount++;
      negated = false;
    } else if (NEGATIVE_WORDS.has(word)) {
      score += negated ? 1 : -1;
      wordCount++;
      negated = false;
    } else {
      // Reset negation after 2 non-sentiment words
      negated = false;
    }
  }

  if (wordCount === 0) return 0;
  // Normalize to [-1, +1]
  return Math.max(-1, Math.min(1, score / Math.max(wordCount, 1)));
}

/**
 * Compute sentiment for an array of text segments.
 * Returns array of scores [-1..+1] per segment.
 */
export function analyzeSentimentBatch(segments: string[]): number[] {
  return segments.map(analyzeSentiment);
}
