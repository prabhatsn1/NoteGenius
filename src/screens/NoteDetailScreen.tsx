/**
 * NoteGenius – Note Detail Screen.
 * Shows segments (filter: all/voice/typed), generates summary,
 * Einstein panel, playback controls, and "Create Flashcards" button.
 *
 * Uses the selectable AI provider (Offline / Gemini) via useAi() hook.
 * If Gemini fails, automatically falls back to Offline with a toast.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EinsteinPanel } from "../components/EinsteinPanel";
import { SegmentsList } from "../components/SegmentsList";
import { SummaryView } from "../components/SummaryView";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import { makeAiProvider } from "../services/ai";
import { useAi } from "../services/ai/useAi";
import { AudioPlayer } from "../services/audio/recorder";
import { useFlashcardsStore } from "../store/useFlashcardsStore";
import { useNotesStore } from "../store/useNotesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useUserStore } from "../store/useUserStore";
import type { Flashcard, SegmentFilter, Summary } from "../types/models";
import { formatDate, formatDuration } from "../utils/time";
import { generateId } from "../utils/uuid";

type DetailTab = "segments" | "summary" | "einstein";

export default function NoteDetailScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentNote,
    currentSegments,
    currentSummary,
    selectNote,
    saveSummary,
  } = useNotesStore();
  const { addCards } = useFlashcardsStore();
  const { profile } = useUserStore();
  const { settings } = useSettingsStore();
  const ai = useAi();

  const [activeTab, setActiveTab] = useState<DetailTab>("segments");
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (id) selectNote(id);
  }, [id]);

  /** Build transcript string from segments — the minimum data sent to any provider. */
  const buildTranscript = useCallback((): string => {
    return currentSegments.map((s) => s.text).join(". ");
  }, [currentSegments]);

  // ─── Generate Summary ─────────────────────────────────────────────────
  const handleGenerateSummary = useCallback(async () => {
    if (!currentNote || currentSegments.length === 0) {
      Alert.alert("No Content", "Record some voice notes or type text first.");
      return;
    }

    setIsGenerating(true);
    const transcript = buildTranscript();
    const userName = profile?.name ?? "User";

    try {
      const result = await ai.summarize(transcript, userName);
      const summary: Summary = {
        id: generateId(),
        noteId: currentNote.id,
        ...result,
        createdAt: Date.now(),
        provider: settings.aiProvider,
      };
      await saveSummary(summary);
      setActiveTab("summary");
    } catch (err) {
      console.error(`[${ai.label}] summarize failed:`, err);

      // Fallback to offline if Gemini failed
      if (settings.aiProvider === "gemini") {
        Alert.alert(
          "Gemini Unavailable",
          "Falling back to Offline summarizer.",
        );
        try {
          const offline = makeAiProvider("offline");
          const result = await offline.summarize(transcript, userName);
          const summary: Summary = {
            id: generateId(),
            noteId: currentNote.id,
            ...result,
            createdAt: Date.now(),
            provider: "offline",
          };
          await saveSummary(summary);
          setActiveTab("summary");
        } catch (fallbackErr) {
          Alert.alert("Error", "Failed to generate summary.");
          console.error("[Offline fallback] summarize failed:", fallbackErr);
        }
      } else {
        Alert.alert("Error", "Failed to generate summary.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    currentNote,
    currentSegments,
    settings.aiProvider,
    profile,
    ai,
    buildTranscript,
  ]);

  // ─── Create Flashcards ────────────────────────────────────────────────
  const handleCreateFlashcards = useCallback(async () => {
    if (!currentSummary || !currentNote) {
      Alert.alert(
        "Generate Summary First",
        "Please generate a summary before creating flashcards.",
      );
      return;
    }

    setIsGenerating(true);
    const transcript = buildTranscript();

    try {
      const rawCards = await ai.generateFlashcards(transcript, currentSummary);
      if (rawCards.length === 0) {
        Alert.alert("No Cards", "Not enough content to generate flashcards.");
        setIsGenerating(false);
        return;
      }
      const now = Date.now();
      const isAi = settings.aiProvider === "gemini";
      const cards: Flashcard[] = rawCards.map((c) => ({
        id: generateId(),
        noteId: currentNote.id,
        type: c.type,
        front: c.front,
        back: c.back,
        tags: isAi ? [...c.tags, "ai-generated"] : c.tags,
        difficulty: 3,
        interval: 0,
        repetitions: 0,
        easiness: 2.5,
        nextReviewAt: now,
        createdAt: now,
        updatedAt: now,
      }));
      await addCards(cards);
      Alert.alert(
        "Success",
        `Created ${cards.length} flashcard${cards.length > 1 ? "s" : ""}!`,
      );
    } catch (err) {
      console.error(`[${ai.label}] generateFlashcards failed:`, err);

      // Fallback to offline if Gemini failed
      if (settings.aiProvider === "gemini") {
        Alert.alert(
          "Gemini Unavailable",
          "Falling back to Offline flashcard generator.",
        );
        try {
          const offline = makeAiProvider("offline");
          const rawCards = await offline.generateFlashcards(
            transcript,
            currentSummary,
          );
          if (rawCards.length === 0) {
            Alert.alert(
              "No Cards",
              "Not enough content to generate flashcards.",
            );
            setIsGenerating(false);
            return;
          }
          const now = Date.now();
          const cards: Flashcard[] = rawCards.map((c) => ({
            id: generateId(),
            noteId: currentNote.id,
            type: c.type,
            front: c.front,
            back: c.back,
            tags: c.tags,
            difficulty: 3,
            interval: 0,
            repetitions: 0,
            easiness: 2.5,
            nextReviewAt: now,
            createdAt: now,
            updatedAt: now,
          }));
          await addCards(cards);
          Alert.alert(
            "Success",
            `Created ${cards.length} flashcard${cards.length > 1 ? "s" : ""}! (via Offline fallback)`,
          );
        } catch (fallbackErr) {
          Alert.alert("Error", "Failed to create flashcards.");
          console.error(
            "[Offline fallback] generateFlashcards failed:",
            fallbackErr,
          );
        }
      } else {
        Alert.alert("Error", "Failed to create flashcards.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    currentNote,
    currentSummary,
    currentSegments,
    settings.aiProvider,
    ai,
    buildTranscript,
  ]);

  // ─── Audio Playback ───────────────────────────────────────────────────
  const handlePlayAudio = useCallback(async () => {
    if (!currentNote?.audioPath) return;
    if (isPlaying) {
      await AudioPlayer.stop();
      setIsPlaying(false);
    } else {
      await AudioPlayer.play(currentNote.audioPath, () => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [currentNote, isPlaying]);

  if (!currentNote) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "segments", label: "Segments" },
    { key: "summary", label: "Summary" },
    { key: "einstein", label: "🧠 Einstein" },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backButton, { color: colors.primary }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {currentNote.title}
        </Text>
      </View>

      {/* Meta info */}
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {formatDate(currentNote.createdAt)}
        </Text>
        {currentNote.durationMs && (
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            🎤 {formatDuration(currentNote.durationMs)}
          </Text>
        )}
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {currentSegments.length} segment
          {currentSegments.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Audio playback */}
      {currentNote.audioPath && (
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.primary }]}
          onPress={handlePlayAudio}
          accessibilityLabel={isPlaying ? "Stop playback" : "Play recording"}
        >
          <Text style={styles.playButtonText}>
            {isPlaying ? "⏹ Stop" : "▶ Play Recording"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Tab bar */}
      <View style={styles.tabsRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === tab.key
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === "segments" && (
          <SegmentsList
            segments={currentSegments}
            filter={segmentFilter}
            onFilterChange={setSegmentFilter}
          />
        )}

        {activeTab === "summary" &&
          (currentSummary ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollContent}
            >
              <SummaryView summary={currentSummary} />
            </ScrollView>
          ) : (
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No summary yet
              </Text>
            </View>
          ))}

        {activeTab === "einstein" &&
          (currentSummary ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollContent}
            >
              <EinsteinPanel summary={currentSummary} />
            </ScrollView>
          ) : (
            <View style={styles.emptyContent}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Generate a summary first to unlock Einstein features
              </Text>
            </View>
          ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleGenerateSummary}
          disabled={isGenerating}
          accessibilityLabel="Generate summary"
        >
          {isGenerating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>
              {currentSummary ? "🔄 Regenerate" : "📋 Generate"} Summary
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.accent }]}
          onPress={handleCreateFlashcards}
          accessibilityLabel="Create flashcards"
        >
          <Text style={styles.actionButtonText}>🃏 Create Flashcards</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  backButton: {
    fontSize: FontSize.body,
    fontWeight: "600",
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  playButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: FontSize.md,
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: FontSize.md,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: FontSize.sm,
  },
});
