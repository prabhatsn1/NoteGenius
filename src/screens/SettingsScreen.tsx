/**
 * NoteGenius – Settings Screen.
 * Profile, AI Provider (Offline / Gemini), Data export/import, Recording options, Clear data.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import { SettingsRepo } from "../data/repos/SettingsRepo";
import { ExportService } from "../services/export/exportService";
import { validateGeminiApiKey } from "../services/ai/gemini/GeminiProvider";
import {
  validateHuggingFaceApiKey,
  HF_PRIMARY_MODEL,
  HF_FALLBACK_MODEL,
} from "../services/ai/huggingface/HuggingFaceProvider";
import {
  addAppBreadcrumb,
  captureError,
  setAiProviderTag,
} from "../services/monitoring/sentry";
import { useSettingsStore } from "../store/useSettingsStore";
import { useUserStore } from "../store/useUserStore";
import type { AIProvider } from "../types/models";

// ─── Privacy copy ────────────────────────────────────────────────────────────

const PRIVACY_NOTICE =
  "When Gemini is selected, only the transcript text of each note is sent " +
  "to Google's Gemini API for summarization and flashcard generation. " +
  "No audio files, profile data, or phone number are ever transmitted. " +
  "Your Gemini API key is stored encrypted on-device using the system keychain " +
  "(expo-secure-store) and is never synced to any server. " +
  "You can switch back to Offline processing at any time — all previously " +
  "generated summaries and flashcards remain stored locally.";

const HF_PRIVACY_NOTICE =
  "When Hugging Face is selected, only the transcript text of each note is sent " +
  "to the Hugging Face Inference API for summarization and flashcard generation. " +
  `Primary model: ${HF_PRIMARY_MODEL}. ` +
  `Fallback model (used automatically when the primary is rate-limited): ${HF_FALLBACK_MODEL}. ` +
  "No audio files, profile data, or phone number are ever transmitted. " +
  "Your Hugging Face API token is stored encrypted on-device using the system keychain " +
  "(expo-secure-store) and is never synced to any server. " +
  "You can switch back to Offline processing at any time — all previously " +
  "generated summaries and flashcards remain stored locally.";

// ─── Gemini key error help ───────────────────────────────────────────────────

type GeminiErrorHelp = {
  cause: string;
  steps: string[];
  tip?: string;
};

function getGeminiErrorHelp(error: string): GeminiErrorHelp {
  const msg = error.toLowerCase();

  if (
    msg.includes("api key not valid") ||
    msg.includes("api_key_invalid") ||
    msg.includes("invalid api key") ||
    msg.includes("invalid_api_key")
  ) {
    return {
      cause:
        "The API key you entered doesn't match any active key in your Google account.",
      steps: [
        "Open Google AI Studio → aistudio.google.com",
        "Sign in with your Google account.",
        'Tap "Get API key" in the left sidebar.',
        'Click "Create API key" and copy the new key.',
        "Paste it here and tap Save Key Securely.",
      ],
      tip: 'Make sure you copied the entire key — they start with "AIza".',
    };
  }

  if (msg.includes("api_key_expired") || msg.includes("key expired")) {
    return {
      cause: "Your API key has expired.",
      steps: [
        "Open Google AI Studio → aistudio.google.com",
        'Go to "Get API key" in the left sidebar.',
        'Delete the old key, then click "Create API key".',
        "Copy the new key and paste it here.",
      ],
    };
  }

  if (
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit")
  ) {
    return {
      cause: "You have exceeded the free usage quota for this API key.",
      steps: [
        "Wait a few minutes and tap Test again — free tier resets per minute.",
        "If it persists, open console.cloud.google.com and check your quotas.",
        "Consider enabling billing on your project for higher limits.",
        "Or create a new Google Cloud project and generate a fresh API key.",
      ],
      tip: "Free Gemini API tier allows ~60 requests/minute.",
    };
  }

  if (
    msg.includes("permission_denied") ||
    msg.includes("service_disabled") ||
    msg.includes("not enabled")
  ) {
    return {
      cause:
        "The Generative Language API is not enabled for this key's project.",
      steps: [
        "Open console.cloud.google.com and select your project.",
        'Go to "APIs & Services" → "Enable APIs & Services".',
        'Search for "Generative Language API" and click Enable.',
        "Wait 1–2 minutes for the change to propagate, then try again.",
      ],
    };
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("connection")
  ) {
    return {
      cause: "Could not reach the Gemini API — this is likely a network issue.",
      steps: [
        "Check that your device has an active internet connection.",
        "Try switching between Wi-Fi and mobile data.",
        "If you're behind a VPN or proxy, try disabling it temporarily.",
        "Retry once connectivity is restored.",
      ],
    };
  }

  // Fallback
  return {
    cause: "The Gemini API returned an unexpected error.",
    steps: [
      "Double-check your API key at aistudio.google.com → Get API key.",
      "Delete and recreate the key if it looks correct but still fails.",
      "Make sure your Google account can access the Gemini API (some Workspace accounts restrict it).",
      "If the problem persists, check status.cloud.google.com for outages.",
    ],
  };
}

// ─── HuggingFace key error help ──────────────────────────────────────────────

function getHuggingFaceErrorHelp(error: string): GeminiErrorHelp {
  const msg = error.toLowerCase();

  if (
    msg.includes("invalid") ||
    msg.includes("unauthorized") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("revoked")
  ) {
    return {
      cause: "The API token you entered is invalid or has been revoked.",
      steps: [
        "Open huggingface.co and sign in to your account.",
        "Go to Settings → Access Tokens.",
        'Click "New token", set role to "Read", and copy it.',
        "Paste it here and tap Save Token Securely.",
      ],
      tip: 'Hugging Face tokens start with "hf_".',
    };
  }

  if (
    msg.includes("rate") ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("too many")
  ) {
    return {
      cause:
        "You have exceeded the free-tier rate limit for Hugging Face inference.",
      steps: [
        "Wait a few minutes and tap Test again — free-tier resets quickly.",
        "Consider subscribing to the Hugging Face PRO plan for higher quotas.",
        "Visit huggingface.co/pricing for details.",
      ],
      tip: `Both models (${HF_PRIMARY_MODEL} and ${HF_FALLBACK_MODEL}) will be tried automatically before showing this error.`,
    };
  }

  if (
    msg.includes("503") ||
    msg.includes("loading") ||
    msg.includes("unavailable")
  ) {
    return {
      cause: "The model is currently loading on the Hugging Face servers.",
      steps: [
        "Wait 20–30 seconds for the model to warm up, then tap Test again.",
        "The fallback model will be tried automatically if the primary is unavailable.",
      ],
      tip: "Free-tier models are loaded on demand and may take a moment to start.",
    };
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("connection")
  ) {
    return {
      cause:
        "Could not reach the Hugging Face API — this is likely a network issue.",
      steps: [
        "Check that your device has an active internet connection.",
        "Try switching between Wi-Fi and mobile data.",
        "If you're behind a VPN or proxy, try disabling it temporarily.",
        "Retry once connectivity is restored.",
      ],
    };
  }

  return {
    cause: "The Hugging Face API returned an unexpected error.",
    steps: [
      "Double-check your token at huggingface.co → Settings → Access Tokens.",
      "Delete and recreate the token if it looks correct but still fails.",
      "Make sure your account has access to the Inference API.",
      "If the problem persists, check status.huggingface.co for outages.",
    ],
  };
}

// ─── Section component ───────────────────────────────────────────────────────
// Defined OUTSIDE SettingsScreen so it has a stable identity and never causes
// TextInput focus loss due to unmount/remount on every parent re-render.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const {
    profile,
    saveProfile,
    setGeminiApiKey,
    deleteGeminiApiKey,
    setHuggingFaceApiKey,
    deleteHuggingFaceApiKey,
    setAIProvider: setUserAIProvider,
  } = useUserStore();
  const {
    settings,
    updateSettings,
    setAIProvider,
    acknowledgeGeminiPrivacy,
    acknowledgeHuggingFacePrivacy,
  } = useSettingsStore();

  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const phoneRef = useRef<import("react-native").TextInput>(null);
  const [apiKey, setApiKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyValidationError, setKeyValidationError] = useState<string | null>(
    null,
  );
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<AIProvider | null>(
    null,
  );

  // Load existing API key indicator (don't show actual key)
  const hasApiKey = Boolean(profile?.geminiApiKey);

  // ─── Hugging Face API key state ───────────────────────────────────────
  const [hfApiKey, setHfApiKey] = useState("");
  const [isSavingHfKey, setIsSavingHfKey] = useState(false);
  const [hfKeyValidationError, setHfKeyValidationError] = useState<
    string | null
  >(null);
  const hasHfApiKey = Boolean(profile?.huggingfaceApiKey);

  // ─── Gemini connection status ────────────────────────────────────────
  type GeminiStatus = "idle" | "checking" | "connected" | "error";
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus>("idle");
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const checkGeminiConnection = useCallback(async () => {
    const key = profile?.geminiApiKey;
    if (!key) return;
    setGeminiStatus("checking");
    setGeminiError(null);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
        }),
      });
      if (res.ok || res.status === 400) {
        // 400 means API key is valid but request may be malformed — still connected
        setGeminiStatus("connected");
      } else {
        const body = await res.json().catch(() => ({}));
        setGeminiStatus("error");
        setGeminiError(body?.error?.message ?? `HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setGeminiStatus("error");
      setGeminiError(e instanceof Error ? e.message : "Network error");
    }
  }, [profile?.geminiApiKey]);

  // Auto-check when Gemini is selected and key exists
  useEffect(() => {
    if (settings.aiProvider === "gemini" && hasApiKey) {
      checkGeminiConnection();
    } else {
      setGeminiStatus("idle");
      setGeminiError(null);
    }
  }, [settings.aiProvider, hasApiKey]);

  // ─── Hugging Face connection status ──────────────────────────────────
  type HFStatus = "idle" | "checking" | "connected" | "error";
  const [hfStatus, setHfStatus] = useState<HFStatus>("idle");
  const [hfError, setHfError] = useState<string | null>(null);

  const checkHuggingFaceConnection = useCallback(async () => {
    const key = profile?.huggingfaceApiKey;
    if (!key) return;
    setHfStatus("checking");
    setHfError(null);
    try {
      const res = await fetch(
        "https://api-inference.huggingface.co/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: HF_PRIMARY_MODEL,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
            stream: false,
          }),
        },
      );
      // 200 = success, 429 = rate limited but key valid, 503 = model loading but key valid
      if (res.ok || res.status === 429 || res.status === 503) {
        setHfStatus("connected");
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setHfStatus("error");
        setHfError(body?.error ?? `HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      setHfStatus("error");
      setHfError(e instanceof Error ? e.message : "Network error");
    }
  }, [profile?.huggingfaceApiKey]);

  // Auto-check when HuggingFace is selected and key exists
  useEffect(() => {
    if (settings.aiProvider === "huggingface" && hasHfApiKey) {
      checkHuggingFaceConnection();
    } else {
      setHfStatus("idle");
      setHfError(null);
    }
  }, [settings.aiProvider, hasHfApiKey]);

  // ─── Save Profile ─────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    saveProfile({ name: name.trim(), phone: phone.trim() });
    addAppBreadcrumb("profile saved");
    Alert.alert("Saved", "Profile updated successfully.");
  }, [name, phone]);

  // ─── Provider Switch ──────────────────────────────────────────────────
  const handleProviderChange = useCallback(
    (provider: AIProvider) => {
      if (provider === "gemini" && !settings.geminiPrivacyAcknowledged) {
        // Show one-time privacy modal
        setPendingProvider(provider);
        setShowPrivacyModal(true);
        return;
      }
      if (
        provider === "huggingface" &&
        !settings.huggingfacePrivacyAcknowledged
      ) {
        // Show one-time privacy modal
        setPendingProvider(provider);
        setShowPrivacyModal(true);
        return;
      }
      addAppBreadcrumb("AI provider changed", { provider });
      setAiProviderTag(provider);
      setAIProvider(provider);
      setUserAIProvider(provider);
    },
    [
      settings.geminiPrivacyAcknowledged,
      settings.huggingfacePrivacyAcknowledged,
    ],
  );

  const handleAcceptPrivacy = useCallback(() => {
    if (pendingProvider === "gemini") {
      acknowledgeGeminiPrivacy();
    } else if (pendingProvider === "huggingface") {
      acknowledgeHuggingFacePrivacy();
    }
    if (pendingProvider) {
      addAppBreadcrumb("privacy notice accepted", {
        provider: pendingProvider,
      });
      setAiProviderTag(pendingProvider);
      setAIProvider(pendingProvider);
      setUserAIProvider(pendingProvider);
    }
    setPendingProvider(null);
    setShowPrivacyModal(false);
  }, [pendingProvider]);

  const handleDeclinePrivacy = useCallback(() => {
    setPendingProvider(null);
    setShowPrivacyModal(false);
  }, []);

  // ─── Save API Key (secure store) ──────────────────────────────────────
  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      Alert.alert("Required", "Please enter your Gemini API key.");
      return;
    }
    setKeyValidationError(null);
    setIsSavingKey(true);
    try {
      const result = await validateGeminiApiKey(trimmed);
      if (!result.valid) {
        addAppBreadcrumb("Gemini API key validation failed", {
          error: result.error,
        });
        setKeyValidationError(
          result.error ?? "The key was rejected by the Gemini API.",
        );
        return;
      }
      await setGeminiApiKey(trimmed);
      setApiKey("");
      setKeyValidationError(null);
      addAppBreadcrumb("Gemini API key saved");
      Alert.alert(
        "Saved",
        "Gemini API key verified and stored securely on device.",
      );
    } catch (err) {
      captureError(err, { context: "handleSaveApiKey" });
      throw err;
    } finally {
      setIsSavingKey(false);
    }
  }, [apiKey]);

  const handleDeleteApiKey = useCallback(async () => {
    Alert.alert(
      "Remove API Key",
      "Are you sure you want to remove your Gemini API key? The provider will fall back to Offline.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteGeminiApiKey();
            addAppBreadcrumb("Gemini API key deleted");
            setAiProviderTag("offline");
            setAIProvider("offline");
            setUserAIProvider("offline");
            Alert.alert("Removed", "API key deleted. Provider set to Offline.");
          },
        },
      ],
    );
  }, []);

  // ─── Save / Delete HuggingFace API Token ─────────────────────────────
  const handleSaveHfApiKey = useCallback(async () => {
    const trimmed = hfApiKey.trim();
    if (!trimmed) {
      Alert.alert("Required", "Please enter your Hugging Face API token.");
      return;
    }
    setHfKeyValidationError(null);
    setIsSavingHfKey(true);
    try {
      const result = await validateHuggingFaceApiKey(trimmed);
      if (!result.valid) {
        addAppBreadcrumb("HuggingFace API token validation failed", {
          error: result.error,
        });
        setHfKeyValidationError(
          result.error ?? "The token was rejected by the Hugging Face API.",
        );
        return;
      }
      await setHuggingFaceApiKey(trimmed);
      setHfApiKey("");
      setHfKeyValidationError(null);
      addAppBreadcrumb("HuggingFace API token saved");
      Alert.alert(
        "Saved",
        "Hugging Face API token verified and stored securely on device.",
      );
    } catch (err) {
      captureError(err, { context: "handleSaveHfApiKey" });
      throw err;
    } finally {
      setIsSavingHfKey(false);
    }
  }, [hfApiKey]);

  const handleDeleteHfApiKey = useCallback(async () => {
    Alert.alert(
      "Remove API Token",
      "Are you sure you want to remove your Hugging Face API token? The provider will fall back to Offline.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteHuggingFaceApiKey();
            addAppBreadcrumb("HuggingFace API token deleted");
            setAiProviderTag("offline");
            setAIProvider("offline");
            setUserAIProvider("offline");
            Alert.alert(
              "Removed",
              "API token deleted. Provider set to Offline.",
            );
          },
        },
      ],
    );
  }, []);

  // ─── Export ───────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    addAppBreadcrumb("data export started");
    try {
      await ExportService.exportData();
      addAppBreadcrumb("data export completed");
    } catch (e) {
      captureError(e, { context: "handleExport" });
      Alert.alert("Export Error", String(e));
    }
  }, []);

  // ─── Clear Data ───────────────────────────────────────────────────────
  const handleClearData = useCallback(() => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all notes, summaries, flashcards, and settings. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: () => {
            addAppBreadcrumb("all data cleared by user");
            SettingsRepo.clearAll();
            Alert.alert(
              "Done",
              "All data has been cleared. Please restart the app.",
            );
          },
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Profile */}
        <Section title="👤 Profile">
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              accessibilityLabel="Your name"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Phone
            </Text>
            <TextInput
              ref={phoneRef}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSaveProfile}
              accessibilityLabel="Phone number"
            />
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSaveProfile}
            accessibilityLabel="Save profile"
          >
            <Text style={styles.buttonText}>Save Profile</Text>
          </TouchableOpacity>
        </Section>

        {/* AI Provider */}
        <Section title="🤖 AI Provider">
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Provider
            </Text>
            <View style={styles.providerButtons}>
              {(["offline", "gemini", "huggingface"] as AIProvider[]).map(
                (p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.providerButton,
                      {
                        backgroundColor:
                          settings.aiProvider === p
                            ? colors.primary
                            : colors.surfaceVariant,
                        borderColor:
                          settings.aiProvider === p
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                    onPress={() => handleProviderChange(p)}
                    accessibilityLabel={`Select ${p} provider`}
                  >
                    <Text
                      style={{
                        color:
                          settings.aiProvider === p ? "#FFFFFF" : colors.text,
                        fontWeight: "600",
                        fontSize: FontSize.sm,
                      }}
                    >
                      {p === "offline"
                        ? "📱 Offline"
                        : p === "gemini"
                          ? "✨ Gemini"
                          : "🤗 HuggingFace"}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
          </View>

          {settings.aiProvider === "gemini" && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Gemini API Key
              </Text>
              {hasApiKey ? (
                <>
                  <View style={styles.apiKeyRow}>
                    <Text style={[styles.apiKeyStatus, { color: colors.text }]}>
                      ✅ Key stored securely
                    </Text>
                    <TouchableOpacity onPress={handleDeleteApiKey}>
                      <Text
                        style={{
                          color: colors.danger,
                          fontWeight: "600",
                          fontSize: FontSize.sm,
                        }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Connection indicator */}
                  <View
                    style={[
                      styles.connectionRow,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {geminiStatus === "checking" ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.statusDot}
                      />
                    ) : (
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              geminiStatus === "connected"
                                ? "#22c55e"
                                : geminiStatus === "error"
                                  ? "#ef4444"
                                  : colors.textMuted,
                          },
                        ]}
                      />
                    )}
                    <View style={styles.connectionTextBox}>
                      <Text
                        style={[styles.connectionLabel, { color: colors.text }]}
                      >
                        {geminiStatus === "checking"
                          ? "Checking connection…"
                          : geminiStatus === "connected"
                            ? "Connected to Gemini"
                            : geminiStatus === "error"
                              ? "Connection failed"
                              : "Not checked"}
                      </Text>
                      {geminiStatus === "error" && geminiError ? (
                        <Text
                          style={[
                            styles.connectionError,
                            { color: colors.danger },
                          ]}
                          numberOfLines={2}
                        >
                          {geminiError}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={checkGeminiConnection}
                      disabled={geminiStatus === "checking"}
                      style={[
                        styles.retestButton,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: FontSize.xs,
                          fontWeight: "600",
                        }}
                      >
                        Test
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Inline help for saved-key connection errors */}
                  {geminiStatus === "error" && geminiError
                    ? (() => {
                        const help = getGeminiErrorHelp(geminiError);
                        return (
                          <View
                            style={[
                              styles.keyHelpBox,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.danger,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.keyHelpHeader,
                                { color: colors.danger },
                              ]}
                            >
                              ⚠️ Connection failed
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpCause,
                                { color: colors.text },
                              ]}
                            >
                              {help.cause}
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpStepsTitle,
                                { color: colors.text },
                              ]}
                            >
                              How to fix:
                            </Text>
                            {help.steps.map((step, i) => (
                              <View key={i} style={styles.keyHelpStepRow}>
                                <Text
                                  style={[
                                    styles.keyHelpStepNum,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {i + 1}.
                                </Text>
                                <Text
                                  style={[
                                    styles.keyHelpStepText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {step}
                                </Text>
                              </View>
                            ))}
                            {help.tip ? (
                              <Text
                                style={[
                                  styles.keyHelpTip,
                                  {
                                    color: colors.textSecondary,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                💡 {help.tip}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })()
                    : null}
                </>
              ) : (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    value={apiKey}
                    onChangeText={(v) => {
                      setApiKey(v);
                      if (keyValidationError) setKeyValidationError(null);
                    }}
                    placeholder="Paste your Gemini API key"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Gemini API key"
                  />
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: isSavingKey
                          ? colors.surfaceVariant
                          : colors.primary,
                        marginTop: Spacing.sm,
                        opacity: isSavingKey ? 0.7 : 1,
                      },
                    ]}
                    onPress={handleSaveApiKey}
                    disabled={isSavingKey}
                    accessibilityLabel="Save API key"
                  >
                    {isSavingKey ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.buttonText}>Save Key Securely</Text>
                    )}
                  </TouchableOpacity>

                  {/* Inline validation error + help */}
                  {keyValidationError
                    ? (() => {
                        const help = getGeminiErrorHelp(keyValidationError);
                        return (
                          <View
                            style={[
                              styles.keyHelpBox,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.danger,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.keyHelpHeader,
                                { color: colors.danger },
                              ]}
                            >
                              ⚠️ Key verification failed
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpError,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {keyValidationError}
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpCause,
                                { color: colors.text },
                              ]}
                            >
                              {help.cause}
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpStepsTitle,
                                { color: colors.text },
                              ]}
                            >
                              How to fix:
                            </Text>
                            {help.steps.map((step, i) => (
                              <View key={i} style={styles.keyHelpStepRow}>
                                <Text
                                  style={[
                                    styles.keyHelpStepNum,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {i + 1}.
                                </Text>
                                <Text
                                  style={[
                                    styles.keyHelpStepText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {step}
                                </Text>
                              </View>
                            ))}
                            {help.tip ? (
                              <Text
                                style={[
                                  styles.keyHelpTip,
                                  {
                                    color: colors.textSecondary,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                💡 {help.tip}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })()
                    : null}
                </>
              )}
            </View>
          )}

          {/* ── Hugging Face API Token section ── */}
          {settings.aiProvider === "huggingface" && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Hugging Face API Token
              </Text>
              <Text
                style={[
                  {
                    color: colors.textMuted,
                    fontSize: FontSize.xs,
                    marginBottom: Spacing.xs,
                  },
                ]}
              >
                Primary: {HF_PRIMARY_MODEL}
                {"\n"}
                Fallback (auto on rate-limit): {HF_FALLBACK_MODEL}
              </Text>
              {hasHfApiKey ? (
                <>
                  <View style={styles.apiKeyRow}>
                    <Text style={[styles.apiKeyStatus, { color: colors.text }]}>
                      ✅ Token stored securely
                    </Text>
                    <TouchableOpacity onPress={handleDeleteHfApiKey}>
                      <Text
                        style={{
                          color: colors.danger,
                          fontWeight: "600",
                          fontSize: FontSize.sm,
                        }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Connection indicator */}
                  <View
                    style={[
                      styles.connectionRow,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {hfStatus === "checking" ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.statusDot}
                      />
                    ) : (
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              hfStatus === "connected"
                                ? "#22c55e"
                                : hfStatus === "error"
                                  ? "#ef4444"
                                  : colors.textMuted,
                          },
                        ]}
                      />
                    )}
                    <View style={styles.connectionTextBox}>
                      <Text
                        style={[styles.connectionLabel, { color: colors.text }]}
                      >
                        {hfStatus === "checking"
                          ? "Checking connection…"
                          : hfStatus === "connected"
                            ? "Connected to Hugging Face"
                            : hfStatus === "error"
                              ? "Connection failed"
                              : "Not checked"}
                      </Text>
                      {hfStatus === "error" && hfError ? (
                        <Text
                          style={[
                            styles.connectionError,
                            { color: colors.danger },
                          ]}
                          numberOfLines={2}
                        >
                          {hfError}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={checkHuggingFaceConnection}
                      disabled={hfStatus === "checking"}
                      style={[
                        styles.retestButton,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: FontSize.xs,
                          fontWeight: "600",
                        }}
                      >
                        Test
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Inline help for saved-key connection errors */}
                  {hfStatus === "error" && hfError
                    ? (() => {
                        const help = getHuggingFaceErrorHelp(hfError);
                        return (
                          <View
                            style={[
                              styles.keyHelpBox,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.danger,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.keyHelpHeader,
                                { color: colors.danger },
                              ]}
                            >
                              ⚠️ Connection failed
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpCause,
                                { color: colors.text },
                              ]}
                            >
                              {help.cause}
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpStepsTitle,
                                { color: colors.text },
                              ]}
                            >
                              How to fix:
                            </Text>
                            {help.steps.map((step, i) => (
                              <View key={i} style={styles.keyHelpStepRow}>
                                <Text
                                  style={[
                                    styles.keyHelpStepNum,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {i + 1}.
                                </Text>
                                <Text
                                  style={[
                                    styles.keyHelpStepText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {step}
                                </Text>
                              </View>
                            ))}
                            {help.tip ? (
                              <Text
                                style={[
                                  styles.keyHelpTip,
                                  {
                                    color: colors.textSecondary,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                💡 {help.tip}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })()
                    : null}
                </>
              ) : (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    value={hfApiKey}
                    onChangeText={(v) => {
                      setHfApiKey(v);
                      if (hfKeyValidationError) setHfKeyValidationError(null);
                    }}
                    placeholder="Paste your Hugging Face token (hf_…)"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Hugging Face API token"
                  />
                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: isSavingHfKey
                          ? colors.surfaceVariant
                          : colors.primary,
                        marginTop: Spacing.sm,
                        opacity: isSavingHfKey ? 0.7 : 1,
                      },
                    ]}
                    onPress={handleSaveHfApiKey}
                    disabled={isSavingHfKey}
                    accessibilityLabel="Save HuggingFace API token"
                  >
                    {isSavingHfKey ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.buttonText}>Save Token Securely</Text>
                    )}
                  </TouchableOpacity>

                  {/* Inline validation error + help */}
                  {hfKeyValidationError
                    ? (() => {
                        const help =
                          getHuggingFaceErrorHelp(hfKeyValidationError);
                        return (
                          <View
                            style={[
                              styles.keyHelpBox,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.danger,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.keyHelpHeader,
                                { color: colors.danger },
                              ]}
                            >
                              ⚠️ Token verification failed
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpError,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {hfKeyValidationError}
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpCause,
                                { color: colors.text },
                              ]}
                            >
                              {help.cause}
                            </Text>
                            <Text
                              style={[
                                styles.keyHelpStepsTitle,
                                { color: colors.text },
                              ]}
                            >
                              How to fix:
                            </Text>
                            {help.steps.map((step, i) => (
                              <View key={i} style={styles.keyHelpStepRow}>
                                <Text
                                  style={[
                                    styles.keyHelpStepNum,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {i + 1}.
                                </Text>
                                <Text
                                  style={[
                                    styles.keyHelpStepText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {step}
                                </Text>
                              </View>
                            ))}
                            {help.tip ? (
                              <Text
                                style={[
                                  styles.keyHelpTip,
                                  {
                                    color: colors.textSecondary,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                💡 {help.tip}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })()
                    : null}
                </>
              )}
            </View>
          )}

          {/* Privacy notice (always visible under AI Provider) */}
          <View
            style={[
              styles.privacyBox,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.privacyTitle, { color: colors.text }]}>
              🔒 Privacy
            </Text>
            <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
              {settings.aiProvider === "huggingface"
                ? HF_PRIVACY_NOTICE
                : PRIVACY_NOTICE}
            </Text>
          </View>
        </Section>

        {/* Recording Options */}
        <Section title="🎤 Recording">
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Auto-Punctuate
            </Text>
            <Switch
              value={settings.autoPunctuate}
              onValueChange={(v) => updateSettings({ autoPunctuate: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Silence Trimming
            </Text>
            <Switch
              value={settings.silenceTrimming}
              onValueChange={(v) => updateSettings({ silenceTrimming: v })}
              trackColor={{ true: colors.primary }}
            />
          </View>
        </Section>

        {/* Data Management */}
        <Section title="💾 Data">
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleExport}
            accessibilityLabel="Export all data"
          >
            <Text style={styles.buttonText}>📤 Export Data (JSON)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.danger, marginTop: Spacing.md },
            ]}
            onPress={handleClearData}
            accessibilityLabel="Clear all data"
          >
            <Text style={styles.buttonText}>🗑 Clear All Data</Text>
          </TouchableOpacity>
        </Section>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.textMuted }]}>
            NoteGenius v1.0.0
          </Text>
          <Text style={[styles.appTagline, { color: colors.textMuted }]}>
            Offline-first Voice Notes + AI Summarizer + Flashcards
          </Text>
        </View>
      </ScrollView>

      {/* ─── One-time AI provider privacy consent modal ──────────────────── */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={handleDeclinePrivacy}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {pendingProvider === "huggingface"
                ? "🤗 Enable Hugging Face AI"
                : "✨ Enable Gemini AI"}
            </Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                {pendingProvider === "huggingface"
                  ? HF_PRIVACY_NOTICE
                  : PRIVACY_NOTICE}
              </Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                onPress={handleDeclinePrivacy}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleAcceptPrivacy}
              >
                <Text style={[styles.modalButtonText, { color: "#FFFFFF" }]}>
                  I Understand
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.body,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  rowLabel: {
    fontSize: FontSize.body,
  },
  providerButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  providerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  button: {
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: FontSize.md,
  },
  appInfo: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  appName: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  appTagline: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  apiKeyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  apiKeyStatus: {
    fontSize: FontSize.body,
    fontWeight: "500",
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectionTextBox: {
    flex: 1,
  },
  connectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  connectionError: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  retestButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  keyHelpBox: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  keyHelpHeader: {
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  keyHelpError: {
    fontSize: FontSize.xs,
    fontStyle: "italic",
  },
  keyHelpCause: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  keyHelpStepsTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    marginTop: 4,
  },
  keyHelpStepRow: {
    flexDirection: "row",
    gap: 6,
    paddingLeft: 4,
  },
  keyHelpStepNum: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    minWidth: 18,
  },
  keyHelpStepText: {
    fontSize: FontSize.sm,
    lineHeight: 19,
    flex: 1,
  },
  keyHelpTip: {
    fontSize: FontSize.xs,
    lineHeight: 17,
    borderTopWidth: 1,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  privacyBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  privacyTitle: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  privacyText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxHeight: "70%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: "800",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  modalScroll: {
    maxHeight: 250,
    marginBottom: Spacing.md,
  },
  modalBody: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  modalButtonText: {
    fontWeight: "700",
    fontSize: FontSize.md,
  },
});
