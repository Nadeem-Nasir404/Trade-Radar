import { Pressable, type PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { haptics } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Same spring as Button, so a row press and a button press settle with the same feel app-wide.
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

/** Drop-in Pressable replacement with a soft spring press feedback (slight scale + dim) instead of plain Pressable's abrupt opacity flip. */
export function PressableScale({ children, style, onPressIn, onPressOut, ...props }: PressableProps) {
  const progress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.03 }],
    opacity: 1 - progress.value * 0.08,
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        progress.value = withSpring(1, PRESS_SPRING);
        haptics.light();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        progress.value = withSpring(0, PRESS_SPRING);
        onPressOut?.(e);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
