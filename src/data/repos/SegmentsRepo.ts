/**
 * NoteGenius – Segments repository.
 * A segment is a chunk of text (voice-transcribed or typed) within a note.
 */
import type { NoteSegment } from "../../types/models";
import { getDatabase } from "../database";

export const SegmentsRepo = {
  /** Insert a segment. */
  async create(seg: NoteSegment): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO segments (id, noteId, source, text, startMs, endMs)
       VALUES (?, ?, ?, ?, ?, ?)`,
      seg.id,
      seg.noteId,
      seg.source,
      seg.text,
      seg.startMs,
      seg.endMs,
    );
  },

  /** Bulk-insert segments (wrapped in a transaction). */
  async createMany(segments: NoteSegment[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const seg of segments) {
        await db.runAsync(
          `INSERT INTO segments (id, noteId, source, text, startMs, endMs)
           VALUES (?, ?, ?, ?, ?, ?)`,
          seg.id,
          seg.noteId,
          seg.source,
          seg.text,
          seg.startMs,
          seg.endMs,
        );
      }
    });
  },

  /** Get all segments for a note, ordered by startMs. */
  async getByNoteId(noteId: string): Promise<NoteSegment[]> {
    const db = await getDatabase();
    return db.getAllAsync<NoteSegment>(
      "SELECT * FROM segments WHERE noteId = ? ORDER BY startMs ASC",
      noteId,
    );
  },

  /** Update a segment's text. */
  async updateText(id: string, text: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("UPDATE segments SET text = ? WHERE id = ?", text, id);
  },

  /** Delete all segments for a note. */
  async deleteByNoteId(noteId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM segments WHERE noteId = ?", noteId);
  },

  /** Delete a single segment. */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM segments WHERE id = ?", id);
  },
};
