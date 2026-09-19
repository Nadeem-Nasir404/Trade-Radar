import Constants from "expo-constants";
import { Platform } from "react-native";
import { isExpoGo } from "./is-expo-go";

/**
 * expo-notifications' native module isn't bundled into Expo Go at all as of SDK 53 - even a
 * plain top-level `import * as Notifications from "expo-notifications"` throws synchronously
 * there ("Android Push notifications... was removed from Expo Go"), before any of its functions
 * are ever called. A static import can't be conditionally skipped, so this wraps the whole
 * module behind a dynamic `import()` that's only ever evaluated outside Expo Go. In a real
 * dev/production build (or on iOS, where Expo Go still supports local notifications) this
 * behaves exactly like using expo-notifications directly.
 */
async function loadNotifications() {
  if (isExpoGo) return null;
  return import("expo-notifications");
}

export async function setupNotificationHandler(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function scheduleLocalNotification(title: string, body: string): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
    return true;
  } catch {
    return false;
  }
}

/** True if local notifications are actually available right now (real build/iOS Expo Go) and the OS permission is granted. */
export async function getNotificationPermissionGranted(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** Prompts the OS permission dialog. Returns whether it ended up granted. No-ops (returns false) in Expo Go. */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Fetches the device's Expo push token so the server can wake the app via FCM/APNs even when
 * it's fully closed. Requires a real build (not Expo Go) and a granted permission; returns null
 * otherwise so callers can just skip registration silently.
 */
export async function getExpoPushToken(): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch {
    return null;
  }
}
