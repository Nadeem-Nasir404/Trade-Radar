import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
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

/**
 * Each loaded weight of a family. Custom fonts are one file per weight, so a `fontWeight` on top of
 * one renders differently per platform (Android swaps in the system font or fakes the bold).
 * ThemedText turns `fontWeight` into the matching file instead.
 */
const WEIGHTS: { family: string; byWeight: Record<number, string> }[] = [
  {
    family: "Manrope",
    byWeight: { 400: fonts.body, 500: fonts.bodyMedium, 600: fonts.bodySemibold, 700: fonts.bodyBold },
  },
  {
    family: "PlusJakartaSans",
    byWeight: { 600: "PlusJakartaSans_600SemiBold", 700: fonts.displaySemibold, 800: fonts.display },
  },
  {
    family: "SpaceGrotesk",
    byWeight: { 500: fonts.headingMedium, 600: fonts.headingSemibold, 700: fonts.headingBold },
  },
];

function weightNumber(weight: TextStyle["fontWeight"]): number | null {
  if (weight == null) return null;
  if (weight === "bold") return 700;
  if (weight === "normal") return 400;
  const n = Number(weight);
  return Number.isFinite(n) ? n : null;
}

/** The closest loaded file of `family` for `weight`. */
function fileFor(family: string, weight: number): string | undefined {
  const entry = WEIGHTS.find((w) => family.startsWith(w.family));
  if (!entry) return undefined;
  const available = Object.keys(entry.byWeight).map(Number);
  const closest = available.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
  return entry.byWeight[closest];
}

export function ThemedText({ variant = "body", style, ...props }: TextProps & { variant?: Variant }) {
  const { colors } = useTheme();
  const color =
    variant === "subtle" ? colors.foregroundSubtle : variant === "muted" || variant === "label" ? colors.foregroundMuted : colors.foreground;

  const flat = StyleSheet.flatten(style) ?? {};
  const weight = weightNumber(flat.fontWeight);
  const family = flat.fontFamily ?? VARIANT_STYLE[variant].fontFamily;
  const weighted = weight != null && family ? fileFor(family, weight) : undefined;

  return (
    <Text style={[{ color }, VARIANT_STYLE[variant], style, weighted ? { fontFamily: weighted, fontWeight: "normal" } : null]} {...props} />
  );
}
