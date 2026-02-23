/**
 * NoteGenius – Flashcard generator tests.
 */
import { generateFlashcards } from "../services/nlp/flashcardGenerator";
import type { NoteSegment, Summary } from "../types/models";

/** Minimal valid summary for testing. */
function makeSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    id: "sum-1",
    noteId: "note-1",
    tldr: ["Meeting discussed quarterly results and next steps."],
    keyPoints: [
      "Revenue grew by 15% in the last quarter.",
      "Customer satisfaction scores improved significantly.",
      "Engineering team will adopt the new CI pipeline.",
    ],
    decisions: ["We decided to move forward with the new platform."],
    actionItems: [
      { owner: "Alice", task: "Prepare the Q2 budget report", due: "Friday" },
    ],
    openQuestions: ["When will the new hire start?"],
    topics: ["Revenue", "Engineering", "Pipeline"],
    highlights: [
      "Revenue grew by 15% in the last quarter.",
      "Customer satisfaction scores improved significantly.",
    ],
    followUps: ["What is the timeline for Pipeline?"],
    sentimentBySegment: [0.5, -0.1],
    createdAt: Date.now(),
    provider: "offline",
    ...overrides,
  };
}

const segments: NoteSegment[] = [
  {
    id: "seg-1",
    noteId: "note-1",
    source: "voice",
    text: "Revenue grew by 15% in the last quarter.",
    startMs: 0,
    endMs: 5000,
  },
  {
    id: "seg-2",
    noteId: "note-1",
    source: "typed",
    text: "Customer satisfaction scores improved significantly.",
    startMs: 5000,
    endMs: 10000,
  },
];

// Mock expo-crypto since it's not available in test environment
jest.mock("expo-crypto", () => ({
  randomUUID: () => `test-${Math.random().toString(36).slice(2, 10)}`,
}));

describe("generateFlashcards", () => {
  it("generates cards from a summary", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);

    expect(cards.length).toBeGreaterThan(0);
  });

  it("includes Q&A cards from key points", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);
    const qaCards = cards.filter((c) => c.type === "qa");

    expect(qaCards.length).toBeGreaterThan(0);
  });

  it("includes action item cards", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);
    const actionCards = cards.filter((c) => c.tags.includes("action-item"));

    expect(actionCards.length).toBe(1);
    expect(actionCards[0].front).toContain("Alice");
  });

  it("sets correct noteId on all cards", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);

    for (const card of cards) {
      expect(card.noteId).toBe("note-1");
    }
  });

  it("initializes SRS fields with defaults", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);

    for (const card of cards) {
      expect(card.easiness).toBe(2.5);
      expect(card.interval).toBe(0);
      expect(card.repetitions).toBe(0);
      expect(card.difficulty).toBe(3);
    }
  });

  it("deduplicates cards by front text", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);
    const fronts = cards.map((c) => c.front.toLowerCase().trim());
    const uniqueFronts = new Set(fronts);

    expect(fronts.length).toBe(uniqueFronts.size);
  });

  it("handles summary with empty key points", () => {
    const summary = makeSummary({ keyPoints: [], highlights: [], topics: [] });
    const cards = generateFlashcards("note-1", summary, segments);

    // Should still produce action item cards at minimum
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it("sets valid type on every card", () => {
    const cards = generateFlashcards("note-1", makeSummary(), segments);
    const validTypes = ["qa", "cloze", "term-def", "def-term"];

    for (const card of cards) {
      expect(validTypes).toContain(card.type);
    }
  });
});
