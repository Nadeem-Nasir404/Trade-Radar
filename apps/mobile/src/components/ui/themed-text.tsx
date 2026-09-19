import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/lib/use-theme";

type Variant = "title" | "subtitle" | "body" | "muted" | "subtle" | "label" | "mono";

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  title: { fontSize: 24, fontWeight: "600", letterSpacing: -0.3 },
  subtitle: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15 },
  muted: { fontSize: 14 },
  subtle: { fontSize: 12 },
  label: { fontSize: 13, fontWeight: "500" },
  mono: { fontVariant: ["tabular-nums"] },
};

export function ThemedText({ variant = "body", style, ...props }: TextProps & { variant?: Variant }) {
  const { colors } = useTheme();
  const color =
    variant === "subtle" ? colors.foregroundSubtle : variant === "muted" || variant === "label" ? colors.foregroundMuted : colors.foreground;

  return <Text style={[{ color }, VARIANT_STYLE[variant], style]} {...props} />;
}
