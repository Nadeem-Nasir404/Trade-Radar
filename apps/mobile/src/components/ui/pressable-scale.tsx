import { Pressable, type PressableProps } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { haptics } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_IN = { duration: 120, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { duration: 180, easing: Easing.out(Easing.quad) };

/** Drop-in Pressable replacement with a soft, non-bouncy press feedback (slight scale + dim) instead of plain Pressable's abrupt opacity flip. */
export function PressableScale({ children, style, onPressIn, onPressOut, ...props }: PressableProps) {
  const progress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.02 }],
    opacity: 1 - progress.value * 0.08,
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        progress.value = withTiming(1, PRESS_IN);
        haptics.light();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        progress.value = withTiming(0, PRESS_OUT);
        onPressOut?.(e);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
