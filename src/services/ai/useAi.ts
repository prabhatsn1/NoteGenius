/**
 * NoteGenius – useAi hook.
 * Returns a ready-to-use IAiProvider based on the user's settings.
 * Falls back to Offline if the selected provider has no API key.
 */
import { useMemo } from "react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUserStore } from "../../store/useUserStore";
import type { IAiProvider } from "./AiProvider";
import { makeAiProvider } from "./index";

/**
 * React hook – returns the active IAiProvider.
 * Memoised so the object reference is stable across renders
 * unless the provider or API key changes.
 */
export function useAi(): IAiProvider {
  const aiProvider = useSettingsStore((s) => s.settings.aiProvider);
  const geminiModel = useSettingsStore((s) => s.settings.geminiModel);
  const geminiApiKey = useUserStore((s) => s.profile?.geminiApiKey);
  const huggingfaceApiKey = useUserStore((s) => s.profile?.huggingfaceApiKey);

  return useMemo(() => {
    const apiKey =
      aiProvider === "huggingface" ? huggingfaceApiKey : geminiApiKey;
    return makeAiProvider(aiProvider, apiKey, geminiModel);
  }, [aiProvider, geminiApiKey, huggingfaceApiKey, geminiModel]);
}
