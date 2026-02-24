/**
 * NoteGenius – Settings store (Zustand).
 * Wraps MMKV-backed settings with reactive state.
 */
import { create } from "zustand";
import { SettingsRepo } from "../data/repos/SettingsRepo";
import type { AIProvider, AppSettings, GeminiModel } from "../types/models";

interface SettingsState {
  settings: AppSettings;
  loadSettings: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setAIProvider: (provider: AIProvider) => void;
  setGeminiModel: (model: GeminiModel) => void;
  acknowledgeGeminiPrivacy: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: SettingsRepo.getSettings(),

  loadSettings: () => {
    set({ settings: SettingsRepo.getSettings() });
  },

  updateSettings: (partial: Partial<AppSettings>) => {
    SettingsRepo.setSettings(partial);
    set({ settings: { ...get().settings, ...partial } });
  },

  setAIProvider: (provider: AIProvider) => {
    get().updateSettings({ aiProvider: provider });
  },

  setGeminiModel: (model: GeminiModel) => {
    get().updateSettings({ geminiModel: model });
  },

  acknowledgeGeminiPrivacy: () => {
    get().updateSettings({ geminiPrivacyAcknowledged: true });
  },
}));
