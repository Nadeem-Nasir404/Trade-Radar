import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "./ui/themed-text";
import { Button } from "./ui/button";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.glowWrap}>
        <LinearGradient colors={[colors.brandGlow, "transparent"]} style={styles.glow} />
        <View style={[styles.iconWrap, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Ionicons name={icon} size={26} color={colors.brand} />
        </View>
      </View>
      <ThemedText variant="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText variant="muted" style={styles.description}>
        {description}
      </ThemedText>
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={styles.button} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  glowWrap: { width: 88, height: 88, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  glow: { position: "absolute", width: 88, height: 88, borderRadius: 44 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { textAlign: "center" },
  description: { textAlign: "center", maxWidth: 260 },
  button: { marginTop: 12, minWidth: 180 },
});
