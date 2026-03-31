/**
 * NoteGenius – Summary display component.
 * Shows TL;DR, Key Points, Decisions, Action Items, Open Questions.
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { Summary } from "../types/models";
import {
  useThemeColors,
  Spacing,
  FontSize,
  BorderRadius,
} from "../constants/theme";

interface SummaryViewProps {
  summary: Summary;
}

export function SummaryView({ summary }: SummaryViewProps) {
  const colors = useThemeColors();

  const Section = ({
    title,
    items,
    icon,
  }: {
    title: string;
    items: string[];
    icon: string;
  }) => {
    if (items.length === 0) return null;
    return (
      <View style={[styles.section, { borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {icon} {title}
        </Text>
        {items.map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.text }]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Section title="TL;DR" items={summary.tldr} icon="📋" />
      <Section title="Key Points" items={summary.keyPoints} icon="🔑" />
      <Section title="Decisions" items={summary.decisions} icon="✅" />

      {/* Action Items (special formatting) */}
      {summary.actionItems.length > 0 && (
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            📌 Action Items
          </Text>
          {summary.actionItems.map((item, i) => (
            <View
              key={i}
              style={[
                styles.actionItem,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text style={[styles.actionOwner, { color: colors.primary }]}>
                {item.owner}
              </Text>
              <Text style={[styles.actionTask, { color: colors.text }]}>
                {item.task}
              </Text>
              {item.due && (
                <Text style={[styles.actionDue, { color: colors.warning }]}>
                  Due: {item.due}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <Section title="Open Questions" items={summary.openQuestions} icon="❓" />
      <Section title="Topics" items={summary.topics} icon="🏷️" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: {
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingRight: Spacing.md,
  },
  bullet: {
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  bulletText: {
    fontSize: FontSize.body,
    lineHeight: 22,
    flex: 1,
  },
  actionItem: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  actionOwner: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    marginBottom: 2,
  },
  actionTask: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  actionDue: {
    fontSize: FontSize.sm,
    marginTop: 4,
    fontStyle: "italic",
  },
});
