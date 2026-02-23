/**
 * NoteGenius – Notes List Screen.
 * Shows all saved notes sorted by most recent.
 */
import { useRouter } from "expo-router";
import React, { useCallback, useEffect } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import { useNotesStore } from "../store/useNotesStore";
import type { Note } from "../types/models";
import { formatDuration, timeAgo } from "../utils/time";

export default function NotesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { notes, isLoading, loadNotes, deleteNote } = useNotesStore();

  useEffect(() => {
    loadNotes();
  }, []);

  const handlePress = useCallback((noteId: string) => {
    router.push(`/note/${noteId}` as any);
  }, []);

  const handleDelete = useCallback((noteId: string, title: string) => {
    Alert.alert(
      "Delete Note",
      `Are you sure you want to delete "${title}"? This will also delete its summary and flashcards.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteNote(noteId),
        },
      ],
    );
  }, []);

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[
        styles.noteCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => handlePress(item.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Note: ${item.title}`}
    >
      <View style={styles.noteHeader}>
        <Text
          style={[styles.noteTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.title || "Untitled"}
        </Text>
        <View style={styles.noteHeaderRight}>
          <Text style={[styles.noteTime, { color: colors.textMuted }]}>
            {timeAgo(item.updatedAt)}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(item.id, item.title)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Delete note: ${item.title}`}
            accessibilityRole="button"
            style={[
              styles.deleteButton,
              { backgroundColor: colors.danger + "18" },
            ]}
          >
            <Text style={styles.deleteIcon}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.noteMeta}>
        {item.durationMs ? (
          <View
            style={[
              styles.metaBadge,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <Text style={[styles.metaText, { color: colors.primary }]}>
              🎤 {formatDuration(item.durationMs)}
            </Text>
          </View>
        ) : null}
        {item.languageCode ? (
          <View
            style={[
              styles.metaBadge,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              🌐 {item.languageCode}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Notes</Text>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={renderNote}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadNotes}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon]}>📝</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No notes yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Go to the Record tab to create your first voice note
            </Text>
          </View>
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
    fontWeight: "800",
    marginBottom: Spacing.md,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  noteCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  noteTitle: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    flex: 1,
    marginRight: Spacing.sm,
  },
  noteHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  noteTime: {
    fontSize: FontSize.xs,
  },
  deleteButton: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  deleteIcon: {
    fontSize: 14,
  },
  noteMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
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
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    textAlign: "center",
    maxWidth: 250,
  },
});
