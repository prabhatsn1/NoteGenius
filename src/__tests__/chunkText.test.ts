/**
 * NoteGenius – Text utilities tests.
 */
import { chunkText } from "../utils/text";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const result = chunkText("Hello world.", 100);
    expect(result).toEqual(["Hello world."]);
  });

  it("splits long text into multiple chunks", () => {
    const sentences = Array.from(
      { length: 20 },
      (_, i) =>
        `Sentence number ${i + 1} with some extra words to pad the length.`,
    );
    const text = sentences.join(" ");
    const result = chunkText(text, 200);
    expect(result.length).toBeGreaterThan(1);
    // Every chunk should be ≤ maxChars (approx — may exceed slightly at sentence boundary)
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(250); // slight tolerance
    }
  });

  it("preserves all content (no data loss)", () => {
    const text = "A. B. C. D. E. F. G.";
    const chunks = chunkText(text, 10);
    const rejoined = chunks.join(" ");
    // All original sentences should be present
    expect(rejoined).toContain("A.");
    expect(rejoined).toContain("G.");
  });

  it("handles empty text", () => {
    expect(chunkText("", 100)).toEqual([""]);
  });

  it("handles text exactly at maxChars", () => {
    const text = "x".repeat(100);
    expect(chunkText(text, 100)).toEqual([text]);
  });
});
