import { View, type ViewProps } from "react-native";
import Animated, { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";

/** Only the first screenful cascades in; rows mounted later while scrolling just appear. */
const ANIMATED_ROWS = 12;

/**
 * Fades its content up into place when it mounts, staggered by `index` so list rows and stacked
 * cards cascade in. Skipped when the system "reduce motion" setting is on.
 */
export function FadeInItem({ index, children, style }: { index: number } & ViewProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || index >= ANIMATED_ROWS) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 45, 360))
        .duration(360)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
