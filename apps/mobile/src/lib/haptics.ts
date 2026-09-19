import * as Haptics from "expo-haptics";

// expo-haptics (unlike expo-notifications) works fine in Expo Go, but every call is still
// wrapped defensively since haptics are a "nice to have" - a missing sensor or web preview
// should never throw and break the interaction it's decorating.
const safe = (fn: () => Promise<void>) => fn().catch(() => undefined);

export const haptics = {
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  selection: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
