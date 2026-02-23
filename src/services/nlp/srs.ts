/**
 * NoteGenius – SM-2 Spaced Repetition Algorithm (simplified).
 *
 * Based on the SuperMemo SM-2 algorithm:
 * - Easiness factor (EF) >= 1.3
 * - On quality < 3: reset repetitions/interval
 * - On quality >= 3: increase interval based on repetition count
 * - Schedule nextReviewAt accordingly
 *
 * Rating mapping: 0 = Again, 1 = Hard-, 2 = Hard, 3 = Hard+, 4 = Good, 5 = Easy
 */
import type { Flashcard, SRSRating } from "../../types/models";

const MS_PER_DAY = 86_400_000;
const MIN_EASINESS = 1.3;

export interface SRSUpdate {
  id: string;
  difficulty: number;
  interval: number;
  repetitions: number;
  easiness: number;
  nextReviewAt: number;
  updatedAt: number;
}

/**
 * Compute new SRS fields after a review.
 * @param card Current flashcard state
 * @param rating User rating (0..5)
 * @returns Updated SRS fields to persist
 */
export function computeSRS(card: Flashcard, rating: SRSRating): SRSUpdate {
  let { easiness, interval, repetitions } = card;
  const now = Date.now();

  // Update easiness factor
  easiness = easiness + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (easiness < MIN_EASINESS) easiness = MIN_EASINESS;

  if (rating < 3) {
    // Failed: reset
    repetitions = 0;
    interval = 0;
  } else {
    // Passed: increase interval
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easiness);
    }
  }

  // Map rating to difficulty (1..5)
  const difficulty = Math.max(1, Math.min(5, 5 - rating + 1));

  // Schedule next review
  const nextReviewAt = now + interval * MS_PER_DAY;

  return {
    id: card.id,
    difficulty,
    interval,
    repetitions,
    easiness: Math.round(easiness * 100) / 100, // round to 2 dp
    nextReviewAt,
    updatedAt: now,
  };
}

/** Get cards due for review from an array. */
export function filterDueCards(
  cards: Flashcard[],
  now = Date.now(),
): Flashcard[] {
  return cards.filter((c) => c.nextReviewAt <= now);
}
