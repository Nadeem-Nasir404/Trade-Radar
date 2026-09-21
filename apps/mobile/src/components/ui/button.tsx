import { Pressable, ActivityIndicator, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

type Variant = "primary" | "glass" | "ghost" | "destructive";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, variant = "primary", loading, icon, style, disabled, ...props }: ButtonProps) {
  const { colors } = useTheme();

  const onColor = variant === "primary" || variant === "destructive" ? colors.brandForeground : colors.foreground;

  const content = loading ? (
    <ActivityIndicator color={onColor} size="small" />
  ) : (
    <>
      {icon}
      <ThemedText variant="subtitle" style={[styles.text, { color: onColor }]}>
        {title}
      </ThemedText>
    </>
  );

  if (variant === "primary") {
    return (
      <Pressable
        disabled={disabled || loading}
        style={({ pressed }) => [styles.wrap, (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}
        {...props}
      >
        <LinearGradient colors={[colors.brand, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.base}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
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
  wrap: { borderRadius: radius.md, overflow: "hidden" },
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  text: { fontSize: 15 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
