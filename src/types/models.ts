/**
 * NoteGenius – Core data models
 * All entities are offline-first; IDs are UUIDs generated locally.
 */

// ─── Segment Source ─────────────────────────────────────────────────────────
export type SegmentSource = "voice" | "typed";

/** A single text segment within a note (voice or typed). */
export interface NoteSegment {
  id: string;
  noteId: string;
  source: SegmentSource;
  text: string;
  /** Milliseconds from recording start */
  startMs: number;
  endMs: number;
}

/** A recorded voice note with optional audio file. */
export interface Note {
  id: string;
  title: string;
  createdAt: number; // epoch ms
  updatedAt: number;
  audioPath?: string;
  durationMs?: number;
  /** BCP-47 language code for STT, e.g. 'en-US', 'hi-IN' */
  languageCode?: string;
  /** User-defined tags for filtering */
  tags?: string[];
  /** Pinned notes appear first in the list */
  isPinned?: boolean;
  /** Archived notes are hidden from the main list */
  isArchived?: boolean;
}

/** Meeting-style summary generated from a note's segments. */
export interface Summary {
  id: string;
  noteId: string;
  tldr: string[];
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
  topics: string[];
  highlights: string[];
  followUps: string[];
  /** Rough sentiment per segment (−1..+1) */
  sentimentBySegment?: number[];
  createdAt: number;
  provider: AIProvider;
}

export interface ActionItem {
  owner: string;
  task: string;
  due?: string; // ISO date string
}

// ─── Flashcard Types ────────────────────────────────────────────────────────
export type FlashcardType = "qa" | "cloze" | "term-def" | "def-term";

/** A spaced-repetition flashcard linked to a note. */
export interface Flashcard {
  id: string;
  noteId: string;
  type: FlashcardType;
  front: string;
  back: string;
  tags: string[];
  /** Current difficulty rating 1..5 */
  difficulty: number;
  /** Current interval in days */
  interval: number;
  /** Number of successful repetitions */
  repetitions: number;
  /** SM-2 easiness factor (≥ 1.3) */
  easiness: number;
  /** Epoch ms when next review is due */
  nextReviewAt: number;
  createdAt: number;
  updatedAt: number;
}

/** SRS review quality (0 = Again, 3 = Hard, 4 = Good, 5 = Easy) */
export type SRSRating = 0 | 1 | 2 | 3 | 4 | 5;

/** Minimal user profile – no login required. */
export interface UserProfile {
  name: string;
  phone: string;
  /** Selected AI provider for summarization & flashcards */
  aiProvider: AIProvider;
  /** Gemini API key (stored in expo-secure-store, NOT in MMKV) */
  geminiApiKey?: string;
}

// ─── Settings ───────────────────────────────────────────────────────────────
export type AIProvider = "offline" | "gemini";

/**
 * Gemini model identifier string as returned by the
 * Google AI `GET /v1beta/models` endpoint (without the "models/" prefix).
 */
export type GeminiModel = string;

export interface AppSettings {
  aiProvider: AIProvider;
  /** Which Gemini model to use when aiProvider === 'gemini' */
  geminiModel: GeminiModel;
  autoPunctuate: boolean;
  sampleRate: number; // Hz
  silenceTrimming: boolean;
  /** Whether the user has completed initial setup */
  setupComplete: boolean;
  /** Whether the user has acknowledged the Gemini privacy notice */
  geminiPrivacyAcknowledged: boolean;
}

// ─── Segment Filter ─────────────────────────────────────────────────────────
export type SegmentFilter = "all" | "voice" | "typed";

// ─── Recording State ────────────────────────────────────────────────────────
export type RecordingStatus =
  | "idle"
  | "recording"
  | "paused"
  | "transcribing"
  | "stopped";

// ─── Study Session ──────────────────────────────────────────────────────────
export interface StudySession {
  noteId?: string; // undefined = all cards
  cards: Flashcard[];
  currentIndex: number;
  showAnswer: boolean;
}

// ─── Export / Import ────────────────────────────────────────────────────────
export interface ExportData {
  version: number;
  exportedAt: number;
  user: UserProfile;
  notes: Note[];
  segments: NoteSegment[];
  summaries: Summary[];
  flashcards: Flashcard[];
}
