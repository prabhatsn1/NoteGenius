/**
 * NoteGenius – Record Screen.
 * Big Record button, timer, waveform, live transcript area,
 * floating text input to type while recording, Pause/Resume/Stop,
 * language picker, and "Mark Highlight" bookmark button.
 */
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WaveformView } from "../components/WaveformView";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import { makeAiProvider } from "../services/ai";
import { AudioRecorder } from "../services/audio/recorder";
import {
  destroySTTProvider,
  getSTTProvider,
} from "../services/stt/sttProvider";
import { useNotesStore } from "../store/useNotesStore";
import { useRecordingStore } from "../store/useRecordingStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useUserStore } from "../store/useUserStore";
import type { NoteSegment } from "../types/models";
import { Permissions } from "../utils/permissions";
import { normalizeTranscript } from "../utils/text";
import { formatDuration } from "../utils/time";
import { generateId } from "../utils/uuid";

const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "ja-JP", label: "Japanese" },
  { code: "zh-CN", label: "Chinese" },
];

/** Timer interval in ms */
const TIMER_INTERVAL = 100;
/** Autosave interval in ms */
const AUTOSAVE_INTERVAL = 3000;

export default function RecordScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meteringRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  // Tracks the text committed to segments so far in this STT session so that
  // on session end we only save the incremental delta (not the full cumulative).
  const lastCommittedTextRef = useRef<string>("");
  // Mirror of the languageCode state — safe to read inside async callbacks/refs.
  // Initialized to the same default as the languageCode useState below.
  const languageCodeRef = useRef<string>("en-US");
  // Set to true before an intentional stop/pause so that onSessionEnd does NOT
  // auto-restart the recogniser.
  const isIntentionallyStoppingRef = useRef<boolean>(false);

  const {
    status,
    elapsedMs,
    waveform,
    liveTranscript,
    sessionSegments,
    noteId,
    highlights,
    setStatus,
    setElapsedMs,
    appendWaveform,
    setLiveTranscript,
    addSessionSegment,
    setNoteId,
    addHighlight,
    resetRecording,
  } = useRecordingStore();

  const { createNote, updateNote, addSegment, addSegments } = useNotesStore();

  const [typedText, setTypedText] = useState("");
  const [languageCode, setLanguageCode] = useState("en-US");

  // Keep the ref in sync so onSessionEnd closures always see the latest code.
  useEffect(() => {
    languageCodeRef.current = languageCode;
  }, [languageCode]);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const transcriptScrollRef = useRef<ScrollView>(null);

  // ─── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimers();
      destroySTTProvider();
    };
  }, []);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autosaveRef.current) clearInterval(autosaveRef.current);
    if (meteringRef.current) clearInterval(meteringRef.current);
    timerRef.current = null;
    autosaveRef.current = null;
    meteringRef.current = null;
  };

  // ─── Start Recording ──────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const hasPermission = await Permissions.requestMicrophone();
    if (!hasPermission) return;

    // Create a new note
    const note = await createNote("Untitled Recording", languageCode);
    setNoteId(note.id);

    // Start audio recording
    const rec = await AudioRecorder.start();
    if (!rec) {
      Alert.alert("Error", "Failed to start recording.");
      return;
    }

    // Start STT
    lastCommittedTextRef.current = ""; // reset for new session
    isIntentionallyStoppingRef.current = false;
    const stt = getSTTProvider();

    /**
     * Called when a recognition session truly ends (onSpeechEnd).
     * Commits any pending transcript as a segment, then auto-restarts
     * recognition so transcription continues uninterrupted.
     */
    const handleSessionEnd = () => {
      if (isIntentionallyStoppingRef.current) {
        // Explicit pause/stop triggered this end — do not restart.
        isIntentionallyStoppingRef.current = false;
        return;
      }
      // Auto-restart for continuous transcription.
      lastCommittedTextRef.current = "";
      stt
        .start(languageCodeRef.current)
        .catch((err) => console.warn("[STT auto-restart]", err));
    };

    stt.onResult = (text, isFinal) => {
      setLiveTranscript(text);
      if (isFinal && text.trim()) {
        // The sttProvider only emits isFinal=true from onSpeechEnd, so this
        // text is the genuine final transcript for the completed session.
        const fullText = text.trim();
        const delta = fullText.startsWith(lastCommittedTextRef.current)
          ? fullText.slice(lastCommittedTextRef.current.length).trim()
          : fullText;
        if (delta) {
          lastCommittedTextRef.current = fullText;
          const now = Date.now();
          const seg: NoteSegment = {
            id: generateId(),
            noteId: note.id,
            source: "voice",
            text: normalizeTranscript(delta),
            startMs: now - startTimeRef.current - pausedDurationRef.current,
            endMs: now - startTimeRef.current - pausedDurationRef.current,
          };
          addSessionSegment(seg);
        }
        setLiveTranscript("");
      }
    };
    stt.onSessionEnd = handleSessionEnd;
    stt.onError = (err) => {
      console.warn("[STT Error]", err);
    };
    await stt.start(languageCode);

    // Start timer
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    timerRef.current = setInterval(() => {
      setElapsedMs(
        Date.now() - startTimeRef.current - pausedDurationRef.current,
      );
    }, TIMER_INTERVAL);

    // Start waveform metering
    meteringRef.current = setInterval(async () => {
      const s = await AudioRecorder.getStatus();
      if (s?.metering != null) {
        // Normalize dB metering to 0..1 (metering is typically -160..0)
        const norm = Math.max(0, Math.min(1, (s.metering + 60) / 60));
        appendWaveform(norm);
      }
    }, 100);

    // Autosave draft segments
    autosaveRef.current = setInterval(() => {
      // segments are already in store; could persist here
    }, AUTOSAVE_INTERVAL);

    setStatus("recording");
  }, [languageCode]);

  // ─── Pause Recording ──────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    // Commit any in-flight live transcript before killing the STT session.
    const { liveTranscript: pendingText, noteId: currentNoteId } =
      useRecordingStore.getState();
    if (pendingText.trim() && currentNoteId) {
      const now = Date.now();
      const seg: NoteSegment = {
        id: generateId(),
        noteId: currentNoteId,
        source: "voice",
        text: normalizeTranscript(pendingText.trim()),
        startMs: now - startTimeRef.current - pausedDurationRef.current,
        endMs: now - startTimeRef.current - pausedDurationRef.current,
      };
      addSessionSegment(seg);
      setLiveTranscript("");
    }

    // Use cancel() instead of stop() so the native engine tears down
    // immediately WITHOUT firing onSpeechEnd — avoiding the async race where
    // a stale onSpeechEnd fires after the user has already resumed and
    // triggers a second Voice.start() on top of the new session.
    isIntentionallyStoppingRef.current = true;
    const stt = getSTTProvider();
    await stt.cancel();

    await AudioRecorder.pause();
    pauseStartRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    if (meteringRef.current) clearInterval(meteringRef.current);
    setStatus("paused");
  }, [addSessionSegment, setLiveTranscript]);

  // ─── Resume Recording ─────────────────────────────────────────────────
  const handleResume = useCallback(async () => {
    await AudioRecorder.resume();

    // Give the native Voice engine a moment to fully settle after cancel()
    // before starting a new recognition session.
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    lastCommittedTextRef.current = ""; // reset for new STT session after resume
    isIntentionallyStoppingRef.current = false;
    const stt = getSTTProvider();
    await stt.start(languageCode);
    pausedDurationRef.current += Date.now() - pauseStartRef.current;
    timerRef.current = setInterval(() => {
      setElapsedMs(
        Date.now() - startTimeRef.current - pausedDurationRef.current,
      );
    }, TIMER_INTERVAL);
    meteringRef.current = setInterval(async () => {
      const s = await AudioRecorder.getStatus();
      if (s?.metering != null) {
        const norm = Math.max(0, Math.min(1, (s.metering + 60) / 60));
        appendWaveform(norm);
      }
    }, 100);
    setStatus("recording");
  }, [languageCode]);

  // ─── Stop Recording ───────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    clearTimers();

    const stt = getSTTProvider();
    isIntentionallyStoppingRef.current = true; // prevent onSessionEnd from restarting
    await stt.stop();

    // Give the STT engine time to fire onSpeechEnd and flush the final segment.
    // 600 ms is conservative but reliable on both physical devices and simulators.
    await new Promise<void>((resolve) => setTimeout(resolve, 600));

    // After the wait, commit ANY remaining liveTranscript that the STT callback
    // may have updated (or that was pending before stop) – this is the canonical
    // "last words" safety net.
    const { liveTranscript: pendingText, noteId: currentNoteId } =
      useRecordingStore.getState();
    if (pendingText.trim() && currentNoteId) {
      const now = Date.now();
      const seg: NoteSegment = {
        id: generateId(),
        noteId: currentNoteId,
        source: "voice",
        text: normalizeTranscript(pendingText.trim()),
        startMs: now - startTimeRef.current - pausedDurationRef.current,
        endMs: now - startTimeRef.current - pausedDurationRef.current,
      };
      addSessionSegment(seg);
      setLiveTranscript("");
    }

    const result = await AudioRecorder.stop();

    // Read fresh state – avoids stale-closure bug where segments added by the
    // onSpeechEnd callback (above awaits) are invisible to this function.
    const { noteId: freshNoteId, sessionSegments: freshSegments } =
      useRecordingStore.getState();

    if (!freshNoteId) {
      setStatus("idle");
      resetRecording();
      return;
    }

    // Merge all voice segments into one; keep typed segments as-is.
    // Segments are saved regardless of whether audio recording succeeded so
    // the transcript is never lost even if the audio file failed.
    const voiceSegs = freshSegments.filter((s) => s.source === "voice");
    const typedSegs = freshSegments.filter((s) => s.source === "typed");

    const mergedVoice: NoteSegment | null =
      voiceSegs.length > 0
        ? {
            id: generateId(),
            noteId: freshNoteId,
            source: "voice",
            text: voiceSegs.map((s) => s.text).join(" "),
            startMs: voiceSegs[0].startMs,
            endMs: voiceSegs[voiceSegs.length - 1].endMs,
          }
        : null;

    const segmentsToSave = [
      ...(mergedVoice ? [mergedVoice] : []),
      ...typedSegs,
    ];

    if (segmentsToSave.length > 0) {
      await addSegments(segmentsToSave);
    }

    // Generate an AI title from the transcript (best-effort; never blocks navigation).
    const transcript = segmentsToSave.map((s) => s.text).join(" ");
    const fallbackTitle = `Recording – ${new Date().toLocaleDateString()}`;
    let noteTitle = fallbackTitle;
    if (transcript.trim().length > 0) {
      try {
        const { settings } = useSettingsStore.getState();
        const { profile } = useUserStore.getState();
        const aiProvider = makeAiProvider(
          settings.aiProvider,
          profile?.geminiApiKey,
          settings.geminiModel,
        );
        const generated = await aiProvider.generateTitle(transcript);
        if (generated.trim().length > 0) noteTitle = generated.trim();
      } catch {
        // silently fall back to date-based title
      }
    }

    // Update note title; add audio path/duration only if recorder succeeded.
    if (result) {
      await updateNote({
        id: freshNoteId,
        audioPath: result.uri,
        durationMs: result.durationMs,
        title: noteTitle,
      });
    } else {
      await updateNote({
        id: freshNoteId,
        title: noteTitle,
      });
    }

    setStatus("stopped");

    // Navigate to note detail
    router.push(`/note/${freshNoteId}` as any);
    resetRecording();
  }, []);

  // ─── Submit typed text ────────────────────────────────────────────────
  const handleSubmitTyped = useCallback(() => {
    if (!typedText.trim() || !noteId) return;
    const now = Date.now();
    const seg: NoteSegment = {
      id: generateId(),
      noteId,
      source: "typed",
      text: typedText.trim(),
      startMs: now - startTimeRef.current - pausedDurationRef.current,
      endMs: now - startTimeRef.current - pausedDurationRef.current,
    };
    addSessionSegment(seg);
    setTypedText("");
  }, [typedText, noteId]);

  // ─── Mark Highlight ───────────────────────────────────────────────────
  const handleMarkHighlight = useCallback(() => {
    addHighlight(elapsedMs);
  }, [elapsedMs]);

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isIdle = status === "idle";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Record</Text>
        {/* Language Picker */}
        <TouchableOpacity
          style={[
            styles.langButton,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
            },
          ]}
          onPress={() => setShowLanguagePicker(!showLanguagePicker)}
          accessibilityLabel="Select language"
        >
          <Text style={[styles.langText, { color: colors.text }]}>
            🌐{" "}
            {LANGUAGES.find((l) => l.code === languageCode)?.label ??
              languageCode}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Language picker dropdown */}
      {showLanguagePicker && (
        <View
          style={[
            styles.langDropdown,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.langOption,
                languageCode === lang.code && {
                  backgroundColor: colors.primary + "20",
                },
              ]}
              onPress={() => {
                setLanguageCode(lang.code);
                setShowLanguagePicker(false);
              }}
            >
              <Text style={[styles.langOptionText, { color: colors.text }]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Timer */}
      <Text style={[styles.timer, { color: colors.text }]}>
        {formatDuration(elapsedMs)}
      </Text>

      {/* Status indicator */}
      {isRecording && (
        <View style={styles.statusRow}>
          <View
            style={[styles.recordingDot, { backgroundColor: colors.recordRed }]}
          />
          <Text style={[styles.statusText, { color: colors.recordRed }]}>
            Recording
          </Text>
        </View>
      )}
      {isPaused && (
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: colors.warning }]}>
            ⏸ Paused
          </Text>
        </View>
      )}

      {/* Waveform */}
      <WaveformView
        data={waveform}
        height={80}
        color={isRecording ? colors.primary : colors.textMuted}
      />

      {/* Live transcript area */}
      <ScrollView
        ref={transcriptScrollRef}
        style={[
          styles.transcriptArea,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onContentSizeChange={() => transcriptScrollRef.current?.scrollToEnd()}
      >
        {sessionSegments.map((seg) => (
          <View key={seg.id} style={styles.segmentRow}>
            <Text
              style={[
                styles.segBadge,
                {
                  color:
                    seg.source === "voice" ? colors.primary : colors.accent,
                },
              ]}
            >
              {seg.source === "voice" ? "🎤" : "⌨️"}
            </Text>
            <Text style={[styles.segText, { color: colors.text }]}>
              {seg.text}
            </Text>
          </View>
        ))}
        {liveTranscript ? (
          <Text style={[styles.liveText, { color: colors.textSecondary }]}>
            🎤 {liveTranscript}...
          </Text>
        ) : null}
      </ScrollView>

      {/* Type while recording */}
      {(isRecording || isPaused) && (
        <View style={[styles.typeRow, { borderColor: colors.border }]}>
          <TextInput
            style={[
              styles.typeInput,
              { color: colors.text, backgroundColor: colors.surface },
            ]}
            placeholder="Type notes while recording..."
            placeholderTextColor={colors.textMuted}
            value={typedText}
            onChangeText={setTypedText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSubmitTyped}
            accessibilityLabel="Type notes while recording"
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmitTyped}
            accessibilityLabel="Add typed note"
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {/* Mark Highlight (visible during recording) */}
        {(isRecording || isPaused) && (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.accent }]}
            onPress={handleMarkHighlight}
            accessibilityLabel="Mark highlight at current time"
          >
            <Text
              style={[styles.secondaryButtonText, { color: colors.accent }]}
            >
              ⭐
            </Text>
          </TouchableOpacity>
        )}

        {/* Main Record / Pause / Resume button */}
        {isIdle ? (
          <TouchableOpacity
            style={[styles.recordButton, { backgroundColor: colors.recordRed }]}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start recording"
          >
            <View style={styles.recordInner} />
          </TouchableOpacity>
        ) : isRecording ? (
          <TouchableOpacity
            style={[styles.recordButton, { backgroundColor: colors.warning }]}
            onPress={handlePause}
            accessibilityRole="button"
            accessibilityLabel="Pause recording"
          >
            <Text style={styles.controlIcon}>⏸</Text>
          </TouchableOpacity>
        ) : isPaused ? (
          <TouchableOpacity
            style={[styles.recordButton, { backgroundColor: colors.primary }]}
            onPress={handleResume}
            accessibilityRole="button"
            accessibilityLabel="Resume recording"
          >
            <Text style={styles.controlIcon}>▶</Text>
          </TouchableOpacity>
        ) : null}

        {/* Stop button */}
        {(isRecording || isPaused) && (
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.danger }]}
            onPress={handleStop}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
          >
            <Text
              style={[styles.secondaryButtonText, { color: colors.danger }]}
            >
              ⏹
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Highlights count */}
      {highlights.length > 0 && (
        <Text style={[styles.highlightsCount, { color: colors.textMuted }]}>
          ⭐ {highlights.length} highlight{highlights.length > 1 ? "s" : ""}{" "}
          marked
        </Text>
      )}
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
  },
  langButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  langText: {
    fontSize: FontSize.sm,
  },
  langDropdown: {
    position: "absolute",
    top: 80,
    right: Spacing.md,
    zIndex: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.xs,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  langOption: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  langOptionText: {
    fontSize: FontSize.md,
  },
  timer: {
    fontSize: 56,
    fontWeight: "200",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  transcriptArea: {
    flex: 1,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxHeight: 200,
  },
  segmentRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  segBadge: {
    fontSize: FontSize.sm,
  },
  segText: {
    fontSize: FontSize.md,
    flex: 1,
    lineHeight: 20,
  },
  liveText: {
    fontSize: FontSize.md,
    fontStyle: "italic",
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderTopWidth: 1,
    paddingVertical: Spacing.sm,
  },
  typeInput: {
    flex: 1,
    height: 42,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.body,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  recordInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  controlIcon: {
    fontSize: 28,
    color: "#FFFFFF",
  },
  secondaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 22,
  },
  highlightsCount: {
    textAlign: "center",
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
});
