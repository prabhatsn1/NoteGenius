/**
 * NoteGenius – Notes store (Zustand).
 * Manages CRUD for notes, segments, and summaries.
 */
import { create } from "zustand";
import { NotesRepo } from "../data/repos/NotesRepo";
import { SegmentsRepo } from "../data/repos/SegmentsRepo";
import { SummariesRepo } from "../data/repos/SummariesRepo";
import type { Note, NoteSegment, Summary } from "../types/models";
import { generateId } from "../utils/uuid";

interface NotesState {
  notes: Note[];
  /** Derived list shown in NotesScreen (respects search + tag filter) */
  displayNotes: Note[];
  allTags: string[];
  searchQuery: string;
  selectedTag: string | null;
  currentNote: Note | null;
  currentSegments: NoteSegment[];
  currentSummary: Summary | null;
  isLoading: boolean;
  /** Note staged for deletion — DB write is deferred so undo is possible. */
  pendingNoteDelete: Note | null;
  /** Note staged for archiving — DB write is deferred so undo is possible. */
  pendingNoteArchive: Note | null;

  // Actions
  loadNotes: () => Promise<void>;
  createNote: (title: string, languageCode?: string) => Promise<Note>;
  updateNote: (partial: Partial<Note> & { id: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  /** Remove note from UI immediately; permanent DB delete fires after UNDO_DELAY_MS. */
  softDeleteNote: (id: string) => void;
  /** Cancel the pending soft-delete and restore the note to the list. */
  undoDeleteNote: () => void;
  /** Permanently delete the pending note from the DB (called internally by the timer). */
  commitPendingDelete: () => Promise<void>;
  /** Remove note from UI immediately; DB archive write fires after UNDO_DELAY_MS. */
  archiveNote: (id: string) => void;
  /** Cancel the pending archive and restore the note to the list. */
  undoArchiveNote: () => void;
  /** Commit the pending archive to the DB (called internally by the timer). */
  commitPendingArchive: () => Promise<void>;
  selectNote: (id: string) => Promise<void>;
  clearCurrentNote: () => void;

  // Search & filter
  setSearchQuery: (query: string) => Promise<void>;
  setSelectedTag: (tag: string | null) => void;

  // Pinning
  togglePin: (id: string) => Promise<void>;

  // Tags
  updateNoteTags: (id: string, tags: string[]) => Promise<void>;

  // Segments
  addSegment: (seg: Omit<NoteSegment, "id">) => Promise<NoteSegment>;
  addSegments: (segs: NoteSegment[]) => Promise<void>;
  loadSegments: (noteId: string) => Promise<NoteSegment[]>;

  // Summary
  saveSummary: (summary: Summary) => Promise<void>;
  loadSummary: (noteId: string) => Promise<Summary | null>;
}

/** How long (ms) to wait before permanently writing the delete to the DB. */
const UNDO_DELAY_MS = 5_000;

/** Module-level timer so it survives re-renders and selector calls. */
let _deleteTimer: ReturnType<typeof setTimeout> | null = null;
let _archiveTimer: ReturnType<typeof setTimeout> | null = null;

/** Apply search + tag filter to a note array (in-memory, no DB needed). */
function applyFilters(
  notes: Note[],
  query: string,
  tag: string | null,
): Note[] {
  let result = notes;
  if (tag) {
    result = result.filter((n) => n.tags?.includes(tag));
  }
  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }
  return result;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  displayNotes: [],
  allTags: [],
  searchQuery: "",
  selectedTag: null,
  currentNote: null,
  currentSegments: [],
  currentSummary: null,
  isLoading: false,
  pendingNoteDelete: null,
  pendingNoteArchive: null,

  loadNotes: async () => {
    set({ isLoading: true });
    const notes = await NotesRepo.getAll();
    const allTags = await NotesRepo.getAllTags();
    const { searchQuery, selectedTag } = get();
    set({
      notes,
      allTags,
      displayNotes: applyFilters(notes, searchQuery, selectedTag),
      isLoading: false,
    });
  },

  createNote: async (title: string, languageCode = "en-US") => {
    const now = Date.now();
    const note: Note = {
      id: generateId(),
      title,
      createdAt: now,
      updatedAt: now,
      languageCode,
      tags: [],
      isPinned: false,
    };
    await NotesRepo.create(note);
    const newNotes = [note, ...get().notes].sort(
      (a, b) =>
        (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
        b.updatedAt - a.updatedAt,
    );
    const { searchQuery, selectedTag } = get();
    set((s) => ({
      notes: newNotes,
      displayNotes: applyFilters(newNotes, searchQuery, selectedTag),
      allTags: Array.from(new Set([...s.allTags])).sort(),
    }));
    return note;
  },

  updateNote: async (partial) => {
    const updated = { ...partial, updatedAt: Date.now() };
    await NotesRepo.update(updated);
    const newNotes = get()
      .notes.map((n) => (n.id === partial.id ? { ...n, ...updated } : n))
      .sort(
        (a, b) =>
          (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
          b.updatedAt - a.updatedAt,
      );
    const { searchQuery, selectedTag } = get();
    set((s) => ({
      notes: newNotes,
      displayNotes: applyFilters(newNotes, searchQuery, selectedTag),
      currentNote:
        s.currentNote?.id === partial.id
          ? { ...s.currentNote, ...updated }
          : s.currentNote,
    }));
  },

  deleteNote: async (id: string) => {
    await NotesRepo.delete(id);
    const newNotes = get().notes.filter((n) => n.id !== id);
    const { searchQuery, selectedTag } = get();
    const allTags = await NotesRepo.getAllTags();
    set((s) => ({
      notes: newNotes,
      displayNotes: applyFilters(newNotes, searchQuery, selectedTag),
      allTags,
      currentNote: s.currentNote?.id === id ? null : s.currentNote,
      currentSegments: s.currentNote?.id === id ? [] : s.currentSegments,
      currentSummary: s.currentNote?.id === id ? null : s.currentSummary,
    }));
  },

  softDeleteNote: (id: string) => {
    // Clear any already-pending delete (commit it immediately to avoid orphans)
    if (_deleteTimer) {
      clearTimeout(_deleteTimer);
      _deleteTimer = null;
      const prev = get().pendingNoteDelete;
      if (prev) {
        NotesRepo.delete(prev.id).catch(console.error);
      }
    }

    const note = get().notes.find((n) => n.id === id);
    if (!note) return;

    const newNotes = get().notes.filter((n) => n.id !== id);
    const { searchQuery, selectedTag } = get();

    set((s) => ({
      notes: newNotes,
      displayNotes: applyFilters(newNotes, searchQuery, selectedTag),
      pendingNoteDelete: note,
      currentNote: s.currentNote?.id === id ? null : s.currentNote,
      currentSegments: s.currentNote?.id === id ? [] : s.currentSegments,
      currentSummary: s.currentNote?.id === id ? null : s.currentSummary,
    }));

    _deleteTimer = setTimeout(() => {
      get().commitPendingDelete().catch(console.error);
    }, UNDO_DELAY_MS);
  },

  undoDeleteNote: () => {
    if (_deleteTimer) {
      clearTimeout(_deleteTimer);
      _deleteTimer = null;
    }
    const note = get().pendingNoteDelete;
    if (!note) return;

    const restored = [...get().notes, note].sort(
      (a, b) =>
        (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
        b.updatedAt - a.updatedAt,
    );
    const { searchQuery, selectedTag } = get();
    set({
      notes: restored,
      displayNotes: applyFilters(restored, searchQuery, selectedTag),
      pendingNoteDelete: null,
    });
  },

  commitPendingDelete: async () => {
    _deleteTimer = null;
    const note = get().pendingNoteDelete;
    if (!note) return;
    set({ pendingNoteDelete: null });
    await NotesRepo.delete(note.id);
    const allTags = await NotesRepo.getAllTags();
    set({ allTags });
  },

  archiveNote: (id: string) => {
    // Commit any outstanding archive first
    if (_archiveTimer) {
      clearTimeout(_archiveTimer);
      _archiveTimer = null;
      const prev = get().pendingNoteArchive;
      if (prev) {
        NotesRepo.setArchived(prev.id, true).catch(console.error);
      }
    }

    const note = get().notes.find((n) => n.id === id);
    if (!note) return;

    const newNotes = get().notes.filter((n) => n.id !== id);
    const { searchQuery, selectedTag } = get();

    set((s) => ({
      notes: newNotes,
      displayNotes: applyFilters(newNotes, searchQuery, selectedTag),
      pendingNoteArchive: note,
      currentNote: s.currentNote?.id === id ? null : s.currentNote,
      currentSegments: s.currentNote?.id === id ? [] : s.currentSegments,
      currentSummary: s.currentNote?.id === id ? null : s.currentSummary,
    }));

    _archiveTimer = setTimeout(() => {
      get().commitPendingArchive().catch(console.error);
    }, UNDO_DELAY_MS);
  },

  undoArchiveNote: () => {
    if (_archiveTimer) {
      clearTimeout(_archiveTimer);
      _archiveTimer = null;
    }
    const note = get().pendingNoteArchive;
    if (!note) return;

    const restored = [...get().notes, note].sort(
      (a, b) =>
        (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
        b.updatedAt - a.updatedAt,
    );
    const { searchQuery, selectedTag } = get();
    set({
      notes: restored,
      displayNotes: applyFilters(restored, searchQuery, selectedTag),
      pendingNoteArchive: null,
    });
  },

  commitPendingArchive: async () => {
    _archiveTimer = null;
    const note = get().pendingNoteArchive;
    if (!note) return;
    set({ pendingNoteArchive: null });
    await NotesRepo.setArchived(note.id, true);
  },

  selectNote: async (id: string) => {
    const note = await NotesRepo.getById(id);
    if (!note) return;
    const segments = await SegmentsRepo.getByNoteId(id);
    const summary = await SummariesRepo.getByNoteId(id);
    set({
      currentNote: note,
      currentSegments: segments,
      currentSummary: summary,
    });
  },

  clearCurrentNote: () => {
    set({ currentNote: null, currentSegments: [], currentSummary: null });
  },

  // ─── Search & filter ─────────────────────────────────────────────────────

  setSearchQuery: async (query: string) => {
    set({ searchQuery: query });
    const { selectedTag } = get();
    if (!query.trim()) {
      set((s) => ({ displayNotes: applyFilters(s.notes, "", selectedTag) }));
      return;
    }
    // Full-text DB search (includes segment / summary content)
    try {
      const results = await NotesRepo.search(query);
      // Re-apply tag filter on top of DB results
      set({ displayNotes: applyFilters(results, "", selectedTag) });
    } catch {
      // Fallback to in-memory filtering
      set((s) => ({ displayNotes: applyFilters(s.notes, query, selectedTag) }));
    }
  },

  setSelectedTag: (tag: string | null) => {
    set({ selectedTag: tag });
    const { notes, searchQuery } = get();
    // If there's an active search we reuse displayNotes as base
    const base = searchQuery.trim() ? get().displayNotes : notes;
    // Reset to full list then re-filter
    const refiltered = applyFilters(notes, searchQuery, tag);
    set({ displayNotes: refiltered });
  },

  // ─── Pinning ─────────────────────────────────────────────────────────────

  togglePin: async (id: string) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    await get().updateNote({ id, isPinned: !note.isPinned });
  },

  // ─── Tags ─────────────────────────────────────────────────────────────────

  updateNoteTags: async (id: string, tags: string[]) => {
    await get().updateNote({ id, tags });
    const allTags = await NotesRepo.getAllTags();
    set({ allTags });
  },

  // ─── Segments ────────────────────────────────────────────────────────────

  addSegment: async (seg) => {
    const segment: NoteSegment = { ...seg, id: generateId() };
    await SegmentsRepo.create(segment);
    set((s) => ({ currentSegments: [...s.currentSegments, segment] }));
    return segment;
  },

  addSegments: async (segs) => {
    await SegmentsRepo.createMany(segs);
    set((s) => ({ currentSegments: [...s.currentSegments, ...segs] }));
  },

  loadSegments: async (noteId: string) => {
    const segments = await SegmentsRepo.getByNoteId(noteId);
    set({ currentSegments: segments });
    return segments;
  },

  // ─── Summary ─────────────────────────────────────────────────────────────

  saveSummary: async (summary) => {
    await SummariesRepo.upsert(summary);
    set({ currentSummary: summary });
  },

  loadSummary: async (noteId: string) => {
    const summary = await SummariesRepo.getByNoteId(noteId);
    set({ currentSummary: summary });
    return summary;
  },
}));
