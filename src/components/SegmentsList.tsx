/**
 * NoteGenius – Segments list component.
 * Renders voice + typed segments with source badges and timestamps.
 * Supports filter: all | voice | typed.
 */
import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import type { NoteSegment, SegmentFilter } from '../types/models';
import { useThemeColors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { formatDuration } from '../utils/time';

interface SegmentsListProps {
  segments: NoteSegment[];
  filter: SegmentFilter;
  onFilterChange: (filter: SegmentFilter) => void;
}

export function SegmentsList({ segments, filter, onFilterChange }: SegmentsListProps) {
  const colors = useThemeColors();

  const filtered = segments.filter((seg) => {
    if (filter === 'all') return true;
    return seg.source === filter;
  });

  const renderSegment = ({ item }: { item: NoteSegment }) => (
    <View
      style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`${item.source} segment: ${item.text}`}
    >
      <View style={styles.segmentHeader}>
        <View
          style={[
            styles.badge,
            { backgroundColor: item.source === 'voice' ? colors.primary : colors.accent },
          ]}
        >
          <Text style={styles.badgeText}>
            {item.source === 'voice' ? '🎤' : '⌨️'} {item.source}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.textMuted }]}>
          {formatDuration(item.startMs)} – {formatDuration(item.endMs)}
        </Text>
      </View>
      <Text style={[styles.segmentText, { color: colors.text }]}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Filter toggles */}
      <View style={styles.filterRow}>
        {(['all', 'voice', 'typed'] as SegmentFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              {
                backgroundColor: filter === f ? colors.primary : colors.surfaceVariant,
                borderColor: filter === f ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onFilterChange(f)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${f} segments`}
            accessibilityState={{ selected: filter === f }}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f ? '#FFFFFF' : colors.text },
              ]}
            >
              {f === 'all' ? 'All' : f === 'voice' ? '🎤 Voice' : '⌨️ Typed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderSegment}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No segments yet
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  segment: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timestamp: {
    fontSize: FontSize.xs,
  },
  segmentText: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: FontSize.md,
  },
});
