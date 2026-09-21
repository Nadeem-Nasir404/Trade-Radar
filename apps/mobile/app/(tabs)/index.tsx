import { View, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { FadeInItem } from "@/components/ui/fade-in-item";
import { AlertRow } from "@/components/alerts/alert-row";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getGreeting } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { haptics } from "@/lib/haptics";
import { withAlpha } from "@/lib/color";
import type { Alert } from "@/lib/api/types";

export default function HomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { data: activeAlerts, isLoading } = useAlerts({ status: "ACTIVE" });
  const { data: recentAlerts } = useAlerts({ sort: "recent" });
  const triggeredCount = (recentAlerts ?? []).filter((a) => a.status === "TRIGGERED").length;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    setRefreshing(false);
  }, [queryClient]);

  const firstName = (user?.name || "Trader").split(" ")[0];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View pointerEvents="none" style={[styles.glowTop, { backgroundColor: colors.brandGlow }]} />
      <FlatList
        data={(recentAlerts ?? []).slice(0, 10)}
        keyExtractor={(item: Alert) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(320).easing(Easing.out(Easing.quad))} style={styles.header}>
            <View style={styles.greetingRow}>
              <View>
                <ThemedText variant="muted">{getGreeting()}</ThemedText>
                <ThemedText variant="title" style={styles.greetingName}>
                  {firstName}
                </ThemedText>
              </View>
              <SettingsButton />
            </View>

            <View style={styles.statsGrid}>
              <Stat icon="pulse" tint={colors.brand} label="Active Alerts" value={activeAlerts?.length ?? 0} />
              <Stat icon="checkmark-done" tint={colors.positive} label="Triggered" value={triggeredCount} />
            </View>

            <View style={styles.quickActions}>
              <Pressable
                style={styles.primaryActionWrap}
                onPress={() => {
                  haptics.light();
                  router.push("/create-alert");
                }}
              >
                <LinearGradient
                  colors={[colors.brand, colors.brandGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryAction}
                >
                  <Ionicons name="add" size={18} color={colors.brandForeground} />
                  <ThemedText style={[styles.actionText, { color: colors.brandForeground }]}>Create Alert</ThemedText>
                </LinearGradient>
              </Pressable>
              <Button
                variant="ghost"
                title="Browse Markets"
                icon={<Ionicons name="compass-outline" size={17} color={colors.foreground} />}
                onPress={() => router.push("/(tabs)/markets")}
                style={[styles.secondaryAction, { borderColor: colors.glassBorder }]}
              />
            </View>

            <View style={styles.sectionHeaderRow}>
              <ThemedText variant="label" style={styles.sectionLabel}>
                Recent alerts
              </ThemedText>
              {(recentAlerts?.length ?? 0) > 0 && (
                <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/alerts")}>
                  <ThemedText style={{ color: colors.brand, fontSize: 12, fontWeight: "600" }}>See all</ThemedText>
                </Pressable>
              )}
            </View>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <FadeInItem index={index}>
            <AlertRow alert={item} />
          </FadeInItem>
        )}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              icon="notifications-outline"
              title="Your first alert is waiting."
              description="Pick a market and set your level."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function SettingsButton() {
  const { colors } = useTheme();
  const rotate = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));

  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        haptics.light();
        rotate.value = withTiming(rotate.value + 15, { duration: 150, easing: Easing.out(Easing.quad) }, () => {
          rotate.value = withTiming(0, { duration: 150 });
        });
        router.push("/(tabs)/profile");
      }}
    >
      <Animated.View style={[styles.settingsButton, animatedStyle]}>
        <Ionicons name="settings-outline" size={20} color={colors.foreground} />
      </Animated.View>
    </Pressable>
  );
}

function Stat({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tint: string;
  label: string;
  value: number;
}) {
  const { colors } = useTheme();
  const animated = useCountUp(value);
  return (
    <Surface style={styles.stat}>
      <LinearGradient
        colors={[withAlpha(tint, 0.28), withAlpha(tint, 0.08)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statIcon}
      >
        <Ionicons name={icon} size={16} color={tint} />
      </LinearGradient>
      <ThemedText variant="title" style={styles.statValue}>
        {Math.round(animated)}
      </ThemedText>
      <ThemedText variant="subtle">{label}</ThemedText>
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  glowTop: {
    position: "absolute",
    top: -180,
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: radius.full,
    opacity: 0.22,
  },
  list: { paddingHorizontal: 20, paddingBottom: 110 },
  header: { gap: 24, marginBottom: 12, paddingTop: 4 },
  greetingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  settingsButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  greetingName: { fontSize: 30, marginTop: 2 },
  statsGrid: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, padding: 16, gap: 6 },
  statIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { fontSize: 26 },
  quickActions: { flexDirection: "row", gap: 10 },
  primaryActionWrap: { flex: 1, borderRadius: radius.md, overflow: "hidden" },
  primaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: radius.md },
  secondaryAction: { flex: 1, borderWidth: 1 },
  actionText: { fontSize: 14, fontWeight: "600" },
  sectionLabel: { marginTop: 4 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -8 },
});
