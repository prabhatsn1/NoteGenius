/**
 * NoteGenius – Notes repository (SQLite CRUD).
 */
import type { Note } from "../../types/models";
import { getDatabase } from "../database";

// ─── Row deserialization ────────────────────────────────────────────────────

interface NoteRow {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  audioPath: string | null;
  durationMs: number | null;
  languageCode: string | null;
  tags: string; // JSON array stored as TEXT
  isPinned: number; // 0 | 1  →  boolean
  isArchived: number; // 0 | 1  →  boolean
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    audioPath: row.audioPath ?? undefined,
    durationMs: row.durationMs ?? undefined,
    languageCode: row.languageCode ?? undefined,
    tags: (() => {
      try {
        const parsed = JSON.parse(row.tags ?? "[]");
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return [];
      }
    })(),
    isPinned: row.isPinned === 1,
    isArchived: row.isArchived === 1,
  };
}

// ─── Repository ─────────────────────────────────────────────────────────────

export const NotesRepo = {
  /** Insert a new note. */
  async create(note: Note): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO notes (id, title, createdAt, updatedAt, audioPath, durationMs, languageCode, tags, isPinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      note.id,
      note.title,
      note.createdAt,
      note.updatedAt,
      note.audioPath ?? null,
      note.durationMs ?? null,
      note.languageCode ?? "en-US",
      JSON.stringify(note.tags ?? []),
      note.isPinned ? 1 : 0,
    );
  },

  /** Get a single note by ID. */
  async getById(id: string): Promise<Note | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<NoteRow>(
      "SELECT * FROM notes WHERE id = ?",
      id,
    );
    return row ? rowToNote(row) : null;
  },

  /** Get all non-archived notes – pinned first, then most recently updated. */
  async getAll(): Promise<Note[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<NoteRow>(
      "SELECT * FROM notes WHERE isArchived = 0 ORDER BY isPinned DESC, updatedAt DESC",
    );
    return rows.map(rowToNote);
  },

  /** Get all archived notes – most recently updated first. */
  async getArchived(): Promise<Note[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<NoteRow>(
      "SELECT * FROM notes WHERE isArchived = 1 ORDER BY updatedAt DESC",
    );
    return rows.map(rowToNote);
  },

  /** Set isArchived flag on a note. */
  async setArchived(id: string, archived: boolean): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE notes SET isArchived = ? WHERE id = ?",
      archived ? 1 : 0,
      id,
    );
  },

  /** Update an existing note. */
  async update(note: Partial<Note> & { id: string }): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];

    if ("title" in note) {
      fields.push("title = ?");
      values.push(note.title);
    }
    if ("audioPath" in note) {
      fields.push("audioPath = ?");
      values.push(note.audioPath ?? null);
    }
    if ("durationMs" in note) {
      fields.push("durationMs = ?");
      values.push(note.durationMs ?? null);
    }
    if ("languageCode" in note) {
      fields.push("languageCode = ?");
      values.push(note.languageCode ?? null);
    }
    if ("updatedAt" in note) {
      fields.push("updatedAt = ?");
      values.push(note.updatedAt);
    }
    if ("tags" in note) {
      fields.push("tags = ?");
      values.push(JSON.stringify(note.tags ?? []));
    }
    if ("isPinned" in note) {
      fields.push("isPinned = ?");
      values.push(note.isPinned ? 1 : 0);
    }
    if ("isArchived" in note) {
      fields.push("isArchived = ?");
      values.push(note.isArchived ? 1 : 0);
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

  /**
   * Full-text search across note title, transcribed segments, and summaries.
   * Returns distinct notes ordered by pinned-first then most recently updated.
   */
  async search(query: string): Promise<Note[]> {
    const db = await getDatabase();
    const like = `%${query}%`;
    const rows = await db.getAllAsync<NoteRow>(
      `SELECT DISTINCT n.*
       FROM notes n
       LEFT JOIN segments  s  ON s.noteId  = n.id
       LEFT JOIN summaries sm ON sm.noteId = n.id
       WHERE n.title       LIKE ?
          OR s.text        LIKE ?
          OR sm.tldr       LIKE ?
          OR sm.keyPoints  LIKE ?
       ORDER BY n.isPinned DESC, n.updatedAt DESC`,
      like,
      like,
      like,
      like,
    );
    return rows.map(rowToNote);
  },

  /** Return every unique tag used across all notes (sorted). */
  async getAllTags(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ tags: string }>(
      "SELECT tags FROM notes WHERE tags != '[]'",
    );
    const set = new Set<string>();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.tags) as unknown;
        if (Array.isArray(parsed)) {
          (parsed as string[]).forEach((t) => set.add(t));
        }
      } catch {
        /* ignore malformed rows */
      }
    }
    return Array.from(set).sort();
  },
};
