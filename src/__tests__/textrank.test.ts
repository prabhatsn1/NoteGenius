/**
 * NoteGenius – TextRank & NLP utility tests.
 */
import {
  extractKeywords,
  splitSentences,
  textRank,
  tokenize,
  wordFrequency,
} from "../services/nlp/textrank";

describe("splitSentences", () => {
  it("splits text on sentence boundaries", () => {
    const text =
      "This is the first sentence. Here is the second one! And a question follows?";
    const result = splitSentences(text);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toContain("first sentence");
  });

  it("filters out very short fragments (<= 10 chars)", () => {
    const text = "Short. This is a longer and meaningful sentence. Ok.";
    const result = splitSentences(text);

    // "Short." and "Ok." should be filtered
    for (const s of result) {
      expect(s.length).toBeGreaterThan(10);
    }
  });

  it("returns empty array for empty input", () => {
    expect(splitSentences("")).toHaveLength(0);
  });
});

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    const tokens = tokenize("Hello, World! Testing 123.");
    expect(tokens).not.toContain("Hello,");
    expect(tokens).toEqual(
      expect.arrayContaining(["hello", "world", "testing"]),
    );
  });

  it("removes stop words", () => {
    const tokens = tokenize("The quick brown fox jumps over the lazy dog");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("over");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
  });

  it("removes words with 2 or fewer characters", () => {
    const tokens = tokenize("I am at it go no do");
    expect(tokens).toHaveLength(0);
  });
});

describe("wordFrequency", () => {
  it("counts word occurrences", () => {
    const freq = wordFrequency(["apple", "banana", "apple", "cherry", "apple"]);

    expect(freq.get("apple")).toBe(3);
    expect(freq.get("banana")).toBe(1);
    expect(freq.get("cherry")).toBe(1);
  });

  it("returns empty map for no tokens", () => {
    expect(wordFrequency([]).size).toBe(0);
  });
});

describe("textRank", () => {
  const passage = [
    "Machine learning is a subset of artificial intelligence.",
    "It involves algorithms that learn from data.",
    "Deep learning uses neural networks with many layers.",
    "Natural language processing is important for text analysis.",
    "Computer vision deals with image recognition.",
    "Reinforcement learning trains agents through rewards.",
    "Data preprocessing is essential before training models.",
    "Transfer learning reuses knowledge from pretrained models.",
  ];

  it("returns indices within valid range", () => {
    const indices = textRank(passage, 3);

    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(passage.length);
    }
  });

  it("returns at most topN results", () => {
    const indices = textRank(passage, 3);
    expect(indices.length).toBeLessThanOrEqual(3);
  });

  it("returns all indices when n <= topN", () => {
    const short = ["First sentence here.", "Second sentence here."];
    const indices = textRank(short, 5);

    expect(indices).toHaveLength(2);
  });

  it("returns empty for empty input", () => {
    expect(textRank([], 5)).toHaveLength(0);
  });
});

describe("extractKeywords", () => {
  it("extracts frequent meaningful words", () => {
    const text =
      "Machine learning uses algorithms. Machine learning models are trained with data. " +
      "The algorithms process input data efficiently. Data is key for machine learning.";
    const keywords = extractKeywords(text, 5);

    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(5);
    // "machine", "learning", "data", "algorithms" should be prominent
    expect(keywords).toEqual(expect.arrayContaining(["machine", "learning"]));
  });

  it("returns empty for empty text", () => {
    expect(extractKeywords("", 5)).toHaveLength(0);
  });
});
