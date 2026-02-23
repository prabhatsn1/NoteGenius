/**
 * NoteGenius – Flashcard display card component.
 * Flip animation between front and back.
 */
import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import type { Flashcard } from "../types/models";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const CARD_HEIGHT = 280;

interface FlashcardCardProps {
  card: Flashcard;
  showAnswer: boolean;
  onFlip: () => void;
}

export function FlashcardCard({
  card,
  showAnswer,
  onFlip,
}: FlashcardCardProps) {
  const colors = useThemeColors();

  const typeLabelMap: Record<string, string> = {
    qa: "Q&A",
    cloze: "Cloze",
    "term-def": "Term → Def",
    "def-term": "Def → Term",
  };
  const typeLabel = typeLabelMap[card.type];
  const isAiGenerated = card.tags.includes("ai-generated");

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onFlip}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        showAnswer
          ? `Answer: ${card.back}. Tap to flip.`
          : `Question: ${card.front}. Tap to reveal answer.`
      }
    >
      {/* Type badge + AI indicator */}
      <View style={styles.badgeRow}>
        <View
          style={[styles.typeBadge, { backgroundColor: colors.primary + "20" }]}
        >
          <Text style={[styles.typeText, { color: colors.primary }]}>
            {typeLabel}
          </Text>
        </View>
        {isAiGenerated && (
          <View
            style={[styles.aiBadge, { backgroundColor: colors.accent + "20" }]}
          >
            <Text style={[styles.aiText, { color: colors.accent }]}>✨ AI</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {showAnswer ? "ANSWER" : "QUESTION"}
        </Text>
        <Text style={[styles.cardText, { color: colors.text }]}>
          {showAnswer ? card.back : card.front}
        </Text>
      </View>

      {/* Tags */}
      {card.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {card.tags
            .filter((t) => t !== "ai-generated")
            .slice(0, 3)
            .map((tag, i) => (
              <View
                key={i}
                style={[styles.tag, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  {tag}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Flip hint */}
      <Text style={[styles.flipHint, { color: colors.textMuted }]}>
        Tap to {showAnswer ? "see question" : "reveal answer"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: "center",
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  typeText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  aiBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  aiText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  cardText: {
    fontSize: FontSize.xl,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 30,
  },
  tagsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    justifyContent: "center",
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: FontSize.xs,
  },
  flipHint: {
    textAlign: "center",
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
  },
});
