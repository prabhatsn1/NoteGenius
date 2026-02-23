/**
 * NoteGenius – Flashcards store (Zustand).
 * Manages flashcard CRUD, SRS reviews, and study sessions.
 */
import { create } from "zustand";
import { FlashcardsRepo } from "../data/repos/FlashcardsRepo";
import { computeSRS } from "../services/nlp/srs";
import type { Flashcard, SRSRating, StudySession } from "../types/models";

interface FlashcardsState {
  cards: Flashcard[];
  dueCount: number;
  studySession: StudySession | null;
  isLoading: boolean;

  // Actions
  loadCards: () => Promise<void>;
  loadCardsByNote: (noteId: string) => Promise<void>;
  addCards: (cards: Flashcard[]) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  deleteCardsByNote: (noteId: string) => Promise<void>;
  refreshDueCount: () => Promise<void>;

  // Study
  startStudy: (noteId?: string) => Promise<void>;
  revealAnswer: () => void;
  rateCard: (rating: SRSRating) => Promise<void>;
  endStudy: () => void;
}

export const useFlashcardsStore = create<FlashcardsState>((set, get) => ({
  cards: [],
  dueCount: 0,
  studySession: null,
  isLoading: false,

  loadCards: async () => {
    set({ isLoading: true });
    const cards = await FlashcardsRepo.getAll();
    const dueCount = await FlashcardsRepo.getDueCount();
    set({ cards, dueCount, isLoading: false });
  },

  loadCardsByNote: async (noteId: string) => {
    set({ isLoading: true });
    const cards = await FlashcardsRepo.getByNoteId(noteId);
    set({ cards, isLoading: false });
  },

  addCards: async (cards: Flashcard[]) => {
    await FlashcardsRepo.createMany(cards);
    set((s) => ({ cards: [...s.cards, ...cards] }));
  },

  deleteCard: async (id: string) => {
    await FlashcardsRepo.delete(id);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
  },

  deleteCardsByNote: async (noteId: string) => {
    await FlashcardsRepo.deleteByNoteId(noteId);
    set((s) => ({ cards: s.cards.filter((c) => c.noteId !== noteId) }));
  },

  refreshDueCount: async () => {
    const dueCount = await FlashcardsRepo.getDueCount();
    set({ dueCount });
  },

  startStudy: async (noteId?: string) => {
    const dueCards = await FlashcardsRepo.getDue();
    const filtered = noteId
      ? dueCards.filter((c) => c.noteId === noteId)
      : dueCards;
    if (filtered.length === 0) {
      set({ studySession: null });
      return;
    }
    set({
      studySession: {
        noteId,
        cards: filtered,
        currentIndex: 0,
        showAnswer: false,
      },
    });
  },

  revealAnswer: () => {
    set((s) => {
      if (!s.studySession) return s;
      return { studySession: { ...s.studySession, showAnswer: true } };
    });
  },

  rateCard: async (rating: SRSRating) => {
    const session = get().studySession;
    if (!session) return;

    const card = session.cards[session.currentIndex];
    if (!card) return;

    // Compute new SRS values
    const updated = computeSRS(card, rating);
    await FlashcardsRepo.updateSRS(updated);

    // Move to next card or end session
    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.cards.length) {
      set({ studySession: null });
    } else {
      set({
        studySession: {
          ...session,
          currentIndex: nextIndex,
          showAnswer: false,
        },
      });
    }

    // Refresh due count
    const dueCount = await FlashcardsRepo.getDueCount();
    set({ dueCount });
  },

  endStudy: () => {
    set({ studySession: null });
  },
}));
