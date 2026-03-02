/**
 * NoteGenius – User store (Zustand).
 * Manages the minimal user profile (name + phone + AI provider prefs).
 * Gemini and Hugging Face API keys are hydrated from expo-secure-store at load time.
 */
import { create } from "zustand";
import { SettingsRepo } from "../data/repos/SettingsRepo";
import type { AIProvider, UserProfile } from "../types/models";

interface UserState {
  profile: UserProfile | null;
  isSetupComplete: boolean;
  loadProfile: () => Promise<void>;
  saveProfile: (
    profile: Omit<
      UserProfile,
      "aiProvider" | "geminiApiKey" | "huggingfaceApiKey"
    >,
  ) => void;
  setGeminiApiKey: (key: string) => Promise<void>;
  deleteGeminiApiKey: () => Promise<void>;
  setHuggingFaceApiKey: (key: string) => Promise<void>;
  deleteHuggingFaceApiKey: () => Promise<void>;
  setAIProvider: (provider: AIProvider) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isSetupComplete: false,

  loadProfile: async () => {
    const stored = SettingsRepo.getUserProfile();
    const isSetupComplete = SettingsRepo.isSetupComplete();

    // Hydrate API keys from secure store
    let geminiApiKey: string | undefined;
    let huggingfaceApiKey: string | undefined;
    try {
      const gKey = await SettingsRepo.getGeminiApiKey();
      if (gKey) geminiApiKey = gKey;
    } catch {
      // Secure store may not be available in all environments
    }
    try {
      const hKey = await SettingsRepo.getHuggingFaceApiKey();
      if (hKey) huggingfaceApiKey = hKey;
    } catch {
      // Secure store may not be available in all environments
    }

    const profile: UserProfile | null = stored
      ? { ...stored, geminiApiKey, huggingfaceApiKey }
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
      huggingfaceApiKey: current?.huggingfaceApiKey,
    };
    // Don't persist API keys to MMKV – they live in secure store
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      geminiApiKey: _gk,
      huggingfaceApiKey: _hk,
      ...mmkvProfile
    } = profile;
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

  setHuggingFaceApiKey: async (key: string) => {
    await SettingsRepo.setHuggingFaceApiKey(key);
    const current = get().profile;
    if (current) {
      set({ profile: { ...current, huggingfaceApiKey: key } });
    }
  },

  deleteHuggingFaceApiKey: async () => {
    await SettingsRepo.deleteHuggingFaceApiKey();
    const current = get().profile;
    if (current) {
      set({ profile: { ...current, huggingfaceApiKey: undefined } });
    }
  },

  setAIProvider: (provider: AIProvider) => {
    const current = get().profile;
    if (current) {
      const updated = { ...current, aiProvider: provider };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {
        geminiApiKey: _gk,
        huggingfaceApiKey: _hk,
        ...mmkvProfile
      } = updated;
      SettingsRepo.setUserProfile(mmkvProfile as UserProfile);
      set({ profile: updated });
    }
    // Also sync to settings store
    SettingsRepo.setSettings({ aiProvider: provider });
  },
}));
