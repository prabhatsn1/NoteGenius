/**
 * NoteGenius – Tab navigation layout.
 * Tabs: Record, Notes, Flashcards, Settings
 */
import { Tabs } from "expo-router";
import { Platform, Text, useColorScheme } from "react-native";
import { Colors } from "../../src/constants/theme";

/** Simple emoji-based tab icon. */
function TabIcon({ emoji }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          ...(Platform.OS === "ios" ? { position: "absolute" } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Record",
          tabBarIcon: ({ color }) => <TabIcon emoji="🎤" color={color} />,
          tabBarAccessibilityLabel: "Record tab",
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color }) => <TabIcon emoji="📝" color={color} />,
          tabBarAccessibilityLabel: "Notes tab",
        }}
      />
      <Tabs.Screen
        name="flashcards"
        options={{
          title: "Flashcards",
          tabBarIcon: ({ color }) => <TabIcon emoji="🃏" color={color} />,
          tabBarAccessibilityLabel: "Flashcards tab",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} />,
          tabBarAccessibilityLabel: "Settings tab",
        }}
      />
      {/* Hide previous template tab */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
