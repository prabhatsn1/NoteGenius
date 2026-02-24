/**
 * NoteGenius – SwipeableNoteCard
 * Wraps a note list item with swipe gestures:
 *   • Swipe RIGHT → archive action (amber)
 *   • Swipe LEFT  → delete action  (red)
 */
import React, { useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import type { Note } from "../types/models";
import { formatDuration, timeAgo } from "../utils/time";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwipeableNoteCardProps {
  note: Note;
  selectedTag: string | null;
  onPress: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onArchive: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  onEditTags: (note: Note) => void;
  onTagFilter: (tag: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SwipeableNoteCard({
  note,
  selectedTag,
  onPress,
  onDelete,
  onArchive,
  onTogglePin,
  onEditTags,
  onTagFilter,
}: SwipeableNoteCardProps) {
  const colors = useThemeColors();
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipeable = () => swipeableRef.current?.close();

  // ── Left action: Archive (swipe right to reveal) ──────────────────────────
  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.6, 1],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={[styles.actionContainer, styles.archiveAction]}
        onPress={() => {
          closeSwipeable();
          onArchive(note.id, note.title);
        }}
        activeOpacity={0.85}
        accessibilityLabel={`Archive note: ${note.title}`}
        accessibilityRole="button"
      >
        <Animated.Text style={[styles.actionIcon, { transform: [{ scale }] }]}>
          📥
        </Animated.Text>
        <Animated.Text style={[styles.actionLabel, { transform: [{ scale }] }]}>
          Archive
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  // ── Right action: Delete (swipe left to reveal) ───────────────────────────
  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.6],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={[
          styles.actionContainer,
          styles.deleteAction,
          { backgroundColor: colors.danger },
        ]}
        onPress={() => {
          closeSwipeable();
          onDelete(note.id, note.title);
        }}
        activeOpacity={0.85}
        accessibilityLabel={`Delete note: ${note.title}`}
        accessibilityRole="button"
      >
        <Animated.Text style={[styles.actionIcon, { transform: [{ scale }] }]}>
          🗑
        </Animated.Text>
        <Animated.Text style={[styles.actionLabel, { transform: [{ scale }] }]}>
          Delete
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  const hasTags = (note.tags ?? []).length > 0;

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
    >
      <TouchableOpacity
        style={[
          styles.noteCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          note.isPinned && { borderColor: colors.primary + "66" },
        ]}
        onPress={() => onPress(note.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Note: ${note.title}`}
      >
        {/* ── Header ── */}
        <View style={styles.noteHeader}>
          {/* Pin button */}
          <TouchableOpacity
            onPress={() => onTogglePin(note.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={note.isPinned ? "Unpin note" : "Pin note"}
            accessibilityRole="button"
            style={styles.pinButton}
          >
            <Text
              style={[styles.pinIcon, { opacity: note.isPinned ? 1 : 0.3 }]}
            >
              📌
            </Text>
          </TouchableOpacity>

          <Text
            style={[styles.noteTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {note.title || "Untitled"}
          </Text>

          <View style={styles.noteHeaderRight}>
            <Text style={[styles.noteTime, { color: colors.textMuted }]}>
              {timeAgo(note.updatedAt)}
            </Text>
            {/* Tag editor button */}
            <TouchableOpacity
              onPress={() => onEditTags(note)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Edit tags"
              accessibilityRole="button"
              style={[
                styles.iconButton,
                { backgroundColor: colors.accent + "18" },
              ]}
            >
              <Text style={styles.iconButtonText}>🏷️</Text>
            </TouchableOpacity>
            {/* Delete button */}
            <TouchableOpacity
              onPress={() => onDelete(note.id, note.title)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Delete note: ${note.title}`}
              accessibilityRole="button"
              style={[
                styles.iconButton,
                { backgroundColor: colors.danger + "18" },
              ]}
            >
              <Text style={styles.iconButtonText}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Meta badges ── */}
        <View style={styles.noteMeta}>
          {note.durationMs ? (
            <View
              style={[
                styles.metaBadge,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Text style={[styles.metaText, { color: colors.primary }]}>
                🎤 {formatDuration(note.durationMs)}
              </Text>
            </View>
          ) : null}
          {note.languageCode ? (
            <View
              style={[
                styles.metaBadge,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                🌐 {note.languageCode}
              </Text>
            </View>
          ) : null}
          {hasTags &&
            (note.tags ?? []).map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.metaBadge,
                  {
                    backgroundColor:
                      selectedTag === tag
                        ? colors.accent + "33"
                        : colors.accent + "15",
                  },
                ]}
                onPress={() => onTagFilter(tag)}
              >
                <Text style={[styles.metaText, { color: colors.accent }]}>
                  #{tag}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Swipe actions
  actionContainer: {
    width: 88,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  archiveAction: {
    backgroundColor: "#F59E0B",
  },
  deleteAction: {
    // backgroundColor set dynamically from theme
  },
  actionIcon: {
    fontSize: 22,
  },
  actionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: "#fff",
  },
  // Note card (mirrors styles in NotesScreen)
  noteCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  pinButton: {
    paddingRight: 2,
  },
  pinIcon: {
    fontSize: 14,
  },
  noteTitle: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    flex: 1,
  },
  noteHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  noteTime: {
    fontSize: FontSize.xs,
  },
  iconButton: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  iconButtonText: {
    fontSize: 14,
  },
  noteMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  metaBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
  },
});
