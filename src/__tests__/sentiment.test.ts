/**
 * NoteGenius – Sentiment analysis tests.
 */
import {
  analyzeSentiment,
  analyzeSentimentBatch,
} from "../services/nlp/sentiment";

describe("analyzeSentiment", () => {
  it("returns positive score for positive text", () => {
    const score = analyzeSentiment("This is great and wonderful, I love it");
    expect(score).toBeGreaterThan(0);
  });

  it("returns negative score for negative text", () => {
    const score = analyzeSentiment("This is terrible and awful, I hate it");
    expect(score).toBeLessThan(0);
  });

  it("returns 0 for neutral text", () => {
    const score = analyzeSentiment(
      "The meeting is at 3pm in the conference room",
    );
    expect(score).toBe(0);
  });

  it("handles negation (not good → negative)", () => {
    const score = analyzeSentiment("This is not good at all");
    expect(score).toBeLessThan(0);
  });

  it("handles negation of negative (not bad → positive)", () => {
    const score = analyzeSentiment("not bad");
    expect(score).toBeGreaterThan(0);
  });

  it("returns score in [-1, +1] range", () => {
    const positive = analyzeSentiment(
      "great excellent amazing wonderful fantastic good love happy awesome brilliant",
    );
    const negative = analyzeSentiment(
      "bad terrible awful horrible poor worst hate angry sad disappointed",
    );

    expect(positive).toBeGreaterThanOrEqual(-1);
    expect(positive).toBeLessThanOrEqual(1);
    expect(negative).toBeGreaterThanOrEqual(-1);
    expect(negative).toBeLessThanOrEqual(1);
  });

  it("returns 0 for empty string", () => {
    expect(analyzeSentiment("")).toBe(0);
  });

  it("is case-insensitive", () => {
    const lower = analyzeSentiment("great");
    const upper = analyzeSentiment("GREAT");
    expect(lower).toBe(upper);
  });
});

describe("analyzeSentimentBatch", () => {
  it("returns an array of scores matching input length", () => {
    const texts = ["This is great", "This is bad", "Neutral text here"];
    const scores = analyzeSentimentBatch(texts);

    expect(scores).toHaveLength(3);
    expect(scores[0]).toBeGreaterThan(0);
    expect(scores[1]).toBeLessThan(0);
    expect(scores[2]).toBe(0);
  });

  it("returns empty array for empty input", () => {
    expect(analyzeSentimentBatch([])).toHaveLength(0);
  });
});
