/**
 * NoteGenius – Settings repository using MMKV for fast key-value storage.
 * Stores user profile, AI provider settings, and recording prefs.
 * Gemini API key is stored in expo-secure-store (encrypted) – never in MMKV.
 * Falls back to AsyncStorage if MMKV is not available (Expo Go).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { AppSettings, UserProfile } from "../../types/models";

// Try to load MMKV, fall back to AsyncStorage if not available
let storage: any = null;
let useMMKV = false;

try {
  const { createMMKV } = require("react-native-mmkv");
  storage = createMMKV({ id: "notegenius-settings" });
  useMMKV = true;
} catch {
  // MMKV not available - will use AsyncStorage fallback
  useMMKV = false;
}

// Storage adapter that works with both MMKV and AsyncStorage
const storageAdapter = {
  getString(key: string): string | undefined {
    if (useMMKV) {
      return storage.getString(key);
    }
    // AsyncStorage is async, but we need sync API - use cached values
    const cached = asyncStorageCache.get(key);
    return cached;
  },

  set(key: string, value: string | boolean): void {
    if (useMMKV) {
      storage.set(key, value);
    } else {
      asyncStorageCache.set(key, String(value));
      AsyncStorage.setItem(key, String(value)).catch(() => {});
    }
  },

  getBoolean(key: string): boolean | undefined {
    if (useMMKV) {
      return storage.getBoolean(key);
    }
    const cached = asyncStorageCache.get(key);
    return cached === "true";
  },

  clearAll(): void {
    if (useMMKV) {
      storage.clearAll();
    } else {
      asyncStorageCache.clear();
      AsyncStorage.clear().catch(() => {});
    }
  },
};

// In-memory cache for AsyncStorage (since we need sync API)
const asyncStorageCache = new Map<string, string>();

// Initialize AsyncStorage cache on module load
if (!useMMKV) {
  AsyncStorage.getAllKeys()
    .then((keys) => AsyncStorage.multiGet(keys))
    .then((entries) => {
      entries.forEach(([key, value]) => {
        if (value) asyncStorageCache.set(key, value);
      });
    })
    .catch(() => {});
}

const KEYS = {
  USER_PROFILE: "user.profile",
  SETTINGS: "settings.app",
} as const;

const SECURE_KEYS = {
  GEMINI_API_KEY: "notegenius.geminiApiKey",
  HUGGINGFACE_API_KEY: "notegenius.huggingfaceApiKey",
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: "offline",
  geminiModel: "gemini-2.0-flash",
  autoPunctuate: true,
  sampleRate: 44100,
  silenceTrimming: false,
  setupComplete: false,
  geminiPrivacyAcknowledged: false,
  huggingfacePrivacyAcknowledged: false,
};

export const SettingsRepo = {
  // ─── User Profile ───────────────────────────────────────────────────────
  getUserProfile(): UserProfile | null {
    const raw = storageAdapter.getString(KEYS.USER_PROFILE);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  },

  setUserProfile(profile: UserProfile): void {
    storageAdapter.set(KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  // ─── App Settings ──────────────────────────────────────────────────────
  getSettings(): AppSettings {
    const raw = storageAdapter.getString(KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  },

  setSettings(settings: Partial<AppSettings>): void {
    const current = SettingsRepo.getSettings();
    const updated = { ...current, ...settings };
    storageAdapter.set(KEYS.SETTINGS, JSON.stringify(updated));
  },

  /** Mark setup as complete after the first-launch wizard. */
  completeSetup(): void {
    SettingsRepo.setSettings({ setupComplete: true });
  },

  /** Check if initial setup has been completed. */
  isSetupComplete(): boolean {
    return SettingsRepo.getSettings().setupComplete;
  },

  // ─── Generic Storage Access ──────────────────────────────────────────────
  getString(key: string): string | undefined {
    return storageAdapter.getString(key);
  },

  setString(key: string, value: string): void {
    storageAdapter.set(key, value);
  },

  getBoolean(key: string): boolean {
    return storageAdapter.getBoolean(key) ?? false;
  },

  setBoolean(key: string, value: boolean): void {
    storageAdapter.set(key, value);
  },

  /** Clear all data (for "Clear data" in settings). */
  clearAll(): void {
    storageAdapter.clearAll();
    SecureStore.deleteItemAsync(SECURE_KEYS.GEMINI_API_KEY).catch(() => {});
    SecureStore.deleteItemAsync(SECURE_KEYS.HUGGINGFACE_API_KEY).catch(
      () => {},
    );
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

  // ─── Hugging Face API Key (Secure Store) ───────────────────────────────
  async getHuggingFaceApiKey(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_KEYS.HUGGINGFACE_API_KEY);
  },

  async setHuggingFaceApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_KEYS.HUGGINGFACE_API_KEY, key);
  },

  async deleteHuggingFaceApiKey(): Promise<void> {
    await SecureStore.deleteItemAsync(SECURE_KEYS.HUGGINGFACE_API_KEY);
  },
};
