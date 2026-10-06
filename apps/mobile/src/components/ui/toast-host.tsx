import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "./themed-text";
import { useToastStore, type ToastVariant } from "@/lib/stores/toast-store";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

const DURATION_MS = 3200;

/** Mounted once at the app root. Renders whatever `useToastStore` currently holds as a slide-up glass confirmation with an auto-dismiss progress bar. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  if (!toast) return null;
  return (
    <ToastCard
      key={toast.id}
      title={toast.title}
      message={toast.message}
      variant={toast.variant}
      onDone={dismiss}
      bottom={insets.bottom + 84}
    />
  );
}

function ToastCard({
  title,
  message,
  variant,
  onDone,
  bottom,
}: {
  title: string;
  message?: string;
  variant: ToastVariant;
  onDone: () => void;
  bottom: number;
}) {
  const { colors } = useTheme();
  const translateY = useSharedValue(30);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 200 });
    progress.value = withTiming(0, { duration: DURATION_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }], opacity: opacity.value }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const icon = variant === "success" ? "checkmark-circle" : variant === "error" ? "close-circle" : "information-circle";
  const tint = variant === "success" ? colors.positive : variant === "error" ? colors.negative : colors.brand;

  return (
    <Animated.View style={[styles.wrap, { bottom }, cardStyle]} pointerEvents="none">
      <View style={[styles.card, { backgroundColor: colors.backgroundElevated, borderColor: colors.glassBorderStrong }]}>
        <Ionicons name={icon} size={20} color={tint} />
        <View style={styles.textWrap}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {message && <ThemedText variant="subtle">{message}</ThemedText>}
        </View>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.glassBorder }]}>
        <Animated.View style={[styles.progressBar, { backgroundColor: tint }, barStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 100 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingRight: 18, borderRadius: radius.lg, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  textWrap: { flex: 1 },
  title: { fontWeight: "600" },
  progressTrack: { height: 2, borderRadius: 1, marginTop: 6, overflow: "hidden" },
  progressBar: { height: 2, borderRadius: radius.full },
});
