/**
 * NoteGenius – Local notification scheduler for due flashcards.
 * Uses expo-notifications for cross-platform local notifications.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { FlashcardsRepo } from "../../data/repos/FlashcardsRepo";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  /** Request permission for notifications. */
  async requestPermission(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();

    // Android: create notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("flashcards", {
        name: "Flashcard Reviews",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#4A90D9",
      });
    }

    return status === "granted";
  },

  /** Schedule a notification for due flashcards. */
  async scheduleDueReminder(dueCount: number): Promise<void> {
    if (dueCount <= 0) return;

    // Cancel existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule for 30 seconds from now (or use a time-based trigger)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📚 Flashcards Due!",
        body: `You have ${dueCount} flashcard${dueCount > 1 ? "s" : ""} ready for review.`,
        data: { type: "flashcard-review" },
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "flashcards" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 60, // 1 minute reminder
      },
    });
  },

  /** Schedule daily review reminder at a specific hour. */
  async scheduleDailyReminder(hour = 9): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const dueCount = await FlashcardsRepo.getDueCount();
    if (dueCount <= 0) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📚 Daily Review Time",
        body: `You have ${dueCount} flashcard${dueCount > 1 ? "s" : ""} waiting. Keep your streak going!`,
        data: { type: "daily-review" },
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "flashcards" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  },

  /** Update badge count with due cards. */
  async updateBadge(): Promise<void> {
    const count = await FlashcardsRepo.getDueCount();
    await Notifications.setBadgeCountAsync(count);
  },

  /** Cancel all notifications. */
  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  },
};
