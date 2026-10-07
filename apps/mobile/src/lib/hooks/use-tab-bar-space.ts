import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Height of the floating tab bar pill. */
export const TAB_BAR_HEIGHT = 64;

/** Distance from the screen's bottom edge to the bottom of the floating tab bar. */
export function useTabBarBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + 4;
}

/**
 * Bottom padding a tab screen's scroll content needs so its last item can scroll clear of the
 * floating tab bar on every device (the bar sits above the gesture area, which varies by phone).
 */
export function useTabBarSpace(): number {
  return useTabBarBottom() + TAB_BAR_HEIGHT + 20;
}
