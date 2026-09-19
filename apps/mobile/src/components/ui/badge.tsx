import { View, StyleSheet } from "react-native";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";
import type { ThemeColors } from "@/lib/themes";

type Variant = "default" | "positive" | "negative" | "warning" | "brand";

function tones(colors: ThemeColors): Record<Variant, { bg: string; border: string; fg: string }> {
  return {
    default: { bg: colors.glass, border: colors.glassBorderStrong, fg: colors.foreground },
    positive: { bg: withAlpha(colors.positive, 0.15), border: withAlpha(colors.positive, 0.3), fg: colors.positive },
    negative: { bg: withAlpha(colors.negative, 0.15), border: withAlpha(colors.negative, 0.3), fg: colors.negative },
    warning: { bg: withAlpha(colors.warning, 0.15), border: withAlpha(colors.warning, 0.3), fg: colors.warning },
    brand: { bg: colors.brandGlow, border: colors.brandGlow, fg: colors.brand },
  };
}

export function Badge({ label, variant = "default" }: { label: string; variant?: Variant }) {
  const { colors } = useTheme();
  const tone = tones(colors)[variant];

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <ThemedText style={[styles.text, { color: tone.fg }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: "600" },
});
