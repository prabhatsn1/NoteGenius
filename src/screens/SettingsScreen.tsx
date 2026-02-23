/**
 * NoteGenius – Settings Screen.
 * Profile, AI Provider (Offline / Gemini), Data export/import, Recording options, Clear data.
 */
import React, { useCallback, useEffect, useState } from "react";
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

export default function SettingsScreen() {
  const colors = useThemeColors();
  const {
    profile,
    saveProfile,
    setGeminiApiKey,
    deleteGeminiApiKey,
    setAIProvider: setUserAIProvider,
  } = useUserStore();
  const { settings, updateSettings, setAIProvider, acknowledgeGeminiPrivacy } =
    useSettingsStore();

  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<AIProvider | null>(
    null,
  );

  // Load existing API key indicator (don't show actual key)
  const hasApiKey = Boolean(profile?.geminiApiKey);

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

  // ─── Save Profile ─────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(() => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    saveProfile({ name: name.trim(), phone: phone.trim() });
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
      setAIProvider(provider);
      setUserAIProvider(provider);
    },
    [settings.geminiPrivacyAcknowledged],
  );

  const handleAcceptPrivacy = useCallback(() => {
    acknowledgeGeminiPrivacy();
    if (pendingProvider) {
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
    await setGeminiApiKey(trimmed);
    setApiKey("");
    Alert.alert("Saved", "Gemini API key stored securely on device.");
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
            setAIProvider("offline");
            setUserAIProvider("offline");
            Alert.alert("Removed", "API key deleted. Provider set to Offline.");
          },
        },
      ],
    );
  }, []);

  // ─── Export ───────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    try {
      await ExportService.exportData();
    } catch (e) {
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

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );

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
              accessibilityLabel="Your name"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Phone
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
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
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
              {(["offline", "gemini"] as AIProvider[]).map((p) => (
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
                    {p === "offline" ? "📱 Offline" : "✨ Gemini"}
                  </Text>
                </TouchableOpacity>
              ))}
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
                    onChangeText={setApiKey}
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
                        backgroundColor: colors.primary,
                        marginTop: Spacing.sm,
                      },
                    ]}
                    onPress={handleSaveApiKey}
                    accessibilityLabel="Save API key"
                  >
                    <Text style={styles.buttonText}>Save Key Securely</Text>
                  </TouchableOpacity>
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
              {PRIVACY_NOTICE}
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

      {/* ─── One-time Gemini privacy consent modal ──────────────────────── */}
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
              ✨ Enable Gemini AI
            </Text>
            <ScrollView style={styles.modalScroll}>
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                {PRIVACY_NOTICE}
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
