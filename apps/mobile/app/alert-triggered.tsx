import { useMemo } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { Icon3D } from "@/components/ui/icon-3d";
import { PnlCard } from "@/components/trade/pnl-card";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useTradesStore, type TradeSide } from "@/lib/stores/trades-store";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatCompactPrice } from "@/lib/format";

const CONDITION_TEXT: Record<string, string> = {
  CROSSES_ABOVE: "crossed above",
  CROSSES_BELOW: "crossed below",
  ABOVE: "is above",
  BELOW: "is below",
  EQUALS: "hit",
  PCT_CHANGE: "moved",
  ENTERS_RANGE: "entered your range",
  EXITS_RANGE: "exited your range",
};

export default function AlertTriggeredScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ symbol: string; instrumentId?: string; price?: string; condition?: string; target?: string }>();
  const symbol = params.symbol ?? "";
  const instrumentId = params.instrumentId ?? "";
  const triggerPrice = params.price ? Number(params.price) : null;
  const target = params.target ? Number(params.target) : null;

  const live = useLivePrice(instrumentId || undefined, { price: triggerPrice, changePct24h: null });
  const price = live.price ?? triggerPrice;

  const trades = useTradesStore((s) => s.trades);
  const open = useTradesStore((s) => s.open);
  const close = useTradesStore((s) => s.close);
  const activeTrade = useMemo(() => trades.find((t) => t.symbol === symbol && t.closedAt === null), [trades, symbol]);

  const start = (side: TradeSide) => {
    haptics.success();
    open({ symbol, instrumentId, side, entryPrice: price ?? 0 });
  };

  const endTrade = () => {
    if (!activeTrade || price == null) return;
    haptics.medium();
    close(activeTrade.id, price);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Ionicons name="close" size={18} color={colors.foreground} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>{activeTrade ? "Your trade" : "Alert hit"}</ThemedText>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {activeTrade ? (
          <>
            <PnlCard trade={activeTrade} livePrice={price} />
            <Pressable onPress={endTrade} style={styles.primaryWrap}>
              <LinearGradient colors={[colors.brand, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
                <Ionicons name="stop-circle-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.primaryText}>Close trade at {formatCompactPrice(price ?? activeTrade.entryPrice)}</ThemedText>
              </LinearGradient>
            </Pressable>
          </>
        ) : (
          <>
            <Surface style={styles.hero}>
              <Icon3D icon="notifications" color={colors.brand} size={72} />
              <ThemedText variant="subtle" style={styles.symbolLine}>
                {symbol}
              </ThemedText>
              <ThemedText style={styles.headline}>
                {symbol} {CONDITION_TEXT[params.condition ?? ""] ?? "reached"} {target != null ? formatCompactPrice(target) : ""}
              </ThemedText>
              <ThemedText style={[styles.bigPrice, { color: colors.foreground }]}>{price != null ? formatCompactPrice(price) : "--"}</ThemedText>
              <ThemedText variant="subtle">Live price right now</ThemedText>
            </Surface>

            <ThemedText variant="label" style={styles.question}>
              WHAT DO YOU DO NEXT?
            </ThemedText>

            <Pressable onPress={() => start("LONG")} style={styles.choiceWrap}>
              <LinearGradient colors={["#16A34A", "#0F7A36"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.choice}>
                <Ionicons name="trending-up" size={22} color="#FFFFFF" />
                <View style={styles.choiceText}>
                  <ThemedText style={styles.choiceTitle}>Go long</ThemedText>
                  <ThemedText style={styles.choiceSub}>Bet the price keeps rising</ThemedText>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => start("SHORT")} style={styles.choiceWrap}>
              <LinearGradient colors={["#F43F5E", "#B91C3C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.choice}>
                <Ionicons name="trending-down" size={22} color="#FFFFFF" />
                <View style={styles.choiceText}>
                  <ThemedText style={styles.choiceTitle}>Go short</ThemedText>
                  <ThemedText style={styles.choiceSub}>Bet the price falls</ThemedText>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => {
                haptics.light();
                router.replace({ pathname: "/(tabs)/markets/[symbol]", params: { symbol } });
              }}
              style={[styles.thinking, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
            >
              <Ionicons name="time-outline" size={18} color={colors.foregroundMuted} />
              <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "600" }}>Still thinking, show me the chart</ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  spacer: { width: 40 },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 22, alignItems: "center", gap: 8 },
  symbolLine: { marginTop: 12, letterSpacing: 1 },
  headline: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  bigPrice: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  question: { marginTop: 8, fontSize: 11, letterSpacing: 1 },
  choiceWrap: { borderRadius: radius.xl, overflow: "hidden" },
  choice: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.xl },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  choiceSub: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  thinking: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: radius.lg, borderWidth: 1 },
  primaryWrap: { borderRadius: radius.lg, overflow: "hidden" },
  primary: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.lg },
  primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});
