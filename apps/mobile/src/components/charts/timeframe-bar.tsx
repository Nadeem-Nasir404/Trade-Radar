import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/ui/themed-text";
import { GlassPressable } from "@/components/ui/glass-pressable";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

export const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d"] as const;
export type ChartTimeframe = (typeof TIMEFRAMES)[number];

/**
 * The chart's timeframe picker, shared by the market screen and the full-screen chart so they
 * never drift apart. Individual glass pills (not one bordered pill-within-a-pill) with the same
 * active-state language as the draw-tool pills right below it, so the whole card reads as one
 * design instead of two different button styles stacked on top of each other.
 */
export function TimeframeBar({
  value,
  onChange,
  style,
}: {
  value: ChartTimeframe;
  onChange: (tf: ChartTimeframe) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={[styles.scroll, style]}>
      {TIMEFRAMES.map((tf) => {
        const active = tf === value;
        return (
          <GlassPressable
            key={tf}
            active={active}
            accessibilityLabel={`${tf} timeframe`}
            onPress={() => {
              haptics.selection();
              onChange(tf);
            }}
            style={styles.item}
          >
            <ThemedText style={{ color: active ? colors.brand : colors.foregroundMuted, fontWeight: "700", fontSize: 13 }}>
              {tf.toUpperCase()}
            </ThemedText>
          </GlassPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { flexDirection: "row", gap: 8, paddingVertical: 2, paddingRight: 4 },
  item: { minWidth: 48, height: 36, borderRadius: radius.full, paddingHorizontal: 6 },
});
