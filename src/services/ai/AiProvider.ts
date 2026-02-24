/**
 * NoteGenius – AI Provider interface.
 * Both Offline and Gemini providers implement this contract.
 */
import type { Flashcard } from "../../types/models";

/** Result of a summarization call. */
export interface AiSummaryResult {
  tldr: string[];
  keyPoints: string[];
  decisions: string[];
  actionItems: { owner: string; task: string; due?: string }[];
  openQuestions: string[];
  topics: string[];
  highlights: string[];
  followUps: string[];
  sentimentBySegment?: number[];
}

/** Result of flashcard generation. */
export type AiFlashcardResult = Omit<
  Flashcard,
  | "id"
  | "noteId"
  | "createdAt"
  | "updatedAt"
  | "nextReviewAt"
  | "interval"
  | "repetitions"
  | "easiness"
  | "difficulty"
>;

/**
 * Every AI provider must implement these methods.
 * `transcript` is the concatenated segment text – the minimum data shared.
 */
export interface IAiProvider {
  /** Human-readable label for UI/logging. */
  readonly label: string;

  /**
   * Summarize a transcript.
   * @param transcript  Full text of the note (segments joined).
   * @param userName    Owner name for action-item attribution.
   */
  summarize(transcript: string, userName: string): Promise<AiSummaryResult>;

  /**
   * Generate flashcards from transcript + optional summary.
   * @param transcript  Full text of the note.
   * @param summary     Previously generated summary (may be used for richer cards).
   */
  generateFlashcards(
    transcript: string,
    summary: AiSummaryResult | null,
  ): Promise<AiFlashcardResult[]>;

  /**
   * Generate a concise, meaningful title for a note from its transcript.
   * Returns a short string (≤ 60 chars). Providers should never throw;
   * return an empty string on failure so the caller can fall back gracefully.
   * @param transcript  Full text of the note (segments joined).
   */
  generateTitle(transcript: string): Promise<string>;
}
