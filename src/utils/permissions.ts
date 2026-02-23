/**
 * NoteGenius – Permission helpers.
 * Uses expo-audio permissions + expo-notifications.
 */
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as Notifications from "expo-notifications";
import { Alert, Linking } from "react-native";

export const Permissions = {
  /** Request audio recording permission with friendly explainer. */
  async requestMicrophone(): Promise<boolean> {
    const { granted } = await getRecordingPermissionsAsync();
    if (granted) return true;

    // Show explainer
    return new Promise((resolve) => {
      Alert.alert(
        "Microphone Access",
        "NoteGenius needs microphone access to record voice notes and transcribe speech.",
        [
          { text: "Not Now", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Allow",
            onPress: async () => {
              const { granted: g } = await requestRecordingPermissionsAsync();
              if (!g) {
                // Redirect to settings
                Alert.alert(
                  "Permission Required",
                  "Please enable microphone access in Settings.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Open Settings",
                      onPress: () => Linking.openSettings(),
                    },
                  ],
                );
              }
              resolve(g);
            },
          },
        ],
      );
    });
  },

  /** Request notification permission. */
  async requestNotifications(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;

    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === "granted";
  },

  /** Check all required permissions. */
  async checkAll(): Promise<{ microphone: boolean; notifications: boolean }> {
    const mic = await getRecordingPermissionsAsync();
    const notif = await Notifications.getPermissionsAsync();
    return {
      microphone: mic.granted,
      notifications: notif.status === "granted",
    };
  },
};
