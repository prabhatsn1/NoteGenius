/**
 * NoteGenius – UndoToast
 * A non-blocking snackbar shown at the bottom of a screen after a destructive
 * action (e.g. note deletion).  Slides up on mount, slides down on dismiss.
 * Exposes an "Undo" button to reverse the action while the toast is visible.
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity } from "react-native";
import {
  BorderRadius,
  FontSize,
  Spacing,
  useThemeColors,
} from "../constants/theme";

interface UndoToastProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** Duration the toast is visible before auto-dismissing (default 5000 ms). */
  duration?: number;
}

export function UndoToast({
  visible,
  message,
  onUndo,
  onDismiss,
  duration = 5_000,
}: UndoToastProps) {
  const colors = useThemeColors();
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideIn = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const slideOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => callback?.());
  };

  useEffect(() => {
    if (visible) {
      // Reset position before animating in
      translateY.setValue(120);
      opacity.setValue(0);
      slideIn();

      // Schedule auto-dismiss at the same time the store timer fires
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => {
        slideOut(onDismiss);
      }, duration);
    } else {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
      slideOut();
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleUndo = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    slideOut(onUndo);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.text, transform: [{ translateY }], opacity },
      ]}
      accessibilityLiveRegion="polite"
      pointerEvents={visible ? "auto" : "none"}
    >
      <Text
        style={[styles.message, { color: colors.background }]}
        numberOfLines={2}
      >
        {message}
      </Text>
      <TouchableOpacity
        style={[styles.undoButton, { backgroundColor: colors.primary }]}
        onPress={handleUndo}
        accessibilityRole="button"
        accessibilityLabel="Undo delete"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.undoText}>Undo</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: Spacing.lg,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    gap: Spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "500",
  },
  undoButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
  },
  undoText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: FontSize.sm,
  },
});
