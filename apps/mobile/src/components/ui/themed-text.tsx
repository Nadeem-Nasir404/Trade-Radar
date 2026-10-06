import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/lib/use-theme";
import { fonts } from "@/lib/theme";

type Variant = "title" | "subtitle" | "body" | "muted" | "subtle" | "label" | "mono";

// Space Grotesk carries headings and numbers (title/subtitle/mono - the latter is what price
// displays use); Manrope carries everything read as prose, per the glassmorphic design pass.
const VARIANT_STYLE: Record<Variant, TextStyle> = {
  title: { fontSize: 24, fontFamily: fonts.display, letterSpacing: -0.6 },
  subtitle: { fontSize: 17, fontFamily: fonts.displaySemibold, letterSpacing: -0.2 },
  body: { fontSize: 15, fontFamily: fonts.body },
  muted: { fontSize: 14, fontFamily: fonts.body },
  subtle: { fontSize: 12, fontFamily: fonts.body },
  label: { fontSize: 13, fontFamily: fonts.bodyMedium },
  mono: { fontVariant: ["tabular-nums"], fontFamily: fonts.headingSemibold },
};

export function ThemedText({ variant = "body", style, ...props }: TextProps & { variant?: Variant }) {
  const { colors } = useTheme();
  const color =
    variant === "subtle" ? colors.foregroundSubtle : variant === "muted" || variant === "label" ? colors.foregroundMuted : colors.foreground;

  return <Text style={[{ color }, VARIANT_STYLE[variant], style]} {...props} />;
}
