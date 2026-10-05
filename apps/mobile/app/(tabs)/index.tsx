import { View, StyleSheet, FlatList, RefreshControl, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { FadeInItem } from "@/components/ui/fade-in-item";
import { AlertRow } from "@/components/alerts/alert-row";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { CoinLogo } from "@/components/coin-logo";
import { PriceText } from "@/components/ui/price-text";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getGreeting, formatPct } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { haptics } from "@/lib/haptics";
import type { Alert, Instrument } from "@/lib/api/types";

export default function HomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { data: activeAlerts, isLoading } = useAlerts({ status: "ACTIVE" });
  const { data: recentAlerts } = useAlerts({ sort: "recent" });
  const { data: markets } = useMarkets({ limit: 8 });
  const triggeredCount = (recentAlerts ?? []).filter((a) => a.status === "TRIGGERED").length;
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      queryClient.invalidateQueries({ queryKey: ["markets"] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const firstName = (user?.name || "Trader").split(" ")[0];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AmbientOrbs />
      <FlatList
        data={(recentAlerts ?? []).slice(0, 10)}
        keyExtractor={(item: Alert) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <Animated.View entering={FadeInDown.duration(300).easing(Easing.out(Easing.quad))} style={styles.header}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingText}>
                <ThemedText variant="muted" style={styles.greetingLabel}>
                  {getGreeting()}
                </ThemedText>
                <ThemedText variant="title" style={styles.greetingName}>
                  {firstName}
                </ThemedText>
                <View style={styles.liveRow}>
                  <View style={[styles.liveDot, { backgroundColor: colors.positive }]} />
                  <ThemedText style={[styles.liveText, { color: colors.foregroundMuted }]}>Live prices</ThemedText>
                </View>
              </View>
              <SettingsButton />
            </View>

            <Surface style={styles.summary}>
              <SummaryStat label="Active" value={activeAlerts?.length ?? 0} icon="pulse" tint={colors.brand} />
              <View style={[styles.summaryDivider, { backgroundColor: colors.glassBorder }]} />
              <SummaryStat label="Triggered" value={triggeredCount} icon="checkmark-done" tint={colors.positive} />
            </Surface>

            <Pressable
              style={styles.createWrap}
              onPress={() => {
                haptics.light();
                router.push("/create-alert");
              }}
            >
              <LinearGradient
                colors={[colors.brand, colors.brandGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createButton}
              >
                <Ionicons name="add" size={20} color={colors.brandForeground} />
                <ThemedText style={[styles.createText, { color: colors.brandForeground }]}>Create alert</ThemedText>
              </LinearGradient>
            </Pressable>

            {markets && markets.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <ThemedText style={styles.sectionTitle}>Markets</ThemedText>
                  <SeeAll onPress={() => router.push("/(tabs)/markets")} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketsScroll}>
                  {markets.map((m) => (
                    <MarketCard key={m.id} instrument={m} />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Recent alerts</ThemedText>
              {(recentAlerts?.length ?? 0) > 0 && <SeeAll onPress={() => router.push("/(tabs)/alerts")} />}
            </View>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <FadeInItem index={index}>
            <AlertRow alert={item} autoPeek={index === 0} />
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

function SeeAll({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable hitSlop={8} onPress={onPress} style={styles.seeAll}>
      <ThemedText style={[styles.seeAllText, { color: colors.brand }]}>See all</ThemedText>
      <Ionicons name="chevron-forward" size={14} color={colors.brand} />
    </Pressable>
  );
}

function MarketCard({ instrument }: { instrument: Instrument }) {
  const { colors } = useTheme();
  const positive = (instrument.changePct24h ?? 0) >= 0;
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        router.push({ pathname: "/(tabs)/markets/[symbol]", params: { symbol: instrument.symbol } });
      }}
    >
      <Surface style={styles.marketCard}>
        <View style={styles.marketCardTop}>
          <CoinLogo uri={instrument.iconUrl} symbol={instrument.displaySymbol} size={26} />
          <ThemedText style={styles.marketSymbol} numberOfLines={1}>
            {instrument.displaySymbol.split("/")[0]}
          </ThemedText>
        </View>
        <PriceText value={instrument.price} style={styles.marketPrice} />
        <ThemedText style={[styles.marketChange, { color: positive ? colors.positive : colors.negative }]}>
          {formatPct(instrument.changePct24h)}
        </ThemedText>
      </Surface>
    </Pressable>
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
      <Animated.View style={animatedStyle}>
        <Surface style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={20} color={colors.foreground} />
        </Surface>
      </Animated.View>
    </Pressable>
  );
}

function SummaryStat({
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
    <View style={styles.summaryStat}>
      <View style={[styles.summaryIcon, { backgroundColor: withTint(tint, 0.14) }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View>
        <ThemedText variant="title" style={styles.summaryValue}>
          {Math.round(animated)}
        </ThemedText>
        <ThemedText variant="subtle" style={{ color: colors.foregroundMuted }}>
          {label} alerts
        </ThemedText>
      </View>
    </View>
  );
}

function withTint(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 110 },
  header: { gap: 22, paddingTop: 8, marginBottom: 8 },
  greetingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greetingText: { gap: 2 },
  greetingLabel: { fontSize: 14 },
  greetingName: { fontSize: 30, lineHeight: 36 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: radius.full },
  liveText: { fontSize: 12 },
  settingsButton: { width: 44, height: 44, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  summary: { flexDirection: "row", alignItems: "center", paddingVertical: 18, paddingHorizontal: 18 },
  summaryStat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  summaryIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 24, lineHeight: 28 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36, marginHorizontal: 14 },
  createWrap: { borderRadius: radius.lg, overflow: "hidden" },
  createButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.lg,
  },
  createText: { fontSize: 15, fontWeight: "600" },
  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "600" },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: "600" },
  marketsScroll: { gap: 10, paddingRight: 4 },
  marketCard: { width: 132, padding: 14, gap: 6, borderRadius: radius.lg },
  marketCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  marketSymbol: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  marketPrice: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  marketChange: { fontSize: 12, fontWeight: "600" },
});
