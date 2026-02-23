/**
 * NoteGenius – OfflineProvider tests.
 */
import { OfflineProvider } from "../services/ai/offline/OfflineProvider";

describe("OfflineProvider", () => {
  const transcript =
    "Revenue grew by 15% last quarter. Customer satisfaction improved. " +
    "We decided to move forward with the new platform. " +
    "Alice will prepare the Q2 budget report by Friday. " +
    "When will the new hire start? " +
    "Engineering team should adopt the new CI pipeline.";

  describe("summarize", () => {
    it("returns an AiSummaryResult with expected keys", async () => {
      const result = await OfflineProvider.summarize(transcript, "TestUser");
      expect(result).toHaveProperty("tldr");
      expect(result).toHaveProperty("keyPoints");
      expect(result).toHaveProperty("decisions");
      expect(result).toHaveProperty("actionItems");
      expect(result).toHaveProperty("openQuestions");
      expect(result).toHaveProperty("topics");
      expect(result).toHaveProperty("highlights");
      expect(result).toHaveProperty("followUps");
      expect(Array.isArray(result.tldr)).toBe(true);
      expect(Array.isArray(result.keyPoints)).toBe(true);
    });

    it("detects decisions from transcript", async () => {
      const result = await OfflineProvider.summarize(transcript, "TestUser");
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.decisions[0]).toMatch(/decided/i);
    });

    it("detects action items with owner attribution", async () => {
      const result = await OfflineProvider.summarize(transcript, "TestUser");
      expect(result.actionItems.length).toBeGreaterThan(0);
      const aliceItem = result.actionItems.find((a) => a.owner === "Alice");
      expect(aliceItem).toBeDefined();
    });

    it("detects open questions", async () => {
      const result = await OfflineProvider.summarize(transcript, "TestUser");
      expect(result.openQuestions.length).toBeGreaterThan(0);
      expect(result.openQuestions[0]).toMatch(/\?$/);
    });

    it("provides sentiment scores", async () => {
      const result = await OfflineProvider.summarize(transcript, "TestUser");
      expect(result.sentimentBySegment).toBeDefined();
      expect(result.sentimentBySegment!.length).toBeGreaterThan(0);
    });
  });

  describe("generateFlashcards", () => {
    it("generates flashcards from transcript and summary", async () => {
      const summary = await OfflineProvider.summarize(transcript, "TestUser");
      const cards = await OfflineProvider.generateFlashcards(
        transcript,
        summary,
      );
      expect(cards.length).toBeGreaterThan(0);
    });

    it("generates flashcards from transcript alone (no summary)", async () => {
      const cards = await OfflineProvider.generateFlashcards(transcript, null);
      // May produce some cards from topics extraction
      expect(Array.isArray(cards)).toBe(true);
    });

    it("deduplicates flashcard fronts", async () => {
      const summary = await OfflineProvider.summarize(transcript, "TestUser");
      const cards = await OfflineProvider.generateFlashcards(
        transcript,
        summary,
      );
      const fronts = cards.map((c) => c.front.toLowerCase().trim());
      const unique = new Set(fronts);
      expect(fronts.length).toBe(unique.size);
    });

    it("returns cards with valid types", async () => {
      const summary = await OfflineProvider.summarize(transcript, "TestUser");
      const cards = await OfflineProvider.generateFlashcards(
        transcript,
        summary,
      );
      const validTypes = ["qa", "cloze", "term-def", "def-term"];
      for (const card of cards) {
        expect(validTypes).toContain(card.type);
      }
    });
  });

  it("has the correct label", () => {
    expect(OfflineProvider.label).toBe("Offline (on-device)");
  });
});
