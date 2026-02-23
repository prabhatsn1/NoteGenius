/**
 * NoteGenius – AI provider factory tests.
 */
import { makeAiProvider } from "../services/ai";

// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  randomUUID: () => `test-${Math.random().toString(36).slice(2, 10)}`,
}));

describe("makeAiProvider", () => {
  it("returns OfflineProvider when provider is 'offline'", () => {
    const provider = makeAiProvider("offline");
    expect(provider.label).toBe("Offline (on-device)");
  });

  it("returns OfflineProvider when provider is 'gemini' but no API key", () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    const provider = makeAiProvider("gemini");
    expect(provider.label).toBe("Offline (on-device)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("no API key"),
    );
    consoleSpy.mockRestore();
  });

  it("returns GeminiProvider when provider is 'gemini' with API key", () => {
    const provider = makeAiProvider("gemini", "test-key-123");
    expect(provider.label).toBe("Gemini (cloud)");
  });

  it("returns a provider with summarize and generateFlashcards methods", () => {
    const provider = makeAiProvider("offline");
    expect(typeof provider.summarize).toBe("function");
    expect(typeof provider.generateFlashcards).toBe("function");
  });
});
