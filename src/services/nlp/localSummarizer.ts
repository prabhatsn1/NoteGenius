/**
 * NoteGenius – Local summarizer (Einstein-style features).
 * Pure JS – works fully offline without network.
 *
 * Pipeline:
 * 1. Combine all segments into full text
 * 2. TextRank → extract top sentences → TL;DR + Key Points
 * 3. Rule-based cue detection → Decisions, Action Items
 * 4. Keyword clustering → Topics
 * 5. Interrogative generation → Follow-up Questions
 * 6. Named entity + quote extraction → Smart Highlights
 * 7. Lexicon sentiment → Sentiment per segment
 */
import type { ActionItem, NoteSegment, Summary } from "../../types/models";
import { generateId } from "../../utils/uuid";
import { analyzeSentimentBatch } from "./sentiment";
import { extractKeywords, splitSentences, textRank } from "./textrank";

// ─── Cue patterns for rule-based extraction ────────────────────────────────
const DECISION_CUES = [
  /we decided/i,
  /it was decided/i,
  /the decision is/i,
  /we agreed/i,
  /agreed to/i,
  /will go with/i,
  /final decision/i,
  /conclusion is/i,
  /we'll proceed/i,
  /approved/i,
  /let's go ahead/i,
];

const ACTION_CUES = [
  /(?:i|we|he|she|they|you)\s+will\s+(.+)/i,
  /(?:i|we|he|she|they|you)\s+need\s+to\s+(.+)/i,
  /please\s+(.+)/i,
  /action\s*item[:\s]+(.+)/i,
  /todo[:\s]+(.+)/i,
  /(?:i|we|he|she|they|you)\s+should\s+(.+)/i,
  /make sure\s+(.+)/i,
  /follow\s+up\s+(?:on|with)\s+(.+)/i,
];

const QUESTION_STARTERS = [
  "Who is responsible for",
  "When will",
  "What is the timeline for",
  "Why was",
  "How will we handle",
  "What are the next steps for",
  "Who will follow up on",
  "What is the status of",
];

/**
 * Parse action items with owner detection.
 * Default owner = userName if no explicit owner found.
 */
function extractActionItems(
  sentences: string[],
  userName: string,
): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const cue of ACTION_CUES) {
      const match = sentence.match(cue);
      if (match) {
        const task = match[1]?.trim() || sentence.trim();
        if (task.length < 5 || seen.has(task.toLowerCase())) continue;
        seen.add(task.toLowerCase());

        // Try to detect owner from subject
        let owner = userName;
        const subjectMatch = sentence.match(/^([\w]+)\s+(?:will|need|should)/i);
        if (subjectMatch) {
          const subject = subjectMatch[1].toLowerCase();
          if (!["i", "we"].includes(subject)) {
            owner = subjectMatch[1];
          }
        }

        // Try to detect due date cues
        let due: string | undefined;
        const dateMatch = sentence.match(
          /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\s+week|end\s+of\s+(?:day|week|month)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
        );
        if (dateMatch) {
          due = dateMatch[1];
        }

        items.push({ owner, task, due });
        break; // one match per sentence
      }
    }
  }

  return items;
}

/** Extract sentences matching decision cues. */
function extractDecisions(sentences: string[]): string[] {
  const decisions: string[] = [];
  for (const s of sentences) {
    if (DECISION_CUES.some((cue) => cue.test(s))) {
      decisions.push(s.trim());
    }
  }
  return decisions.slice(0, 10);
}

/** Extract open questions (sentences ending with ?). */
function extractOpenQuestions(sentences: string[]): string[] {
  return sentences.filter((s) => s.trim().endsWith("?")).slice(0, 10);
}

/** Generate follow-up questions from topics/keywords. */
function generateFollowUps(topics: string[], sentences: string[]): string[] {
  const followUps: string[] = [];
  const usedStarters = new Set<number>();

  for (const topic of topics.slice(0, 5)) {
    // Pick a random question starter
    let idx = Math.floor(Math.random() * QUESTION_STARTERS.length);
    while (
      usedStarters.has(idx) &&
      usedStarters.size < QUESTION_STARTERS.length
    ) {
      idx = (idx + 1) % QUESTION_STARTERS.length;
    }
    usedStarters.add(idx);
    followUps.push(`${QUESTION_STARTERS[idx]} ${topic}?`);
  }

  return followUps.slice(0, 5);
}

/** Extract salient quotes / highlights using TextRank scores. */
function extractHighlights(sentences: string[]): string[] {
  if (sentences.length === 0) return [];
  const topIndices = textRank(sentences, Math.min(10, sentences.length));
  // Return in original order
  return topIndices
    .sort((a, b) => a - b)
    .map((i) => sentences[i])
    .filter((s) => s.length > 20);
}

/** Cluster keywords into topics. */
function extractTopics(text: string): string[] {
  const keywords = extractKeywords(text, 20);
  // Group similar keywords (simple: just return unique top keywords as topics)
  // A more sophisticated approach would use embedding similarity
  const topics = keywords.filter((kw) => kw.length > 3).slice(0, 10);
  // Capitalize first letter
  return topics.map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

// ─── Summarizer Provider Interface ──────────────────────────────────────────
export interface SummarizerProvider {
  summarize(
    noteId: string,
    segments: NoteSegment[],
    userName: string,
  ): Promise<Summary>;
}

// ─── Local Summarizer ───────────────────────────────────────────────────────
export const localSummarizer: SummarizerProvider = {
  async summarize(
    noteId: string,
    segments: NoteSegment[],
    userName: string,
  ): Promise<Summary> {
    // Combine all segment text
    const fullText = segments.map((s) => s.text).join(". ");
    const sentences = splitSentences(fullText);

    // TextRank for key sentences
    const topIndices = textRank(sentences, Math.min(5, sentences.length));
    const tldr = topIndices.sort((a, b) => a - b).map((i) => sentences[i]);

    const keyPointIndices = textRank(sentences, Math.min(10, sentences.length));
    const keyPoints = keyPointIndices
      .sort((a, b) => a - b)
      .map((i) => sentences[i]);

    // Rule-based extractions
    const decisions = extractDecisions(sentences);
    const actionItems = extractActionItems(sentences, userName);
    const openQuestions = extractOpenQuestions(sentences);
    const topics = extractTopics(fullText);
    const highlights = extractHighlights(sentences);
    const followUps = generateFollowUps(topics, sentences);

    // Sentiment per segment
    const segmentTexts = segments.map((s) => s.text);
    const sentimentBySegment = analyzeSentimentBatch(segmentTexts);

    return {
      id: generateId(),
      noteId,
      tldr,
      keyPoints,
      decisions,
      actionItems,
      openQuestions,
      topics,
      highlights,
      followUps,
      sentimentBySegment,
      createdAt: Date.now(),
      provider: "offline",
    };
  },
};

/**
 * Cloud summarizer stub (provider interface for OpenAI/Azure).
 * Default disabled; can be enabled in Settings.
 */
export const cloudSummarizer: SummarizerProvider = {
  async summarize(
    noteId: string,
    segments: NoteSegment[],
    userName: string,
  ): Promise<Summary> {
    // TODO: Implement cloud API call (OpenAI / Azure / custom endpoint)
    // For now, fallback to local
    console.warn("[CloudSummarizer] Not configured, falling back to local.");
    return localSummarizer.summarize(noteId, segments, userName);
  },
};

/** Get the active summarizer based on settings. */
export function getSummarizer(
  provider: "offline" | "gemini",
): SummarizerProvider {
  return provider === "gemini" ? cloudSummarizer : localSummarizer;
}
