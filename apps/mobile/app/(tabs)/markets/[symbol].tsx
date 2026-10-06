import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PriceText } from "@/components/ui/price-text";
import { TradingChart, type TradingChartHandle, type DrawTool } from "@/components/charts/trading-chart";
import { ChartToolbar } from "@/components/charts/chart-toolbar";
import { PriceActionSheet } from "@/components/charts/price-action-sheet";
import { useMarket, useMarketHistory } from "@/lib/api/hooks/use-markets";
import { useAlerts, useDeleteAlert } from "@/lib/api/hooks/use-alerts";
import { useIsFavorite, useToggleFavorite } from "@/lib/api/hooks/use-watchlists";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { haptics } from "@/lib/haptics";
import { withAlpha } from "@/lib/color";
import {
  computeDistancePct,
  formatAlertTarget,
  formatCompactNumber,
  formatCompactPrice,
  formatConditionLabel,
  formatPct,
  isUpwardCondition,
} from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d"] as const;

export default function MarketDetailScreen() {
  const { colors } = useTheme();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const chartRef = useRef<TradingChartHandle>(null);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1h");
  const [drawMode, setDrawMode] = useState(false);
  const [drawStage, setDrawStage] = useState<"start" | "end">("start");
  const [drawTool, setDrawTool] = useState<DrawTool>("trend");

  const { data: instrument, isLoading } = useMarket(symbol);
  const { data: candles } = useMarketHistory(symbol, timeframe);
  const lastCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const { data: alerts } = useAlerts({ search: symbol });
  const deleteAlert = useDeleteAlert();
  const [tappedPrice, setTappedPrice] = useState<number | null>(null);

  useEffect(() => {
    setTappedPrice(null);
    setDrawMode(false);
  }, [symbol]);

  const live = useLivePrice(instrument?.id, { price: instrument?.price ?? null, changePct24h: instrument?.changePct24h ?? null });
  const price = live.price ?? instrument?.price ?? null;
  const changePct = live.changePct24h ?? instrument?.changePct24h ?? null;
  const positive = (changePct ?? 0) >= 0;

  const instrumentAlerts = (alerts ?? []).filter((a) => a.instrumentId === instrument?.id);
  const chartLevels = instrumentAlerts.map((a) => ({ price: a.targetValue, up: isUpwardCondition(a.conditionType, a.targetValue) }));

  const isFavorite = useIsFavorite(instrument?.id);
  const toggleFavorite = useToggleFavorite();

  if (isLoading || !instrument) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" title="Loading market..." description="" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <ThemedText variant="subtitle">{instrument.displaySymbol}</ThemedText>
        <Pressable
          hitSlop={12}
          onPress={() => {
            haptics.light();
            toggleFavorite.mutate(instrument.id);
          }}
        >
          <Ionicons name={isFavorite ? "star" : "star-outline"} size={22} color={isFavorite ? colors.warning : colors.foreground} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.badges}>
          {instrument.isDemo && <Badge label="Demo data" variant="warning" />}
          {live.feedStatus === "STALE" && <Badge label="Feed delayed" variant="negative" />}
        </View>

        <PriceText value={price} variant="title" style={styles.price} />
        <ThemedText style={{ color: positive ? colors.positive : colors.negative }}>{formatPct(changePct)}</ThemedText>

        <Surface
          style={styles.chartCard}
          onTouchStart={() => scrollRef.current?.setNativeProps({ scrollEnabled: false })}
          onTouchEnd={() => scrollRef.current?.setNativeProps({ scrollEnabled: true })}
          onTouchCancel={() => scrollRef.current?.setNativeProps({ scrollEnabled: true })}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentWrap} style={styles.segmentScroll}>
            <View style={[styles.segment, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              {TIMEFRAMES.map((tf) => {
                const active = tf === timeframe;
                return (
                  <Pressable
                    key={tf}
                    onPress={() => {
                      haptics.selection();
                      setTimeframe(tf);
                    }}
                    style={[styles.segmentItem, active && { backgroundColor: colors.brand }]}
                  >
                    <ThemedText
                      style={[styles.segmentText, { color: active ? colors.brandForeground : colors.foregroundMuted }]}
                    >
                      {tf}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {lastCandle && (
            <View style={styles.legend}>
              <LegendItem label="O" value={lastCandle.open} />
              <LegendItem label="H" value={lastCandle.high} />
              <LegendItem label="L" value={lastCandle.low} />
              <LegendItem label="C" value={lastCandle.close} tone={lastCandle.close >= lastCandle.open ? colors.positive : colors.negative} />
            </View>
          )}

          <TradingChart
            ref={chartRef}
            candles={candles ?? []}
            livePrice={price}
            alertLevels={chartLevels}
            drawMode={drawMode}
            onDrawStage={setDrawStage}
            timeframe={timeframe}
            drawTool={drawTool}
            drawingsKey={symbol}
            viewKey={`${symbol}|${timeframe}`}
            onPriceTap={(p) => {
              haptics.light();
              setTappedPrice(p);
            }}
          />

          {drawMode && (
            <View style={[styles.drawHint, { backgroundColor: withAlpha(colors.brand, 0.12) }]}>
              <Ionicons name="hand-left-outline" size={14} color={colors.brand} />
              <ThemedText style={[styles.drawHintText, { color: colors.brand }]}>
                {drawStage === "start" ? "Tap a point to start your line" : "Tap a second point to finish"}
              </ThemedText>
            </View>
          )}

          <ChartToolbar
            drawMode={drawMode}
            drawTool={drawTool}
            onToggleDraw={() => {
              haptics.selection();
              setDrawStage("start");
              setDrawMode((v) => !v);
            }}
            onSelectTool={setDrawTool}
            onClear={() => {
              haptics.light();
              chartRef.current?.clearDrawings();
              setDrawStage("start");
            }}
            trailing={
              <Pressable
                hitSlop={8}
                onPress={() => {
                  haptics.medium();
                  router.push({ pathname: "/fullscreen-chart", params: { symbol, displaySymbol: instrument.displaySymbol, timeframe } });
                }}
                style={[styles.fullscreenPill, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
              >
                <Ionicons name="expand-outline" size={16} color={colors.foregroundMuted} />
              </Pressable>
            }
          />


        </Surface>

        <PriceActionSheet price={tappedPrice} displaySymbol={instrument.displaySymbol} symbol={symbol} instrumentId={instrument.id} onClose={() => setTappedPrice(null)} />

        <Surface style={styles.statsCard}>
          <Stat label="24h High" value={formatCompactPrice(instrument.high24h)} />
          <View style={[styles.statDivider, { backgroundColor: colors.glassBorder }]} />
          <Stat label="24h Low" value={formatCompactPrice(instrument.low24h)} />
          <View style={[styles.statDivider, { backgroundColor: colors.glassBorder }]} />
          <Stat label="24h Volume" value={instrument.volume24h != null ? `$${formatCompactNumber(instrument.volume24h)}` : "--"} />
        </Surface>

        <Button
          title="Create Alert"
          onPress={() =>
            router.push({
              pathname: "/create-alert",
              params: { instrumentId: instrument.id, symbol: instrument.displaySymbol, price: String(price ?? 0) },
            })
          }
          style={styles.createButton}
        />

        <ThemedText variant="label" style={styles.sectionLabel}>
          Your Alerts
        </ThemedText>
        {instrumentAlerts.length === 0 ? (
          <EmptyState icon="notifications-outline" title="No alerts on this market yet" description="Tap Create Alert above to set your first level." />
        ) : (
          <View style={{ gap: 8 }}>
            {instrumentAlerts.map((alert) => {
              const up = isUpwardCondition(alert.conditionType, alert.targetValue);
              const distancePct = computeDistancePct(price, alert) ?? alert.distancePct;
              return (
                <Surface key={alert.id} style={styles.alertRow}>
                  <View style={styles.alertLeft}>
                    <Ionicons name={up ? "arrow-up" : "arrow-down"} size={14} color={up ? colors.positive : colors.negative} />
                    <ThemedText variant="mono">{formatAlertTarget(alert)}</ThemedText>
                  </View>
                  <View style={styles.alertRight}>
                    <ThemedText variant="subtle">{formatConditionLabel(alert.conditionType)}</ThemedText>
                    {distancePct !== null && (
                      <ThemedText variant="subtle" style={{ color: distancePct >= 0 ? colors.positive : colors.negative }}>
                        {formatPct(distancePct)}
                      </ThemedText>
                    )}
                  </View>
                  <Pressable
                    hitSlop={10}
                    style={styles.alertDelete}
                    onPress={() =>
                      RNAlert.alert(
                        "Delete alert?",
                        `This permanently removes the ${formatConditionLabel(alert.conditionType)} ${formatAlertTarget(alert)} alert.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Delete", style: "destructive", onPress: () => deleteAlert.mutate(alert.id) },
                        ],
                      )
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.foregroundSubtle} />
                  </Pressable>
                </Surface>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendItem({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <ThemedText style={[styles.legendLabel, { color: colors.foregroundSubtle }]}>{label}</ThemedText>
      <ThemedText variant="mono" style={[styles.legendValue, { color: tone ?? colors.foreground }]}>
        {formatCompactPrice(value)}
      </ThemedText>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText variant="subtle">{label}</ThemedText>
      <ThemedText variant="mono" style={styles.statValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: { padding: 16, paddingBottom: 110, gap: 4 },
  badges: { flexDirection: "row", gap: 8, marginBottom: 8 },
  price: { fontSize: 30 },
  chartCard: { marginTop: 20, padding: 12 },
  tapPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tapPillText: { flex: 1, fontSize: 13 },
  tapPillButton: { width: 26, height: 26, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  chartToolbar: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  toolSpacer: { flex: 1 },
  fullscreenPill: { width: 30, height: 30, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  drawHint: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, marginBottom: 8 },
  drawHintText: { fontSize: 12, fontWeight: "600" },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  toolButtonText: { fontSize: 12, fontWeight: "600" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8, paddingHorizontal: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendLabel: { fontSize: 11, fontWeight: "600" },
  legendValue: { fontSize: 12 },
  segmentScroll: { marginBottom: 12, flexGrow: 0 },
  segmentWrap: { paddingRight: 4 },
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 2,
  },
  segmentItem: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignItems: "center",
  },
  segmentText: { fontSize: 12, fontWeight: "600" },
  statsCard: { flexDirection: "row", marginTop: 16, paddingVertical: 14, paddingHorizontal: 4 },
  stat: { flex: 1, paddingHorizontal: 10, gap: 6, alignItems: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  statValue: { fontSize: 14, fontWeight: "600" },
  createButton: { marginTop: 20 },
  sectionLabel: { marginTop: 28, marginBottom: 10 },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    gap: 8,
  },
  alertLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertRight: { alignItems: "flex-end", gap: 2 },
  alertDelete: { paddingLeft: 4, paddingVertical: 4 },
});
