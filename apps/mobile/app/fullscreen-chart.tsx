import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { Instrument } from "@/lib/api/types";
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconButton } from "@/components/ui/icon-button";
import { ThemedText } from "@/components/ui/themed-text";
import { TradingChart, type TradingChartHandle, type DrawTool } from "@/components/charts/trading-chart";
import { ChartToolbar } from "@/components/charts/chart-toolbar";
import { PriceActionSheet } from "@/components/charts/price-action-sheet";
import { PriceText } from "@/components/ui/price-text";
import { useMarket, useMarketHistory } from "@/lib/api/hooks/use-markets";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useChartAlerts } from "@/lib/hooks/use-chart-alerts";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatPct } from "@/lib/format";

const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

export default function FullscreenChartScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ symbol: string; displaySymbol?: string; timeframe?: string }>();
  const symbol = params.symbol;
  const initialTf: Timeframe = (TIMEFRAMES as readonly string[]).includes(params.timeframe ?? "") ? (params.timeframe as Timeframe) : "1h";

  const [timeframe, setTimeframe] = useState<Timeframe>(initialTf);
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("trend");
  const [drawStage, setDrawStage] = useState<"start" | "end">("start");
  const chartRef = useRef<TradingChartHandle>(null);
  const [tappedPrice, setTappedPrice] = useState<number | null>(null);

  const { data: instrument } = useMarket(symbol);
  const { data: candles, isLoading: historyLoading, isError: historyFailed } = useMarketHistory(symbol, timeframe);
  const { data: alerts } = useAlerts({ search: symbol });
  const { levels: alertLevels, onAlertMove, onAlertDelete } = useChartAlerts(instrument, alerts);
  // Price and change render in their own small components, so live updates don't re-render the screen.
  const queryClient = useQueryClient();
  const refetchHistory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.marketHistory(symbol, timeframe) });
  }, [queryClient, symbol, timeframe]);

  const chartHeight = height - 230;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <View style={styles.headerCenter}>
          <ThemedText style={styles.symbol}>{params.displaySymbol ?? instrument?.displaySymbol ?? ""}</ThemedText>
          <LiveChange instrument={instrument} />
        </View>
        <View style={styles.iconButton}>
          <LivePrice instrument={instrument} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tfRow} style={styles.tfScroll}>
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
                <ThemedText style={[styles.segmentText, { color: active ? colors.brandForeground : colors.foregroundMuted }]}>{tf}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.chartWrap}>
        <TradingChart
          ref={chartRef}
          height={chartHeight}
          candles={candles ?? []}
          instrumentId={instrument?.id}
          onBarClose={refetchHistory}
          watermark={`${params.displaySymbol ?? instrument?.displaySymbol ?? symbol} · ${timeframe}`}
          loading={historyLoading}
          failed={historyFailed}
          timeframe={timeframe}
          viewKey={`${symbol}|${timeframe}`}
          drawMode={drawMode}
          drawTool={drawTool}
          drawingsKey={symbol}
          onPriceTap={setTappedPrice}
          alertLevels={alertLevels}
          onAlertMove={onAlertMove}
          onAlertDelete={onAlertDelete}
          onDrawStage={setDrawStage}
        />
      </View>

      <PriceActionSheet
        price={tappedPrice}
        displaySymbol={params.displaySymbol ?? instrument?.displaySymbol ?? symbol}
        symbol={symbol}
        instrumentId={instrument?.id ?? ""}
        onClose={() => setTappedPrice(null)}
      />

      <View style={styles.footer}>
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
        />
        <ThemedText variant="subtle" style={[styles.hint, drawMode && { color: colors.brand }]}>
          {drawMode
            ? drawStage === "start" ? "Tap a point to start your drawing" : "Tap a second point to finish"
            : "Hold a price level to set an alert"}
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  headerCenter: { alignItems: "center", gap: 2 },
  iconButton: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  symbol: { fontSize: 16, fontWeight: "600" },
  headerPrice: { fontSize: 14 },
  tfScroll: { flexGrow: 0, marginBottom: 8 },
  tfRow: { paddingHorizontal: 16 },
  segment: { flexDirection: "row", padding: 3, borderRadius: radius.full, borderWidth: 1, gap: 2 },
  segmentItem: { minWidth: 44, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, alignItems: "center" },
  segmentText: { fontSize: 12, fontWeight: "600" },
  chartWrap: { paddingHorizontal: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  hint: { textAlign: "center", fontSize: 12 },
});

function LiveChange({ instrument }: { instrument: Instrument | undefined }) {
  const { colors } = useTheme();
  const live = useLivePrice(instrument?.id, { price: instrument?.price ?? null, changePct24h: instrument?.changePct24h ?? null });
  const changePct = live.changePct24h ?? instrument?.changePct24h ?? null;
  return (
    <ThemedText style={{ color: (changePct ?? 0) >= 0 ? colors.positive : colors.negative, fontSize: 12, fontWeight: "600" }}>
      {formatPct(changePct)}
    </ThemedText>
  );
}

function LivePrice({ instrument }: { instrument: Instrument | undefined }) {
  const live = useLivePrice(instrument?.id, { price: instrument?.price ?? null, changePct24h: instrument?.changePct24h ?? null });
  return <PriceText value={live.price ?? instrument?.price ?? null} variant="mono" style={styles.headerPrice} />;
}
