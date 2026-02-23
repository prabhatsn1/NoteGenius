/**
 * NoteGenius – Export/Import service.
 * Export: JSON bundle with all data + audio files.
 * Import: Validate schema and merge safely.
 */
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { FlashcardsRepo } from "../../data/repos/FlashcardsRepo";
import { NotesRepo } from "../../data/repos/NotesRepo";
import { SegmentsRepo } from "../../data/repos/SegmentsRepo";
import { SettingsRepo } from "../../data/repos/SettingsRepo";
import { SummariesRepo } from "../../data/repos/SummariesRepo";
import type {
  ExportData,
  Flashcard,
  NoteSegment,
  Summary,
} from "../../types/models";

const EXPORT_VERSION = 1;

export const ExportService = {
  /**
   * Export all data to a JSON file and share.
   * Audio files are referenced by path (user can share the recordings dir separately).
   */
  async exportData(): Promise<string> {
    const user = SettingsRepo.getUserProfile();
    const notes = await NotesRepo.getAll();
    const allSegments: NoteSegment[] = [];
    const allSummaries: Summary[] = [];
    const allFlashcards: Flashcard[] = [];

    for (const note of notes) {
      const segments = await SegmentsRepo.getByNoteId(note.id);
      const summary = await SummariesRepo.getByNoteId(note.id);
      const flashcards = await FlashcardsRepo.getByNoteId(note.id);
      allSegments.push(...segments);
      if (summary) allSummaries.push(summary);
      allFlashcards.push(...flashcards);
    }

    const data: ExportData = {
      version: EXPORT_VERSION,
      exportedAt: Date.now(),
      user: user ?? { name: "", phone: "", aiProvider: "offline" as const },
      notes,
      segments: allSegments,
      summaries: allSummaries,
      flashcards: allFlashcards,
    };

    const json = JSON.stringify(data, null, 2);
    const filename = `notegenius_export_${Date.now()}.json`;
    const filePath = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Share the file
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(filePath, {
        mimeType: "application/json",
        dialogTitle: "Export NoteGenius Data",
      });
    }

    return filePath;
  },

  /**
   * Import data from a JSON file.
   * Validates schema version and merges without overwriting existing data.
   */
  async importData(
    fileUri: string,
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const json = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const data = JSON.parse(json) as ExportData;

      // Validate schema version
      if (!data.version || data.version > EXPORT_VERSION) {
        errors.push(`Unsupported export version: ${data.version}`);
        return { imported, errors };
      }

      if (!data.notes || !Array.isArray(data.notes)) {
        errors.push("Invalid export format: missing notes array");
        return { imported, errors };
      }

      // Import notes (skip duplicates)
      for (const note of data.notes) {
        try {
          const existing = await NotesRepo.getById(note.id);
          if (!existing) {
            await NotesRepo.create(note);
            imported++;
          }
        } catch (e) {
          errors.push(`Note ${note.id}: ${String(e)}`);
        }
      }

      // Import segments
      if (data.segments) {
        for (const seg of data.segments) {
          try {
            await SegmentsRepo.create(seg);
          } catch {
            // skip duplicates silently
          }
        }
      }

      // Import summaries
      if (data.summaries) {
        for (const summary of data.summaries) {
          try {
            await SummariesRepo.upsert(summary);
          } catch (e) {
            errors.push(`Summary ${summary.id}: ${String(e)}`);
          }
        }
      }

      // Import flashcards
      if (data.flashcards) {
        for (const card of data.flashcards) {
          try {
            await FlashcardsRepo.create(card);
          } catch {
            // skip duplicates
          }
        }
      }

      // Import user profile if current is empty
      if (data.user?.name && !SettingsRepo.getUserProfile()) {
        SettingsRepo.setUserProfile(data.user);
      }

      return { imported, errors };
    } catch (e) {
      errors.push(`Parse error: ${String(e)}`);
      return { imported, errors };
    }
  },
};
