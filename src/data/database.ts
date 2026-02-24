/**
 * NoteGenius – SQLite database initialization.
 * Uses expo-sqlite (synchronous API available in SDK 54+).
 * All tables are created on first open; migrations can be handled via user_version pragma.
 */
import * as SQLite from "expo-sqlite";

const DB_NAME = "notegenius.db";

let _db: SQLite.SQLiteDatabase | null = null;

/** Get or create the database singleton. */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync("PRAGMA journal_mode = WAL;");
  await _db.execAsync("PRAGMA foreign_keys = ON;");
  await createTables(_db);
  await runMigrations(_db);
  return _db;
}

/** Create all application tables if they don't exist. */
async function createTables(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      audioPath TEXT,
      durationMs INTEGER,
      languageCode TEXT DEFAULT 'en-US',
      tags TEXT NOT NULL DEFAULT '[]',
      isPinned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY NOT NULL,
      noteId TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('voice','typed')),
      text TEXT NOT NULL DEFAULT '',
      startMs INTEGER NOT NULL DEFAULT 0,
      endMs INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id TEXT PRIMARY KEY NOT NULL,
      noteId TEXT NOT NULL,
      tldr TEXT NOT NULL DEFAULT '[]',
      keyPoints TEXT NOT NULL DEFAULT '[]',
      decisions TEXT NOT NULL DEFAULT '[]',
      actionItems TEXT NOT NULL DEFAULT '[]',
      openQuestions TEXT NOT NULL DEFAULT '[]',
      topics TEXT NOT NULL DEFAULT '[]',
      highlights TEXT NOT NULL DEFAULT '[]',
      followUps TEXT NOT NULL DEFAULT '[]',
      sentimentBySegment TEXT,
      createdAt INTEGER NOT NULL,
      provider TEXT NOT NULL DEFAULT 'offline',
      FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY NOT NULL,
      noteId TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('qa','cloze','term-def','def-term')),
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      difficulty INTEGER NOT NULL DEFAULT 3,
      interval INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      easiness REAL NOT NULL DEFAULT 2.5,
      nextReviewAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (noteId) REFERENCES notes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_segments_noteId ON segments(noteId);
    CREATE INDEX IF NOT EXISTS idx_summaries_noteId ON summaries(noteId);
    CREATE INDEX IF NOT EXISTS idx_flashcards_noteId ON flashcards(noteId);
    CREATE INDEX IF NOT EXISTS idx_flashcards_nextReview ON flashcards(nextReviewAt);
  `);
}

/** Close the database (e.g., on app background). */
export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}

// ─── Migrations ─────────────────────────────────────────────────────────────

const CURRENT_DB_VERSION = 3;

/**
 * Run schema / data migrations keyed by PRAGMA user_version.
 * Each version bump is idempotent so re-runs are safe.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  const version = result?.user_version ?? 0;

  if (version < 1) {
    // v1: Rename provider values 'local' → 'offline', 'cloud' → 'gemini'
    await db.execAsync(`
      UPDATE summaries SET provider = 'offline'  WHERE provider = 'local';
      UPDATE summaries SET provider = 'gemini'   WHERE provider = 'cloud';
    `);
  }

  if (version < 2) {
    // v2: Add tags (JSON array) and isPinned (boolean) to notes
    await db.execAsync(`
      ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE notes ADD COLUMN isPinned INTEGER NOT NULL DEFAULT 0;
    `);
  }

  if (version < 3) {
    // v3: Add isArchived (boolean) to notes
    await db.execAsync(`
      ALTER TABLE notes ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0;
    `);
  }

  if (version < CURRENT_DB_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${CURRENT_DB_VERSION};`);
  }
}
