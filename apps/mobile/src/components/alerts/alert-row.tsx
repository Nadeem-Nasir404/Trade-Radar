import { useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, interpolate, type SharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Badge } from "@/components/ui/badge";
import { CoinLogo } from "@/components/coin-logo";
import { computeDistancePct, formatAlertTarget, formatConditionLabel, formatPct, formatTime, isUpwardCondition } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useDeleteAlert } from "@/lib/api/hooks/use-alerts";
import { useToastStore } from "@/lib/stores/toast-store";
import { haptics } from "@/lib/haptics";
import type { Alert } from "@/lib/api/types";

function statusBadgeVariant(status: string): "positive" | "warning" | "default" {
  switch (status) {
    case "ACTIVE":
      return "positive";
    case "PAUSED":
      return "warning";
    default:
      return "default";
  }
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

// Flat row + hairline divider, not a glass card - list rows stay at "Level 1" per the design
// system, reserving glass for genuinely elevated/floating surfaces elsewhere in the app.
export function AlertRow({ alert }: { alert: Alert }) {
  const { colors } = useTheme();
  const up = isUpwardCondition(alert.conditionType, alert.targetValue);
  const deleteAlert = useDeleteAlert();
  const showToast = useToastStore((s) => s.show);
  const swipeRef = useRef<SwipeableMethods>(null);

  const live = useLivePrice(alert.instrumentId, { price: alert.currentPrice, changePct24h: null });
  const price = live.price ?? alert.currentPrice;
  const distancePct = computeDistancePct(price, alert) ?? alert.distancePct;

  const handleDelete = () => {
    swipeRef.current?.close();
    haptics.success();
    deleteAlert.mutate(alert.id);
    showToast("Alert deleted", `${alert.symbol} ${formatConditionLabel(alert.conditionType)} alert removed`, "info");
  };

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={56}
      overshootRight={false}
      renderRightActions={(progress) => <DeleteAction progress={progress} onPress={handleDelete} />}
      onSwipeableWillOpen={() => haptics.warning()}
    >
      <PressableScale
        onPress={() => router.push({ pathname: "/(tabs)/markets/[symbol]", params: { symbol: alert.symbol.replace("/", "") } })}
      >
        <View style={[styles.row, { backgroundColor: colors.background, borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
          <CoinLogo uri={alert.iconUrl} symbol={alert.symbol} />
          <View style={styles.left}>
            <View style={styles.symbolRow}>
              <ThemedText numberOfLines={1} style={styles.symbol}>
                {alert.symbol}
              </ThemedText>
              {alert.notes && <Ionicons name="document-text-outline" size={12} color={colors.foregroundSubtle} />}
            </View>
            <ThemedText variant="subtle" numberOfLines={1}>
              {formatConditionLabel(alert.conditionType)}
              {alert.status === "TRIGGERED" && alert.lastTriggeredAt ? ` · ${formatTime(alert.lastTriggeredAt)}` : ""}
            </ThemedText>
          </View>
          <View style={styles.right}>
            <ThemedText variant="mono" numberOfLines={1} style={{ color: up ? colors.positive : colors.negative }}>
              {formatAlertTarget(alert)}
            </ThemedText>
            {alert.status === "ACTIVE" && distancePct !== null ? (
              <Badge label={formatPct(distancePct)} variant={distancePct >= 0 ? "positive" : "negative"} />
            ) : (
              <Badge label={statusLabel(alert.status)} variant={statusBadgeVariant(alert.status)} />
            )}
          </View>
        </View>
      </PressableScale>
    </Swipeable>
  );
}

/** iOS-style reveal-on-swipe delete panel, width-synced to the drag via the swipeable's own progress value. */
function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [64, 0]) }],
  }));

  return (
    <Animated.View style={[styles.deleteAction, { backgroundColor: colors.negative }, style]}>
      <Pressable onPress={onPress} style={styles.deleteActionInner} hitSlop={8}>
        <Ionicons name="trash-outline" size={19} color="#ffffff" />
        <ThemedText style={styles.deleteActionLabel}>Delete</ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  left: { flex: 1, minWidth: 0, gap: 3 },
  symbolRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  symbol: { fontWeight: "600" },
  right: { alignItems: "flex-end", gap: 2, flexShrink: 0 },
  deleteAction: { width: 64, alignItems: "stretch", justifyContent: "center" },
  deleteActionInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  deleteActionLabel: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
});
