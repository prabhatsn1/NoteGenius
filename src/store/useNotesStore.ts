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
  currentNote: Note | null;
  currentSegments: NoteSegment[];
  currentSummary: Summary | null;
  isLoading: boolean;

  // Actions
  loadNotes: () => Promise<void>;
  createNote: (title: string, languageCode?: string) => Promise<Note>;
  updateNote: (partial: Partial<Note> & { id: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string) => Promise<void>;
  clearCurrentNote: () => void;

  // Segments
  addSegment: (seg: Omit<NoteSegment, "id">) => Promise<NoteSegment>;
  addSegments: (segs: NoteSegment[]) => Promise<void>;
  loadSegments: (noteId: string) => Promise<NoteSegment[]>;

  // Summary
  saveSummary: (summary: Summary) => Promise<void>;
  loadSummary: (noteId: string) => Promise<Summary | null>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  currentNote: null,
  currentSegments: [],
  currentSummary: null,
  isLoading: false,

  loadNotes: async () => {
    set({ isLoading: true });
    const notes = await NotesRepo.getAll();
    set({ notes, isLoading: false });
  },

  createNote: async (title: string, languageCode = "en-US") => {
    const now = Date.now();
    const note: Note = {
      id: generateId(),
      title,
      createdAt: now,
      updatedAt: now,
      languageCode,
    };
    await NotesRepo.create(note);
    set((s) => ({ notes: [note, ...s.notes] }));
    return note;
  },

  updateNote: async (partial) => {
    const updated = { ...partial, updatedAt: Date.now() };
    await NotesRepo.update(updated);
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === partial.id ? { ...n, ...updated } : n,
      ),
      currentNote:
        s.currentNote?.id === partial.id
          ? { ...s.currentNote, ...updated }
          : s.currentNote,
    }));
  },

  deleteNote: async (id: string) => {
    await NotesRepo.delete(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      currentNote: s.currentNote?.id === id ? null : s.currentNote,
      currentSegments: s.currentNote?.id === id ? [] : s.currentSegments,
      currentSummary: s.currentNote?.id === id ? null : s.currentSummary,
    }));
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
