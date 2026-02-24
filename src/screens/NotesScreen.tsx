/**
 * NoteGenius – Notes List Screen.
 * Supports: full-text search, tag filtering, pinning/starring.
 */
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SwipeableNoteCard } from "../components/SwipeableNoteCard";
import { UndoToast } from "../components/UndoToast";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";
import { useNotesStore } from "../store/useNotesStore";
import type { Note } from "../types/models";

// ─── Tag Editor Modal ────────────────────────────────────────────────────────

interface TagsModalProps {
  note: Note | null;
  visible: boolean;
  onClose: () => void;
  onSave: (noteId: string, tags: string[]) => void;
}

function TagsModal({ note, visible, onClose, onSave }: TagsModalProps) {
  const colors = useThemeColors();
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (note) setTags(note.tags ?? []);
  }, [note]);

  const addTag = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((t) => [...t, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => setTags((t) => t.filter((x) => x !== tag));

  const handleSave = () => {
    if (note) onSave(note.id, tags);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={[
          styles.modalSheet,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          Edit Tags
        </Text>
        <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
          {note?.title}
        </Text>

        {/* Existing tags */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.existingTagsScroll}
        >
          <View style={styles.tagRow}>
            {tags.length === 0 ? (
              <Text style={[styles.noTagsHint, { color: colors.textMuted }]}>
                No tags yet
              </Text>
            ) : (
              tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChipEditable,
                    {
                      backgroundColor: colors.accent + "22",
                      borderColor: colors.accent + "44",
                    },
                  ]}
                  onPress={() => removeTag(tag)}
                >
                  <Text style={[styles.tagChipText, { color: colors.accent }]}>
                    {tag}
                  </Text>
                  <Text
                    style={[styles.tagChipRemove, { color: colors.accent }]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* Add new tag */}
        <View style={[styles.tagInputRow, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.tagInput, { color: colors.text }]}
            placeholder="Add a tag…"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addTag}
            returnKeyType="done"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.tagAddBtn, { backgroundColor: colors.primary }]}
            onPress={addTag}
          >
            <Text style={styles.tagAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[
              styles.modalBtn,
              { backgroundColor: colors.surfaceVariant },
            ]}
            onPress={onClose}
          >
            <Text
              style={[styles.modalBtnText, { color: colors.textSecondary }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function NotesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const {
    displayNotes,
    allTags,
    searchQuery,
    selectedTag,
    loadNotes,
    softDeleteNote,
    undoDeleteNote,
    archiveNote,
    undoArchiveNote,
    togglePin,
    updateNoteTags,
    setSearchQuery,
    setSelectedTag,
  } = useNotesStore();

  const [tagsModalNote, setTagsModalNote] = useState<Note | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    message: string;
    onUndo: () => void;
  }>({ visible: false, message: "", onUndo: () => {} });
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  }, [loadNotes]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handlePress = useCallback((noteId: string) => {
    router.push(`/note/${noteId}` as any);
  }, []);

  const handleDelete = useCallback(
    (noteId: string, title: string) => {
      softDeleteNote(noteId);
      setUndoToast({
        visible: true,
        message: `"${title}" deleted`,
        onUndo: undoDeleteNote,
      });
    },
    [softDeleteNote, undoDeleteNote],
  );

  const handleArchive = useCallback(
    (noteId: string, title: string) => {
      archiveNote(noteId);
      setUndoToast({
        visible: true,
        message: `"${title}" archived`,
        onUndo: undoArchiveNote,
      });
    },
    [archiveNote, undoArchiveNote],
  );

  const handleToastDismiss = useCallback(() => {
    setUndoToast((t) => ({ ...t, visible: false }));
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearchQuery(text);
    }, 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    setSearchQuery("");
  }, []);

  const handleTagFilter = useCallback(
    (tag: string | null) => {
      Keyboard.dismiss();
      setSelectedTag(selectedTag === tag ? null : tag);
    },
    [selectedTag],
  );

  const handleTagSave = useCallback((noteId: string, tags: string[]) => {
    updateNoteTags(noteId, tags);
  }, []);

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderNote = ({ item }: { item: Note }) => (
    <SwipeableNoteCard
      note={item}
      selectedTag={selectedTag}
      onPress={handlePress}
      onDelete={handleDelete}
      onArchive={handleArchive}
      onTogglePin={togglePin}
      onEditTags={setTagsModalNote}
      onTagFilter={(tag) => handleTagFilter(tag)}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>Notes</Text>

      {/* ── Search bar ── */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.surfaceVariant,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search notes, transcripts, summaries…"
          placeholderTextColor={colors.textMuted}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={handleClearSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.clearIcon, { color: colors.textMuted }]}>
              ✕
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tag filter chips ── */}
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagFilterScroll}
          contentContainerStyle={styles.tagFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  selectedTag === null ? colors.primary : colors.surfaceVariant,
                borderColor:
                  selectedTag === null ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleTagFilter(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: selectedTag === null ? "#fff" : colors.textSecondary },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedTag === tag ? colors.accent : colors.surfaceVariant,
                  borderColor:
                    selectedTag === tag ? colors.accent : colors.border,
                },
              ]}
              onPress={() => handleTagFilter(tag)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedTag === tag ? "#fff" : colors.textSecondary,
                  },
                ]}
              >
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Note list ── */}
      <FlatList
        data={displayNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderNote}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              {searchQuery || selectedTag ? "🔍" : "📝"}
            </Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {searchQuery || selectedTag ? "No results" : "No notes yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {searchQuery || selectedTag
                ? "Try a different search or tag filter"
                : "Go to the Record tab to create your first voice note"}
            </Text>
          </View>
        }
      />

      {/* ── Tag editor modal ── */}
      <TagsModal
        note={tagsModalNote}
        visible={tagsModalNote !== null}
        onClose={() => setTagsModalNote(null)}
        onSave={handleTagSave}
      />

      {/* ── Undo toast (delete or archive) ── */}
      <UndoToast
        visible={undoToast.visible}
        message={undoToast.message}
        onUndo={undoToast.onUndo}
        onDismiss={handleToastDismiss}
        duration={5000}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    marginBottom: Spacing.sm,
  },
  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    paddingVertical: 2,
  },
  clearIcon: {
    fontSize: 14,
    paddingHorizontal: 4,
  },
  // Tag filter bar
  tagFilterScroll: {
    marginBottom: Spacing.sm,
    flexGrow: 0,
  },
  tagFilterContent: {
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  // List
  list: {
    paddingBottom: Spacing.xxl,
  },
  // Empty state
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
    maxWidth: 260,
  },
  // Tags modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    marginTop: -Spacing.sm,
  },
  existingTagsScroll: {
    flexGrow: 0,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    minHeight: 32,
  },
  noTagsHint: {
    fontSize: FontSize.sm,
    fontStyle: "italic",
  },
  tagChipEditable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  tagChipText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  tagChipRemove: {
    fontSize: 10,
    fontWeight: "700",
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  tagInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  tagAddBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tagAddBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FontSize.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    fontSize: FontSize.md,
  },
});
