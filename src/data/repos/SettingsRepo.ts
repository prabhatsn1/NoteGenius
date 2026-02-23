/**
 * NoteGenius – Settings repository using MMKV for fast key-value storage.
 * Stores user profile, AI provider settings, and recording prefs.
 * Gemini API key is stored in expo-secure-store (encrypted) – never in MMKV.
 */
import * as SecureStore from "expo-secure-store";
import { createMMKV } from "react-native-mmkv";
import type { AppSettings, UserProfile } from "../../types/models";

const storage = createMMKV({ id: "notegenius-settings" });

const KEYS = {
  USER_PROFILE: "user.profile",
  SETTINGS: "settings.app",
} as const;

const SECURE_KEYS = {
  GEMINI_API_KEY: "notegenius.geminiApiKey",
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: "offline",
  autoPunctuate: true,
  sampleRate: 44100,
  silenceTrimming: false,
  setupComplete: false,
  geminiPrivacyAcknowledged: false,
};

export const SettingsRepo = {
  // ─── User Profile ───────────────────────────────────────────────────────
  getUserProfile(): UserProfile | null {
    const raw = storage.getString(KEYS.USER_PROFILE);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  },

  setUserProfile(profile: UserProfile): void {
    storage.set(KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  // ─── App Settings ──────────────────────────────────────────────────────
  getSettings(): AppSettings {
    const raw = storage.getString(KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  },

  setSettings(settings: Partial<AppSettings>): void {
    const current = SettingsRepo.getSettings();
    const updated = { ...current, ...settings };
    storage.set(KEYS.SETTINGS, JSON.stringify(updated));
  },

  /** Mark setup as complete after the first-launch wizard. */
  completeSetup(): void {
    SettingsRepo.setSettings({ setupComplete: true });
  },

  /** Check if initial setup has been completed. */
  isSetupComplete(): boolean {
    return SettingsRepo.getSettings().setupComplete;
  },

  // ─── Generic MMKV Access ──────────────────────────────────────────────
  getString(key: string): string | undefined {
    return storage.getString(key);
  },

  setString(key: string, value: string): void {
    storage.set(key, value);
  },

  getBoolean(key: string): boolean {
    return storage.getBoolean(key) ?? false;
  },

  setBoolean(key: string, value: boolean): void {
    storage.set(key, value);
  },

  /** Clear all data (for "Clear data" in settings). */
  clearAll(): void {
    storage.clearAll();
    SecureStore.deleteItemAsync(SECURE_KEYS.GEMINI_API_KEY).catch(() => {});
  },

  // ─── Gemini API Key (Secure Store) ────────────────────────────────────
  async getGeminiApiKey(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEYS.GEMINI_API_KEY);
  },

  async setGeminiApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_KEYS.GEMINI_API_KEY, key);
  },

  async deleteGeminiApiKey(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURE_KEYS.GEMINI_API_KEY);
  },
};
