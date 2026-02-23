/**
 * NoteGenius – Real-time waveform visualization component.
 * Renders amplitude bars that animate during recording.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '../constants/theme';

interface WaveformViewProps {
  /** Array of amplitude values (0..1) */
  data: number[];
  /** Height of the waveform container */
  height?: number;
  /** Color override */
  color?: string;
  /** Number of visible bars */
  barCount?: number;
}

export function WaveformView({
  data,
  height = 60,
  color,
  barCount = 40,
}: WaveformViewProps) {
  const colors = useThemeColors();
  const barColor = color ?? colors.primary;

  // Take the last N values (or pad with zeros)
  const visible = data.slice(-barCount);
  while (visible.length < barCount) {
    visible.unshift(0);
  }

  return (
    <View
      style={[styles.container, { height }]}
      accessibilityLabel="Waveform visualization"
      accessibilityRole="image"
    >
      {visible.map((amp, i) => {
        const barHeight = Math.max(2, amp * height * 0.9);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: barHeight,
                backgroundColor: barColor,
                opacity: 0.4 + amp * 0.6,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
    maxWidth: 6,
  },
});
