/**
 * NoteGenius – Root layout.
 * Handles first-launch setup gate and global providers.
 */
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useColorScheme } from "../hooks/use-color-scheme";
import { getDatabase } from "../src/data/database";
import {
  Sentry,
  initSentry,
  setSentryUser,
} from "../src/services/monitoring/sentry";
import SetupScreen from "../src/screens/SetupScreen";
import { useUserStore } from "../src/store/useUserStore";

// Initialise Sentry as early as possible so startup errors are captured.
initSentry();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayout() {
  const colorScheme = useColorScheme();
  const { isSetupComplete, loadProfile, profile } = useUserStore();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Initialize database and load user profile on app start
    async function init() {
      await getDatabase();
      await loadProfile();
      setDbReady(true);
    }
    init();
  }, []);

  // Tag Sentry events with the user's display name (no PII beyond what they entered).
  useEffect(() => {
    if (profile?.name) setSentryUser(profile.name);
  }, [profile?.name]);

  // Show setup screen on first launch
  if (dbReady && !isSetupComplete) {
    return (
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <SetupScreen />
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="note/[id]"
            options={{ headerShown: false, presentation: "card" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Wrap with Sentry's error boundary so unhandled JS crashes are reported.
export default Sentry.wrap(RootLayout);
