import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { Instrument } from "@/lib/api/types";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconButton } from "@/components/ui/icon-button";
import { ThemedText } from "@/components/ui/themed-text";
import { TradingChart, type TradingChartHandle, type DrawTool } from "@/components/charts/trading-chart";
import { ChartToolRail, ShowToolsButton } from "@/components/charts/chart-toolbar";
import { useChartSettings } from "@/lib/stores/chart-settings-store";
import { TimeframeBar, TIMEFRAMES, type ChartTimeframe } from "@/components/charts/timeframe-bar";
import { PriceActionSheet } from "@/components/charts/price-action-sheet";
import { PriceText } from "@/components/ui/price-text";
import { useMarket, useMarketHistory } from "@/lib/api/hooks/use-markets";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useChartAlerts } from "@/lib/hooks/use-chart-alerts";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useTheme } from "@/lib/use-theme";
import { formatPct } from "@/lib/format";

type Timeframe = ChartTimeframe;

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
  const showTools = useChartSettings((s) => s.showTools);
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

  // The tools moved into the side rail, so the chart takes the space the bottom toolbar used.
  const chartHeight = height - 190;

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

      <TimeframeBar value={timeframe} onChange={setTimeframe} style={styles.tfBar} />

      <View style={[styles.chartWrap, { height: chartHeight }]}>
        {showTools && (
        <ChartToolRail
          drawMode={drawMode}
          drawTool={drawTool}
          onSelectCursor={() => setDrawMode(false)}
          onSelectTool={(tool) => {
            setDrawTool(tool);
            setDrawStage("start");
            setDrawMode(true);
          }}
          onUndo={() => chartRef.current?.undoDrawing()}
          onClear={() => {
            chartRef.current?.clearDrawings();
            setDrawStage("start");
          }}
        />
        )}
        <View style={styles.flex}>
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
          onDrawDone={() => setDrawMode(false)}
        />
        {!showTools && <ShowToolsButton />}
        </View>
      </View>

      <PriceActionSheet
        price={tappedPrice}
        displaySymbol={params.displaySymbol ?? instrument?.displaySymbol ?? symbol}
        symbol={symbol}
        instrumentId={instrument?.id ?? ""}
        onClose={() => setTappedPrice(null)}
      />

      <View style={styles.footer}>
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
  tfBar: { marginHorizontal: 16, marginBottom: 8 },
  chartWrap: { flexDirection: "row", gap: 6, paddingHorizontal: 8 },
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
