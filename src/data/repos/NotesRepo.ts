/**
 * NoteGenius – Notes repository (SQLite CRUD).
 */
import type { Note } from "../../types/models";
import { getDatabase } from "../database";

export const NotesRepo = {
  /** Insert a new note. */
  async create(note: Note): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO notes (id, title, createdAt, updatedAt, audioPath, durationMs, languageCode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      note.id,
      note.title,
      note.createdAt,
      note.updatedAt,
      note.audioPath ?? null,
      note.durationMs ?? null,
      note.languageCode ?? "en-US",
    );
  },

  /** Get a single note by ID. */
  async getById(id: string): Promise<Note | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Note>(
      "SELECT * FROM notes WHERE id = ?",
      id,
    );
    return row ?? null;
  },

  /** Get all notes ordered by most recently updated. */
  async getAll(): Promise<Note[]> {
    const db = await getDatabase();
    return db.getAllAsync<Note>("SELECT * FROM notes ORDER BY updatedAt DESC");
  },

  /** Update an existing note. */
  async update(note: Partial<Note> & { id: string }): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];
    const updatable: (keyof Note)[] = [
      "title",
      "audioPath",
      "durationMs",
      "languageCode",
      "updatedAt",
    ];
    for (const key of updatable) {
      if (key in note) {
        fields.push(`${key} = ?`);
        values.push(note[key as keyof typeof note]);
      }
    }
    if (fields.length === 0) return;
    values.push(note.id);
    await db.runAsync(
      `UPDATE notes SET ${fields.join(", ")} WHERE id = ?`,
      ...(values as (string | number | null)[]),
    );
  },

  /** Delete a note and cascade to segments/summaries/flashcards. */
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM notes WHERE id = ?", id);
  },

  /** Search notes by title (case-insensitive). */
  async search(query: string): Promise<Note[]> {
    const db = await getDatabase();
    return db.getAllAsync<Note>(
      "SELECT * FROM notes WHERE title LIKE ? ORDER BY updatedAt DESC",
      `%${query}%`,
    );
  },
};
