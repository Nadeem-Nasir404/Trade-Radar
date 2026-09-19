import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { ThemedText } from "./themed-text";
import { formatCompactPrice } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";

interface PriceTextProps {
  value: number | null;
  variant?: "mono" | "title" | "body";
  style?: TextStyle;
}

/** Formatted price that briefly glows green/red on the underlying value changing - "live" data instead of a static number that silently jump-cuts. */
export function PriceText({ value, variant = "mono", style }: PriceTextProps) {
  const { colors } = useTheme();
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<{ id: number; positive: boolean } | null>(null);

  useEffect(() => {
    if (value !== null && prevRef.current !== null && value !== prevRef.current) {
      setFlash({ id: Date.now(), positive: value > prevRef.current });
    }
    prevRef.current = value;
  }, [value]);

  return (
    <View style={styles.wrap}>
      {flash && <FlashGlow key={flash.id} color={flash.positive ? colors.positive : colors.negative} />}
      <ThemedText variant={variant} style={style}>
        {formatCompactPrice(value)}
      </ThemedText>
    </View>
  );
}

function FlashGlow({ color }: { color: string }) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, backgroundColor: color }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, animatedStyle]} />;
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  glow: { borderRadius: 6, marginHorizontal: -4, marginVertical: -2 },
});
