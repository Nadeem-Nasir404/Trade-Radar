import Animated, { Easing, FadeIn } from "react-native-reanimated";
import type { ViewProps } from "react-native";

/** Rows past roughly the first screen render without the entrance fade. */
const ANIMATED_ROWS = 12;

/**
 * Staggers the first screen of FlatList rows in with a clean fade (no bounce/slide). Rows further
 * down mount as the user scrolls, and a delayed fade there shows up as blank gaps mid-scroll, so
 * they render immediately.
 */
export function FadeInItem({ index, children, style }: { index: number } & ViewProps) {
  if (index >= ANIMATED_ROWS) return <Animated.View style={style}>{children}</Animated.View>;
  return (
    <Animated.View entering={FadeIn.delay(Math.min(index * 40, 320)).duration(380).easing(Easing.out(Easing.quad))} style={style}>
      {children}
    </Animated.View>
  );
}
