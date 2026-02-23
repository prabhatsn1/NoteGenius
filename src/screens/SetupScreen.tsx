/**
 * NoteGenius – Setup Screen (first launch).
 * Asks for Name + Phone number only. No login required.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useUserStore } from '../store/useUserStore';

export default function SetupScreen() {
  const colors = useThemeColors();
  const { saveProfile } = useUserStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleContinue = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name to continue.');
      return;
    }
    saveProfile({ name: name.trim(), phone: phone.trim() });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo / Title */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🧠</Text>
            <Text style={[styles.appTitle, { color: colors.text }]}>NoteGenius</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your offline-first voice notes assistant
            </Text>
          </View>

          {/* Welcome message */}
          <Text style={[styles.welcome, { color: colors.text }]}>
            Let's get started! Tell us a bit about yourself.
          </Text>

          {/* Name input */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Your Name *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., John Doe"
              placeholderTextColor={colors.textMuted}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel="Enter your name"
            />
          </View>

          {/* Phone input */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g., +1 555-0100"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              returnKeyType="done"
              accessibilityLabel="Enter your phone number"
            />
          </View>

          {/* Privacy note */}
          <Text style={[styles.privacyNote, { color: colors.textMuted }]}>
            🔒 Everything stays on your device. No account, no cloud – just you and your notes.
          </Text>

          {/* Continue button */}
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.primary }]}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue to app"
          >
            <Text style={styles.continueText}>Get Started →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoEmoji: {
    fontSize: 72,
    marginBottom: Spacing.sm,
  },
  appTitle: {
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  welcome: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
  },
  privacyNote: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 18,
  },
  continueButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  continueText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FontSize.lg,
  },
});
