import { Pressable, ActivityIndicator, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

type Variant = "primary" | "glass" | "ghost" | "destructive";
/** "md" is the full-size action button; "sm" is a compact pill for top bars and inline actions. */
type Size = "md" | "sm";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = "primary", size = "md", loading, icon, trailingIcon, style, disabled, ...props }: ButtonProps) {
  const { colors } = useTheme();

  const onColor = variant === "primary" || variant === "destructive" ? colors.brandForeground : colors.foreground;

  const content = loading ? (
    <ActivityIndicator color={onColor} size="small" />
  ) : (
    <>
      {icon}
      <ThemedText variant="subtitle" style={[styles.text, size === "sm" && styles.textSm, { color: onColor }]}>
        {title}
      </ThemedText>
      {trailingIcon}
    </>
  );

  if (variant === "primary") {
    return (
      <Pressable
        disabled={disabled || loading}
        accessibilityRole="button"
        style={({ pressed }) => [styles.wrap, size === "sm" && styles.wrapSm, (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}
        {...props}
      >
        <LinearGradient colors={[colors.brand, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.base, size === "sm" && styles.sm]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        size === "sm" && styles.sm,
        variant === "glass" && { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
        variant === "ghost" && { backgroundColor: "transparent" },
        variant === "destructive" && { backgroundColor: colors.negative },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      {...props}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden" },
  wrapSm: { borderRadius: radius.full },
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
  },
  sm: { height: 40, borderRadius: radius.full, paddingHorizontal: 14, gap: 6 },
  text: { fontSize: 15 },
  textSm: { fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
