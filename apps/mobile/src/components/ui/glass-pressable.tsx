import { useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle, type Insets } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/use-theme";

interface GlassPressableProps {
  onPress?: () => void;
  onLongPress?: () => void;
  /** Highlights the button with the brand tint (selected state). */
  active?: boolean;
  disabled?: boolean;
  hitSlop?: number | Insets;
  /** Read out by screen readers. */
  accessibilityLabel?: string;
  /** Stack the children vertically instead of in a row. */
  vertical?: boolean;
  /** Size, radius and padding of the button. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Frosted-glass button: real backdrop blur behind a translucent tint, with a springy press
 * (the button shrinks slightly and the tint deepens while the finger is down).
 */
export function GlassPressable({ onPress, onLongPress, active = false, disabled, hitSlop, accessibilityLabel, vertical, style, children }: GlassPressableProps) {
  const { colors, isDark } = useTheme();
  // Held in state rather than a ref so render never reads ref.current.
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);

  const animateTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  const tint = active ? colors.brandGlow : colors.glass;
  const pressedTint = active ? colors.brand : colors.glassHover;

  return (
    <Animated.View
      style={[
        styles.base,
        { borderColor: active ? colors.brand : colors.glassBorder, opacity: disabled ? 0.5 : 1, transform: [{ scale }] },
        style,
      ]}
    >
      <BlurView
        intensity={isDark ? 50 : 70}
        tint={isDark ? "dark" : "light"}
        experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: pressed ? pressedTint : tint, opacity: pressed ? 0.35 : 1 }]} />
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: active, disabled: !!disabled }}
        onPressIn={() => {
          setPressed(true);
          animateTo(0.93);
        }}
        onPressOut={() => {
          setPressed(false);
          animateTo(1);
        }}
        style={[styles.inner, vertical && styles.innerVertical]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden", borderWidth: 1 },
  inner: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  innerVertical: { flexDirection: "column", gap: 6 },
});
