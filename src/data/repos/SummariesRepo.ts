/**
 * NoteGenius – Summaries repository.
 * JSON arrays are serialized to TEXT columns.
 */
import type { Summary } from "../../types/models";
import { getDatabase } from "../database";

/** Map a DB row (JSON strings) back to a Summary object. */
function hydrate(row: Record<string, unknown>): Summary {
  return {
    id: row.id as string,
    noteId: row.noteId as string,
    tldr: JSON.parse((row.tldr as string) || "[]"),
    keyPoints: JSON.parse((row.keyPoints as string) || "[]"),
    decisions: JSON.parse((row.decisions as string) || "[]"),
    actionItems: JSON.parse((row.actionItems as string) || "[]"),
    openQuestions: JSON.parse((row.openQuestions as string) || "[]"),
    topics: JSON.parse((row.topics as string) || "[]"),
    highlights: JSON.parse((row.highlights as string) || "[]"),
    followUps: JSON.parse((row.followUps as string) || "[]"),
    sentimentBySegment: row.sentimentBySegment
      ? JSON.parse(row.sentimentBySegment as string)
      : undefined,
    createdAt: row.createdAt as number,
    provider: row.provider as Summary["provider"],
  };
}

export const SummariesRepo = {
  /** Insert or replace a summary for a note. */
  async upsert(summary: Summary): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO summaries
       (id, noteId, tldr, keyPoints, decisions, actionItems, openQuestions,
        topics, highlights, followUps, sentimentBySegment, createdAt, provider)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      summary.id,
      summary.noteId,
      JSON.stringify(summary.tldr),
      JSON.stringify(summary.keyPoints),
      JSON.stringify(summary.decisions),
      JSON.stringify(summary.actionItems),
      JSON.stringify(summary.openQuestions),
      JSON.stringify(summary.topics),
      JSON.stringify(summary.highlights),
      JSON.stringify(summary.followUps),
      summary.sentimentBySegment
        ? JSON.stringify(summary.sentimentBySegment)
        : null,
      summary.createdAt,
      summary.provider,
    );
  },

  /** Get the summary for a note (most recent if multiple). */
  async getByNoteId(noteId: string): Promise<Summary | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM summaries WHERE noteId = ? ORDER BY createdAt DESC LIMIT 1",
      noteId,
    );
    return row ? hydrate(row) : null;
  },

  /** Get all summaries. */
  async getAll(): Promise<Summary[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM summaries ORDER BY createdAt DESC",
    );
    return rows.map(hydrate);
  },

  /** Delete summaries for a note. */
  async deleteByNoteId(noteId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM summaries WHERE noteId = ?", noteId);
  },
};
