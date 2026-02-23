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

import { useColorScheme } from "@/hooks/use-color-scheme";
import { getDatabase } from "../src/data/database";
import SetupScreen from "../src/screens/SetupScreen";
import { useUserStore } from "../src/store/useUserStore";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isSetupComplete, loadProfile } = useUserStore();
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
  );
}
