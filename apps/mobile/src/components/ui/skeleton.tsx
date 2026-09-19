import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: object;
}

/** A pulsing glass placeholder for async content - used instead of a spinner wherever a row's eventual shape is known. */
export function Skeleton({ width = "100%", height = 16, radius: r = radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.glassHover }, animatedStyle, style]}
    />
  );
}

export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={28} height={28} radius={14} />
      <View style={styles.center}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} style={styles.gapTop} />
      </View>
      <View style={styles.right}>
        <Skeleton width={64} height={14} />
        <Skeleton width={40} height={11} style={styles.gapTop} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  center: { flex: 1, gap: 6 },
  right: { alignItems: "flex-end", gap: 6 },
  gapTop: { marginTop: 0 },
});
