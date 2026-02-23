/**
 * NoteGenius – Einstein-style AI panel.
 * Tabs: Highlights | Action Items | Topics | Follow-ups | Sentiment
 */
import React, { useState } from "react";
import {
  ScrollView,
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
import type { Summary } from "../types/models";

type EinsteinTab =
  | "highlights"
  | "actions"
  | "topics"
  | "followups"
  | "sentiment";

interface EinsteinPanelProps {
  summary: Summary;
}

export function EinsteinPanel({ summary }: EinsteinPanelProps) {
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState<EinsteinTab>("highlights");

  const tabs: { key: EinsteinTab; label: string; icon: string }[] = [
    { key: "highlights", label: "Highlights", icon: "✨" },
    { key: "actions", label: "Actions", icon: "📌" },
    { key: "topics", label: "Topics", icon: "🏷️" },
    { key: "followups", label: "Follow-ups", icon: "❓" },
    { key: "sentiment", label: "Sentiment", icon: "📊" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "highlights":
        return (
          <View>
            {summary.highlights.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                No highlights extracted
              </Text>
            ) : (
              summary.highlights.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.highlightCard,
                    {
                      backgroundColor: colors.surfaceVariant,
                      borderLeftColor: colors.accent,
                    },
                  ]}
                >
                  <Text style={[styles.highlightText, { color: colors.text }]}>
                    &ldquo;{h}&rdquo;
                  </Text>
                </View>
              ))
            )}
          </View>
        );

      case "actions":
        return (
          <View>
            {summary.actionItems.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.actionCard,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <View style={styles.actionHeader}>
                  <Text style={[styles.actionOwner, { color: colors.primary }]}>
                    👤 {item.owner}
                  </Text>
                  {item.due && (
                    <Text style={[styles.dueDate, { color: colors.warning }]}>
                      📅 {item.due}
                    </Text>
                  )}
                </View>
                <Text style={[styles.actionTask, { color: colors.text }]}>
                  {item.task}
                </Text>
              </View>
            ))}
          </View>
        );

      case "topics":
        return (
          <View style={styles.topicsGrid}>
            {summary.topics.map((topic, i) => (
              <View
                key={i}
                style={[
                  styles.topicChip,
                  {
                    backgroundColor: colors.primary + "20",
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.topicText, { color: colors.primary }]}>
                  {topic}
                </Text>
              </View>
            ))}
          </View>
        );

      case "followups":
        return (
          <View>
            {summary.followUps.map((q, i) => (
              <View
                key={i}
                style={[
                  styles.followUpCard,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text style={[styles.followUpText, { color: colors.text }]}>
                  {q}
                </Text>
              </View>
            ))}
          </View>
        );

      case "sentiment":
        return (
          <View>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Sentiment per Segment (−1 to +1)
            </Text>
            <View style={styles.sentimentTimeline}>
              {(summary.sentimentBySegment ?? []).map((score, i) => {
                const color =
                  score > 0.2
                    ? colors.sentimentPositive
                    : score < -0.2
                      ? colors.sentimentNegative
                      : colors.sentimentNeutral;
                return (
                  <View key={i} style={styles.sentimentBar}>
                    <View
                      style={[
                        styles.sentimentFill,
                        {
                          backgroundColor: color,
                          height: Math.max(4, Math.abs(score) * 40),
                          alignSelf: score >= 0 ? "flex-end" : "flex-start",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.sentimentScore,
                        { color: colors.textMuted },
                      ]}
                    >
                      {score.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        🧠 Einstein AI Panel
      </Text>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
      >
        <View style={styles.tabsRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                {
                  backgroundColor:
                    activeTab === tab.key ? colors.primary : "transparent",
                  borderColor:
                    activeTab === tab.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === tab.key ? "#FFFFFF" : colors.textSecondary,
                  },
                ]}
              >
                {tab.icon} {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  tabsScroll: {
    marginBottom: Spacing.md,
  },
  tabsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  content: {
    maxHeight: 300,
  },
  empty: {
    textAlign: "center",
    marginVertical: Spacing.lg,
    fontSize: FontSize.md,
  },
  // Highlights
  highlightCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    marginBottom: Spacing.sm,
  },
  highlightText: {
    fontSize: FontSize.md,
    fontStyle: "italic",
    lineHeight: 20,
  },
  // Actions
  actionCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  actionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  actionOwner: {
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  actionTask: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  dueDate: {
    fontSize: FontSize.xs,
  },
  // Topics
  topicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  topicChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  topicText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  // Follow-ups
  followUpCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  followUpText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  // Sentiment
  sectionLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  sentimentTimeline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 80,
    justifyContent: "center",
  },
  sentimentBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: 60,
  },
  sentimentFill: {
    width: "80%",
    borderRadius: 2,
    minHeight: 4,
  },
  sentimentScore: {
    fontSize: 8,
    marginTop: 2,
  },
});
