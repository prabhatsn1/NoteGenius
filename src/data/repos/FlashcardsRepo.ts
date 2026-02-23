/**
 * NoteGenius – Flashcards repository.
 * Tags are stored as JSON array in a TEXT column.
 */
import type { Flashcard } from "../../types/models";
import { getDatabase } from "../database";

function hydrate(row: Record<string, unknown>): Flashcard {
  return {
    ...(row as unknown as Flashcard),
    tags: JSON.parse((row.tags as string) || "[]"),
  };
}

export const FlashcardsRepo = {
  /** Insert a new flashcard. */
  async create(card: Flashcard): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO flashcards
       (id, noteId, type, front, back, tags, difficulty, interval,
        repetitions, easiness, nextReviewAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      card.id,
      card.noteId,
      card.type,
      card.front,
      card.back,
      JSON.stringify(card.tags),
      card.difficulty,
      card.interval,
      card.repetitions,
      card.easiness,
      card.nextReviewAt,
      card.createdAt,
      card.updatedAt,
    );
  },

  /** Bulk insert flashcards. */
  async createMany(cards: Flashcard[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const card of cards) {
        await db.runAsync(
          `INSERT INTO flashcards
           (id, noteId, type, front, back, tags, difficulty, interval,
            repetitions, easiness, nextReviewAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          card.id,
          card.noteId,
          card.type,
          card.front,
          card.back,
          JSON.stringify(card.tags),
          card.difficulty,
          card.interval,
          card.repetitions,
          card.easiness,
          card.nextReviewAt,
          card.createdAt,
          card.updatedAt,
        );
      }
    });
  },

  /** Get all flashcards for a note. */
  async getByNoteId(noteId: string): Promise<Flashcard[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM flashcards WHERE noteId = ? ORDER BY createdAt DESC",
      noteId,
    );
    return rows.map(hydrate);
  },

  /** Get all flashcards. */
  async getAll(): Promise<Flashcard[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM flashcards ORDER BY nextReviewAt ASC",
    );
    return rows.map(hydrate);
  },

  /** Get cards due for review (nextReviewAt <= now). */
  async getDue(now?: number): Promise<Flashcard[]> {
    const db = await getDatabase();
    const ts = now ?? Date.now();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM flashcards WHERE nextReviewAt <= ? ORDER BY nextReviewAt ASC",
      ts,
    );
    return rows.map(hydrate);
  },

  /** Get count of due cards. */
  async getDueCount(now?: number): Promise<number> {
    const db = await getDatabase();
    const ts = now ?? Date.now();
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM flashcards WHERE nextReviewAt <= ?",
      ts,
    );
    return row?.count ?? 0;
  },

  /** Update SRS fields after review. */
  async updateSRS(
    card: Pick<
      Flashcard,
      | "id"
      | "difficulty"
      | "interval"
      | "repetitions"
      | "easiness"
      | "nextReviewAt"
      | "updatedAt"
    >,
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE flashcards SET difficulty = ?, interval = ?, repetitions = ?,
       easiness = ?, nextReviewAt = ?, updatedAt = ? WHERE id = ?`,
      card.difficulty,
      card.interval,
      card.repetitions,
      card.easiness,
      card.nextReviewAt,
      card.updatedAt,
      card.id,
    );
  },

  /** Delete a flashcard. */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM flashcards WHERE id = ?", id);
  },

  /** Delete all flashcards for a note. */
  async deleteByNoteId(noteId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM flashcards WHERE noteId = ?", noteId);
  },
};
