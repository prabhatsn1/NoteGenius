/**
 * NoteGenius – AI provider factory & re-exports.
 *
 * Usage:
 *   const provider = makeAiProvider('gemini', apiKey);
 *   const summary  = await provider.summarize(transcript, userName);
 */
import type { AIProvider } from "../../types/models";
import { addAiBreadcrumb, setAiProviderTag } from "../monitoring/sentry";
import type { IAiProvider } from "./AiProvider";
import { createGeminiProvider } from "./gemini/GeminiProvider";
import { createHuggingFaceProvider } from "./huggingface/HuggingFaceProvider";
import { OfflineProvider } from "./offline/OfflineProvider";

export type {
  AiFlashcardResult,
  AiSummaryResult,
  IAiProvider,
} from "./AiProvider";

/**
 * Create the appropriate AI provider instance.
 * @param which      'offline' | 'gemini' | 'huggingface'
 * @param apiKey     Required when `which === 'gemini'` or `which === 'huggingface'`; ignored otherwise.
 * @param modelName  Gemini model ID (e.g. 'gemini-2.0-flash'). Defaults to 'gemini-2.0-flash'. Unused for HuggingFace.
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
      setAiProviderTag("offline");
      addAiBreadcrumb("Provider fallback: Gemini→Offline (no API key)");
      return OfflineProvider;
    }
    setAiProviderTag("gemini");
    addAiBreadcrumb("AI provider initialised", {
      provider: "gemini",
      model: modelName,
    });
    return createGeminiProvider(apiKey, modelName);
  }

  if (which === "huggingface") {
    if (!apiKey) {
      console.warn(
        "[makeAiProvider] HuggingFace selected but no API token – falling back to Offline.",
      );
      setAiProviderTag("offline");
      addAiBreadcrumb("Provider fallback: HuggingFace→Offline (no API token)");
      return OfflineProvider;
    }
    setAiProviderTag("huggingface");
    addAiBreadcrumb("AI provider initialised", { provider: "huggingface" });
    return createHuggingFaceProvider(apiKey);
  }

  setAiProviderTag("offline");
  return OfflineProvider;
}
