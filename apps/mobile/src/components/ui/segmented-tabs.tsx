import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

interface SegmentedTabsProps<T extends string> {
  tabs: readonly T[];
  value: T;
  onChange: (value: T) => void;
  getLabel?: (tab: T) => string;
}

/** Pill tab row with a spring-timed sliding indicator that measures each tab's real layout (labels can be any width). */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, getLabel }: SegmentedTabsProps<T>) {
  const { colors } = useTheme();
  const [layouts, setLayouts] = useState<Partial<Record<T, { x: number; width: number }>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    indicatorX.value = withTiming(l.x, { duration: 260, easing: Easing.out(Easing.cubic) });
    indicatorWidth.value = withTiming(l.width, { duration: 260, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, layouts]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const handleLayout = (tab: T) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const existing = prev[tab];
      if (existing && existing.x === x && existing.width === width) return prev;
      return { ...prev, [tab]: { x, width } };
    });
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Animated.View style={[styles.indicator, { backgroundColor: colors.brand }, indicatorStyle]} />
      {tabs.map((tab) => {
        const active = tab === value;
        return (
          <Pressable
            key={tab}
            onLayout={handleLayout(tab)}
            onPress={() => {
              haptics.selection();
              onChange(tab);
            }}
            style={styles.tab}
          >
            <ThemedText style={[styles.tabText, { color: active ? colors.brandForeground : colors.foregroundMuted }]}>
              {getLabel ? getLabel(tab) : tab}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, position: "relative" },
  indicator: { position: "absolute", top: 0, bottom: 0, borderRadius: radius.full },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  tabText: { fontSize: 13, fontWeight: "500" },
});
