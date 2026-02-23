/**
 * NoteGenius – Flashcard auto-generation from summary + transcript.
 *
 * Strategies:
 * 1. Q&A: Turn key points into questions
 * 2. Cloze: Mask key terms in sentences
 * 3. Term-Definition: Extract glossary-like pairs
 * 4. Definition-Term: Reverse of above
 */
import type { Flashcard, NoteSegment, Summary } from "../../types/models";
import { generateId } from "../../utils/uuid";
import { extractKeywords } from "./textrank";

/** Create default flashcard values. */
function makeCard(
  noteId: string,
  type: Flashcard["type"],
  front: string,
  back: string,
  tags: string[] = [],
): Flashcard {
  const now = Date.now();
  return {
    id: generateId(),
    noteId,
    type,
    front,
    back,
    tags,
    difficulty: 3,
    interval: 0,
    repetitions: 0,
    easiness: 2.5,
    nextReviewAt: now, // due immediately for first review
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate Q&A cards from key points.
 * Each key point becomes a question + answer pair.
 */
function generateQACards(
  noteId: string,
  keyPoints: string[],
  topics: string[],
): Flashcard[] {
  return keyPoints.map((point) => {
    // Create a question from the key point
    let question = point;

    // Try to formulate as a question
    if (point.match(/^[A-Z]/)) {
      // Simple heuristic: What is {subject}?
      const tokens = point.split(/\s+/);
      if (tokens.length > 3) {
        question = `What is the key point about: "${tokens.slice(0, 5).join(" ")}..."?`;
      } else {
        question = `Explain: ${point}`;
      }
    }

    return makeCard(noteId, "qa", question, point, topics.slice(0, 3));
  });
}

/**
 * Generate cloze deletion cards.
 * Masks important words in sentences.
 */
function generateClozeCards(
  noteId: string,
  sentences: string[],
  topics: string[],
): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const sentence of sentences) {
    const keywords = extractKeywords(sentence, 3);
    if (keywords.length === 0) continue;

    // Pick the most important keyword to mask
    const keyword = keywords[0];
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "gi");
    if (!regex.test(sentence)) continue;

    const front = sentence.replace(regex, "[___]");
    const back = keyword;

    cards.push(makeCard(noteId, "cloze", front, back, topics.slice(0, 3)));
  }

  return cards.slice(0, 10); // limit
}

/**
 * Generate term-definition cards from summary topics and key points.
 */
function generateTermDefCards(
  noteId: string,
  keyPoints: string[],
  topics: string[],
): Flashcard[] {
  const cards: Flashcard[] = [];

  // Use topics as terms, key points as definitions (if they reference the topic)
  for (const topic of topics) {
    const related = keyPoints.find((kp) =>
      kp.toLowerCase().includes(topic.toLowerCase()),
    );
    if (related) {
      // Term → Definition
      cards.push(
        makeCard(noteId, "term-def", `Define: ${topic}`, related, [topic]),
      );
      // Definition → Term
      cards.push(makeCard(noteId, "def-term", related, topic, [topic]));
    }
  }

  return cards.slice(0, 10);
}

/**
 * Generate all flashcard types from a note's summary and segments.
 */
export function generateFlashcards(
  noteId: string,
  summary: Summary,
  segments: NoteSegment[],
): Flashcard[] {
  const allCards: Flashcard[] = [];

  // Q&A from key points
  allCards.push(...generateQACards(noteId, summary.keyPoints, summary.topics));

  // Cloze from highlights + key points
  const clozeSource = [...summary.highlights, ...summary.keyPoints];
  allCards.push(...generateClozeCards(noteId, clozeSource, summary.topics));

  // Term-Definition pairs
  allCards.push(
    ...generateTermDefCards(noteId, summary.keyPoints, summary.topics),
  );

  // Q&A from action items
  for (const item of summary.actionItems) {
    allCards.push(
      makeCard(
        noteId,
        "qa",
        `What action item was assigned to ${item.owner}?`,
        item.task + (item.due ? ` (due: ${item.due})` : ""),
        ["action-item"],
      ),
    );
  }

  // Deduplicate by front text
  const seen = new Set<string>();
  return allCards.filter((card) => {
    const key = card.front.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Escape special regex characters. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
