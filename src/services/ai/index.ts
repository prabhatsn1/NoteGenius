/**
 * NoteGenius – AI provider factory & re-exports.
 *
 * Usage:
 *   const provider = makeAiProvider('gemini', apiKey);
 *   const summary  = await provider.summarize(transcript, userName);
 */
import type { AIProvider } from "../../types/models";
import type { IAiProvider } from "./AiProvider";
import { createGeminiProvider } from "./gemini/GeminiProvider";
import { OfflineProvider } from "./offline/OfflineProvider";

export type {
  AiFlashcardResult,
  AiSummaryResult,
  IAiProvider,
} from "./AiProvider";

/**
 * Create the appropriate AI provider instance.
 * @param which    'offline' | 'gemini'
 * @param apiKey   Required when `which === 'gemini'`; ignored otherwise.
 */
export function makeAiProvider(
  which: AIProvider,
  apiKey?: string,
): IAiProvider {
  if (which === "gemini") {
    if (!apiKey) {
      console.warn(
        "[makeAiProvider] Gemini selected but no API key – falling back to Offline.",
      );
      return OfflineProvider;
    }
    return createGeminiProvider(apiKey);
  }
  return OfflineProvider;
}
