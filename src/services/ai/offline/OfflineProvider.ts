/**
 * NoteGenius – Offline AI Provider.
 * Wraps the existing local NLP pipeline (TextRank, rule-based extraction,
 * lexicon sentiment) behind the IAiProvider interface.
 * Runs fully on-device – no network required.
 */
import { analyzeSentimentBatch } from "../../nlp/sentiment";
import { extractKeywords, splitSentences, textRank } from "../../nlp/textrank";
import type {
  AiFlashcardResult,
  AiSummaryResult,
  IAiProvider,
} from "../AiProvider";

// ─── Cue patterns (mirrored from localSummarizer) ──────────────────────────
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

// ─── Internal helpers ───────────────────────────────────────────────────────

function extractDecisions(sentences: string[]): string[] {
  return sentences
    .filter((s) => DECISION_CUES.some((cue) => cue.test(s)))
    .slice(0, 10);
}

function extractActionItems(
  sentences: string[],
  userName: string,
): { owner: string; task: string; due?: string }[] {
  const items: { owner: string; task: string; due?: string }[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const cue of ACTION_CUES) {
      const match = sentence.match(cue);
      if (match) {
        const task = match[1]?.trim() || sentence.trim();
        if (task.length < 5 || seen.has(task.toLowerCase())) continue;
        seen.add(task.toLowerCase());

        let owner = userName;
        const subjectMatch = sentence.match(/^([\w]+)\s+(?:will|need|should)/i);
        if (subjectMatch) {
          const subject = subjectMatch[1].toLowerCase();
          if (!["i", "we"].includes(subject)) owner = subjectMatch[1];
        }

        let due: string | undefined;
        const dateMatch = sentence.match(
          /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\s+week|end\s+of\s+(?:day|week|month)|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
        );
        if (dateMatch) due = dateMatch[1];

        items.push({ owner, task, due });
        break;
      }
    }
  }
  return items;
}

function extractTopics(text: string): string[] {
  const keywords = extractKeywords(text, 20);
  return keywords
    .filter((kw) => kw.length > 3)
    .slice(0, 10)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function generateFollowUps(topics: string[]): string[] {
  const followUps: string[] = [];
  const usedStarters = new Set<number>();

  for (const topic of topics.slice(0, 5)) {
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── OfflineProvider ────────────────────────────────────────────────────────

export const OfflineProvider: IAiProvider = {
  label: "Offline (on-device)",

  async summarize(
    transcript: string,
    userName: string,
  ): Promise<AiSummaryResult> {
    const sentences = splitSentences(transcript);

    const topIndices = textRank(sentences, Math.min(5, sentences.length));
    const tldr = topIndices.sort((a, b) => a - b).map((i) => sentences[i]);

    const keyPointIndices = textRank(sentences, Math.min(10, sentences.length));
    const keyPoints = keyPointIndices
      .sort((a, b) => a - b)
      .map((i) => sentences[i]);

    const decisions = extractDecisions(sentences);
    const actionItems = extractActionItems(sentences, userName);
    const openQuestions = sentences
      .filter((s) => s.trim().endsWith("?"))
      .slice(0, 10);
    const topics = extractTopics(transcript);

    const highlightIndices = textRank(
      sentences,
      Math.min(10, sentences.length),
    );
    const highlights = highlightIndices
      .sort((a, b) => a - b)
      .map((i) => sentences[i])
      .filter((s) => s.length > 20);

    const followUps = generateFollowUps(topics);

    // Split transcript back into rough "segments" for sentiment
    const segmentTexts = transcript.split(/\.\s+/).filter(Boolean);
    const sentimentBySegment = analyzeSentimentBatch(segmentTexts);

    return {
      tldr,
      keyPoints,
      decisions,
      actionItems,
      openQuestions,
      topics,
      highlights,
      followUps,
      sentimentBySegment,
    };
  },

  async generateTitle(transcript: string): Promise<string> {
    try {
      const keywords = extractKeywords(transcript.slice(0, 2_000), 5);
      if (keywords.length === 0) return "";
      const meaningful = keywords.filter((k) => k.length > 3).slice(0, 4);
      const words = meaningful.length > 0 ? meaningful : keywords.slice(0, 3);
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    } catch (err) {
      console.warn("[OfflineProvider] generateTitle failed:", err);
      return "";
    }
  },

  async generateFlashcards(
    transcript: string,
    summary: AiSummaryResult | null,
  ): Promise<AiFlashcardResult[]> {
    const cards: AiFlashcardResult[] = [];
    const topics = summary?.topics ?? extractTopics(transcript);
    const keyPoints = summary?.keyPoints ?? [];
    const highlights = summary?.highlights ?? [];

    // Q&A from key points
    for (const point of keyPoints) {
      const tokens = point.split(/\s+/);
      const question =
        tokens.length > 3
          ? `What is the key point about: "${tokens.slice(0, 5).join(" ")}..."?`
          : `Explain: ${point}`;
      cards.push({
        type: "qa",
        front: question,
        back: point,
        tags: topics.slice(0, 3),
      });
    }

    // Cloze from highlights + key points
    const clozeSource = [...highlights, ...keyPoints];
    for (const sentence of clozeSource) {
      const kws = extractKeywords(sentence, 3);
      if (kws.length === 0) continue;
      const keyword = kws[0];
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
      if (!regex.test(sentence)) continue;
      const front = sentence.replace(regex, "[___]");
      cards.push({
        type: "cloze",
        front,
        back: keyword,
        tags: topics.slice(0, 3),
      });
    }

    // Term-Definition pairs
    for (const topic of topics) {
      const related = keyPoints.find((kp) =>
        kp.toLowerCase().includes(topic.toLowerCase()),
      );
      if (related) {
        cards.push({
          type: "term-def",
          front: `Define: ${topic}`,
          back: related,
          tags: [topic],
        });
        cards.push({
          type: "def-term",
          front: related,
          back: topic,
          tags: [topic],
        });
      }
    }

    // Action-item cards
    if (summary) {
      for (const item of summary.actionItems) {
        cards.push({
          type: "qa",
          front: `What action item was assigned to ${item.owner}?`,
          back: item.task + (item.due ? ` (due: ${item.due})` : ""),
          tags: ["action-item"],
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return cards.filter((c) => {
      const key = c.front.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};
