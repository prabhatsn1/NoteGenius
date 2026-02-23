/**
 * NoteGenius – Recording store (Zustand).
 * Manages ephemeral recording state (not persisted to DB until save).
 */
import { create } from "zustand";
import type { NoteSegment, RecordingStatus } from "../types/models";

interface RecordingState {
  status: RecordingStatus;
  elapsedMs: number;
  /** Live waveform amplitude values (normalized 0..1) */
  waveform: number[];
  /** Live transcript text (streaming) */
  liveTranscript: string;
  /** Accumulated segments during this recording session */
  sessionSegments: NoteSegment[];
  /** Currently active note ID for this recording */
  noteId: string | null;
  /** Highlight bookmarks (ms timestamps) */
  highlights: number[];

  // Actions
  setStatus: (status: RecordingStatus) => void;
  setElapsedMs: (ms: number) => void;
  appendWaveform: (amplitude: number) => void;
  setLiveTranscript: (text: string) => void;
  addSessionSegment: (seg: NoteSegment) => void;
  setNoteId: (id: string) => void;
  addHighlight: (ms: number) => void;
  resetRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  status: "idle",
  elapsedMs: 0,
  waveform: [],
  liveTranscript: "",
  sessionSegments: [],
  noteId: null,
  highlights: [],

  setStatus: (status) => set({ status }),
  setElapsedMs: (ms) => set({ elapsedMs: ms }),
  appendWaveform: (amplitude) =>
    set((s) => ({
      waveform: [...s.waveform.slice(-200), amplitude], // keep last 200 samples
    })),
  setLiveTranscript: (text) => set({ liveTranscript: text }),
  addSessionSegment: (seg) =>
    set((s) => ({ sessionSegments: [...s.sessionSegments, seg] })),
  setNoteId: (id) => set({ noteId: id }),
  addHighlight: (ms) => set((s) => ({ highlights: [...s.highlights, ms] })),
  resetRecording: () =>
    set({
      status: "idle",
      elapsedMs: 0,
      waveform: [],
      liveTranscript: "",
      sessionSegments: [],
      noteId: null,
      highlights: [],
    }),
}));
