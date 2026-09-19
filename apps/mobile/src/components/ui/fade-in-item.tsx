import Animated, { Easing, FadeIn } from "react-native-reanimated";
import type { ViewProps } from "react-native";

/** Staggers FlatList row mount-in with a clean fade (no bounce/slide) - delay is capped so a long list doesn't feel sluggish by the time it reaches the fold. */
export function FadeInItem({ index, children, style }: { index: number } & ViewProps) {
  return (
    <Animated.View entering={FadeIn.delay(Math.min(index * 40, 320)).duration(380).easing(Easing.out(Easing.quad))} style={style}>
      {children}
    </Animated.View>
  );
}
