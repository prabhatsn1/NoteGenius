/**
 * NoteGenius – SM-2 SRS algorithm tests.
 */
import { computeSRS, filterDueCards } from "../services/nlp/srs";
import type { Flashcard, SRSRating } from "../types/models";

/** Helper to create a test flashcard with sensible defaults. */
function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    noteId: "note-1",
    type: "qa",
    front: "Question?",
    back: "Answer.",
    tags: [],
    difficulty: 3,
    interval: 0,
    repetitions: 0,
    easiness: 2.5,
    nextReviewAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("computeSRS", () => {
  it("resets repetitions and interval on rating < 3 (Again)", () => {
    const card = makeCard({ repetitions: 3, interval: 15, easiness: 2.5 });
    const result = computeSRS(card, 0);

    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(0);
  });

  it("sets interval to 1 on first successful pass (rating 3)", () => {
    const card = makeCard({ repetitions: 0, interval: 0, easiness: 2.5 });
    const result = computeSRS(card, 3);

    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
  });

  it("sets interval to 6 on second successful pass", () => {
    const card = makeCard({ repetitions: 1, interval: 1, easiness: 2.5 });
    const result = computeSRS(card, 4);

    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  it("multiplies interval by easiness on third+ pass", () => {
    const card = makeCard({ repetitions: 2, interval: 6, easiness: 2.5 });
    const result = computeSRS(card, 4);

    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(Math.round(6 * 2.5)); // 15
  });

  it("never drops easiness below 1.3", () => {
    const card = makeCard({ easiness: 1.3 });
    const result = computeSRS(card, 0);

    expect(result.easiness).toBeGreaterThanOrEqual(1.3);
  });

  it("increases easiness on perfect rating (5)", () => {
    const card = makeCard({ easiness: 2.5 });
    const result = computeSRS(card, 5);

    expect(result.easiness).toBeGreaterThan(2.5);
  });

  it("decreases easiness on low rating (1)", () => {
    const card = makeCard({ easiness: 2.5 });
    const result = computeSRS(card, 1);

    expect(result.easiness).toBeLessThan(2.5);
  });

  it("maps difficulty correctly (5 - rating + 1, clamped 1..5)", () => {
    expect(computeSRS(makeCard(), 5).difficulty).toBe(1); // 5-5+1=1
    expect(computeSRS(makeCard(), 4).difficulty).toBe(2); // 5-4+1=2
    expect(computeSRS(makeCard(), 3).difficulty).toBe(3);
    expect(computeSRS(makeCard(), 0).difficulty).toBe(5); // clamped
  });

  it("schedules nextReviewAt in the future", () => {
    const now = Date.now();
    const card = makeCard({ repetitions: 0, interval: 0, easiness: 2.5 });
    const result = computeSRS(card, 4);

    expect(result.nextReviewAt).toBeGreaterThanOrEqual(now);
  });

  it("returns all required SRSUpdate fields", () => {
    const card = makeCard();
    const result = computeSRS(card, 4);

    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("difficulty");
    expect(result).toHaveProperty("interval");
    expect(result).toHaveProperty("repetitions");
    expect(result).toHaveProperty("easiness");
    expect(result).toHaveProperty("nextReviewAt");
    expect(result).toHaveProperty("updatedAt");
  });

  it("handles all 6 rating values without throwing", () => {
    const ratings: SRSRating[] = [0, 1, 2, 3, 4, 5];
    for (const rating of ratings) {
      expect(() => computeSRS(makeCard(), rating)).not.toThrow();
    }
  });
});

describe("filterDueCards", () => {
  it("returns cards whose nextReviewAt is in the past", () => {
    const now = Date.now();
    const cards = [
      makeCard({ id: "a", nextReviewAt: now - 1000 }),
      makeCard({ id: "b", nextReviewAt: now + 100000 }),
      makeCard({ id: "c", nextReviewAt: now - 500 }),
    ];

    const due = filterDueCards(cards, now);
    expect(due).toHaveLength(2);
    expect(due.map((c) => c.id)).toEqual(expect.arrayContaining(["a", "c"]));
  });

  it("returns empty array when no cards are due", () => {
    const now = Date.now();
    const cards = [makeCard({ nextReviewAt: now + 100000 })];

    expect(filterDueCards(cards, now)).toHaveLength(0);
  });

  it("includes cards whose nextReviewAt equals now", () => {
    const now = Date.now();
    const cards = [makeCard({ nextReviewAt: now })];

    expect(filterDueCards(cards, now)).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(filterDueCards([])).toHaveLength(0);
  });
});
