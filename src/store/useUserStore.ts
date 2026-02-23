/**
 * NoteGenius – User store (Zustand).
 * Manages the minimal user profile (name + phone + AI provider prefs).
 * Gemini API key is hydrated from expo-secure-store at load time.
 */
import { create } from "zustand";
import { SettingsRepo } from "../data/repos/SettingsRepo";
import type { AIProvider, UserProfile } from "../types/models";

interface UserState {
  profile: UserProfile | null;
  isSetupComplete: boolean;
  loadProfile: () => Promise<void>;
  saveProfile: (
    profile: Omit<UserProfile, "aiProvider" | "geminiApiKey">,
  ) => void;
  setGeminiApiKey: (key: string) => Promise<void>;
  deleteGeminiApiKey: () => Promise<void>;
  setAIProvider: (provider: AIProvider) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isSetupComplete: false,

  loadProfile: async () => {
    const stored = SettingsRepo.getUserProfile();
    const isSetupComplete = SettingsRepo.isSetupComplete();

    // Hydrate geminiApiKey from secure store
    let geminiApiKey: string | undefined;
    try {
      const key = await SettingsRepo.getGeminiApiKey();
      if (key) geminiApiKey = key;
    } catch {
      // Secure store may not be available in all environments
    }

    const profile: UserProfile | null = stored
      ? { ...stored, geminiApiKey }
      : null;

    set({ profile, isSetupComplete });
  },

  saveProfile: (data) => {
    const current = get().profile;
    const profile: UserProfile = {
      name: data.name,
      phone: data.phone,
      aiProvider: current?.aiProvider ?? "offline",
      geminiApiKey: current?.geminiApiKey,
    };
    // Don't persist geminiApiKey to MMKV – it's in secure store
    const { geminiApiKey: _key, ...mmkvProfile } = profile;
    SettingsRepo.setUserProfile(mmkvProfile as UserProfile);
    SettingsRepo.completeSetup();
    set({ profile, isSetupComplete: true });
  },

  setGeminiApiKey: async (key: string) => {
    await SettingsRepo.setGeminiApiKey(key);
    const current = get().profile;
    if (current) {
      set({ profile: { ...current, geminiApiKey: key } });
    }
  },

  deleteGeminiApiKey: async () => {
    await SettingsRepo.deleteGeminiApiKey();
    const current = get().profile;
    if (current) {
      set({ profile: { ...current, geminiApiKey: undefined } });
    }
  },

  setAIProvider: (provider: AIProvider) => {
    const current = get().profile;
    if (current) {
      const updated = { ...current, aiProvider: provider };
      const { geminiApiKey: _key, ...mmkvProfile } = updated;
      SettingsRepo.setUserProfile(mmkvProfile as UserProfile);
      set({ profile: updated });
    }
    // Also sync to settings store
    SettingsRepo.setSettings({ aiProvider: provider });
  },
}));
