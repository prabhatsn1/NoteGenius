/**
 * NoteGenius – Flashcards Screen.
 * Browse decks per note + All Cards.
 * Study session with SRS feedback (Again/Hard/Good/Easy).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashcardCard } from '../components/FlashcardCard';
import { useThemeColors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useFlashcardsStore } from '../store/useFlashcardsStore';
import { useNotesStore } from '../store/useNotesStore';
import type { Flashcard, SRSRating } from '../types/models';

export default function FlashcardsScreen() {
  const colors = useThemeColors();
  const {
    cards, dueCount, studySession,
    loadCards, startStudy, revealAnswer, rateCard, endStudy, refreshDueCount,
  } = useFlashcardsStore();
  const { notes, loadNotes } = useNotesStore();

  useEffect(() => {
    loadCards();
    loadNotes();
    refreshDueCount();
  }, []);

  // ─── Study Mode ───────────────────────────────────────────────────────
  if (studySession) {
    const currentCard = studySession.cards[studySession.currentIndex];
    if (!currentCard) {
      endStudy();
      return null;
    }

    const progress = `${studySession.currentIndex + 1}/${studySession.cards.length}`;

    const ratingButtons: { label: string; rating: SRSRating; color: string }[] = [
      { label: 'Again', rating: 0, color: colors.difficultyAgain },
      { label: 'Hard', rating: 2, color: colors.difficultyHard },
      { label: 'Good', rating: 4, color: colors.difficultyGood },
      { label: 'Easy', rating: 5, color: colors.difficultyEasy },
    ];

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Study header */}
        <View style={styles.studyHeader}>
          <TouchableOpacity onPress={endStudy}>
            <Text style={[styles.closeStudy, { color: colors.primary }]}>✕ End</Text>
          </TouchableOpacity>
          <Text style={[styles.progress, { color: colors.textSecondary }]}>{progress}</Text>
        </View>

        {/* Card */}
        <View style={styles.cardContainer}>
          <FlashcardCard
            card={currentCard}
            showAnswer={studySession.showAnswer}
            onFlip={revealAnswer}
          />
        </View>

        {/* Rating buttons (shown after revealing answer) */}
        {studySession.showAnswer && (
          <View style={styles.ratingRow}>
            {ratingButtons.map(({ label, rating, color }) => (
              <TouchableOpacity
                key={label}
                style={[styles.ratingButton, { backgroundColor: color }]}
                onPress={() => rateCard(rating)}
                accessibilityRole="button"
                accessibilityLabel={`Rate: ${label}`}
              >
                <Text style={styles.ratingButtonText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!studySession.showAnswer && (
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>
            Tap the card to reveal the answer
          </Text>
        )}
      </SafeAreaView>
    );
  }

  // ─── Browse Mode ──────────────────────────────────────────────────────
  // Group cards by noteId
  const noteCardCounts = new Map<string, number>();
  for (const card of cards) {
    noteCardCounts.set(card.noteId, (noteCardCounts.get(card.noteId) ?? 0) + 1);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Flashcards</Text>

      {/* Due count banner */}
      {dueCount > 0 && (
        <TouchableOpacity
          style={[styles.dueBanner, { backgroundColor: colors.primary }]}
          onPress={() => startStudy()}
          accessibilityLabel={`Study ${dueCount} due cards`}
        >
          <Text style={styles.dueText}>
            📚 {dueCount} card{dueCount > 1 ? 's' : ''} due for review
          </Text>
          <Text style={styles.dueAction}>Study Now →</Text>
        </TouchableOpacity>
      )}

      {/* All cards button */}
      <TouchableOpacity
        style={[styles.deckCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => startStudy()}
        accessibilityLabel={`All cards deck with ${cards.length} cards`}
      >
        <View style={styles.deckInfo}>
          <Text style={[styles.deckTitle, { color: colors.text }]}>🃏 All Cards</Text>
          <Text style={[styles.deckCount, { color: colors.textSecondary }]}>
            {cards.length} card{cards.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Per-note decks */}
      <FlatList
        data={notes.filter((n) => noteCardCounts.has(n.id))}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const count = noteCardCounts.get(item.id) ?? 0;
          return (
            <TouchableOpacity
              style={[styles.deckCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => startStudy(item.id)}
              accessibilityLabel={`${item.title} deck with ${count} cards`}
            >
              <View style={styles.deckInfo}>
                <Text style={[styles.deckTitle, { color: colors.text }]} numberOfLines={1}>
                  📝 {item.title}
                </Text>
                <Text style={[styles.deckCount, { color: colors.textSecondary }]}>
                  {count} card{count !== 1 ? 's' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          cards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🃏</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No flashcards yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Record a note, generate a summary, then create flashcards
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  dueBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  dueText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FontSize.md,
  },
  dueAction: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  deckCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  deckInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deckTitle: {
    fontSize: FontSize.body,
    fontWeight: '600',
    flex: 1,
  },
  deckCount: {
    fontSize: FontSize.sm,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  // Study mode
  studyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  closeStudy: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  progress: {
    fontSize: FontSize.md,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  ratingButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  tapHint: {
    textAlign: 'center',
    fontSize: FontSize.md,
    paddingVertical: Spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    maxWidth: 260,
  },
});
