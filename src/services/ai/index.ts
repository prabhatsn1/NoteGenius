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
 * @param which      'offline' | 'gemini'
 * @param apiKey     Required when `which === 'gemini'`; ignored otherwise.
 * @param modelName  Gemini model ID (e.g. 'gemini-2.0-flash'). Defaults to 'gemini-2.0-flash'.
 */
export function makeAiProvider(
  which: AIProvider,
  apiKey?: string,
  modelName?: string,
): IAiProvider {
  if (which === "gemini") {
    if (!apiKey) {
      console.warn(
        "[makeAiProvider] Gemini selected but no API key – falling back to Offline.",
      );
      return OfflineProvider;
    }
    return createGeminiProvider(apiKey, modelName);
  }
  return OfflineProvider;
}
