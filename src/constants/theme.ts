/**
 * NoteGenius – Theme constants.
 * Light/Dark with OS sync and high-contrast support.
 */
import { useColorScheme } from "react-native";

export const Colors = {
  light: {
    primary: "#4A90D9",
    primaryDark: "#2E6DB4",
    secondary: "#6C63FF",
    background: "#FFFFFF",
    surface: "#F5F7FA",
    surfaceVariant: "#E8ECF1",
    text: "#1A1A2E",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    border: "#E5E7EB",
    error: "#EF4444",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#DC2626",
    card: "#FFFFFF",
    accent: "#8B5CF6",
    // Recording
    recordRed: "#EF4444",
    recordRedDark: "#B91C1C",
    // Sentiment colors
    sentimentPositive: "#22C55E",
    sentimentNeutral: "#9CA3AF",
    sentimentNegative: "#EF4444",
    // Flashcard difficulty
    difficultyEasy: "#22C55E",
    difficultyGood: "#3B82F6",
    difficultyHard: "#F59E0B",
    difficultyAgain: "#EF4444",
    // Tab bar
    tabBar: "#FFFFFF",
    tabBarBorder: "#E5E7EB",
    tabActive: "#4A90D9",
    tabInactive: "#9CA3AF",
  },
  dark: {
    primary: "#5BA3EC",
    primaryDark: "#4A90D9",
    secondary: "#8B80FF",
    background: "#0F0F23",
    surface: "#1A1A2E",
    surfaceVariant: "#252542",
    text: "#EAEAFF",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    border: "#374151",
    error: "#F87171",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#EF4444",
    card: "#1A1A2E",
    accent: "#A78BFA",
    // Recording
    recordRed: "#F87171",
    recordRedDark: "#EF4444",
    // Sentiment colors
    sentimentPositive: "#4ADE80",
    sentimentNeutral: "#6B7280",
    sentimentNegative: "#F87171",
    // Flashcard difficulty
    difficultyEasy: "#4ADE80",
    difficultyGood: "#60A5FA",
    difficultyHard: "#FBBF24",
    difficultyAgain: "#F87171",
    // Tab bar
    tabBar: "#1A1A2E",
    tabBarBorder: "#374151",
    tabActive: "#5BA3EC",
    tabInactive: "#6B7280",
  },
} as const;

export type ThemeColors = typeof Colors.light | typeof Colors.dark;

/** Hook to get current theme colors. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? Colors.dark : Colors.light;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  body: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  title: 34,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
