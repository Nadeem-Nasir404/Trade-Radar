import { useRef, useState } from "react";
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { TradingChart, type TradingChartHandle } from "@/components/charts/trading-chart";
import { PriceText } from "@/components/ui/price-text";
import { useMarket, useMarketHistory } from "@/lib/api/hooks/use-markets";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatPct } from "@/lib/format";

const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d"] as const;

export default function FullscreenChartScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ symbol: string; displaySymbol?: string; timeframe?: string }>();
  const symbol = params.symbol;
  const initialTf = (TIMEFRAMES as readonly string[]).includes(params.timeframe ?? "") ? params.timeframe! : "1h";

  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>(initialTf as (typeof TIMEFRAMES)[number]);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStage, setDrawStage] = useState<"start" | "end">("start");
  const chartRef = useRef<TradingChartHandle>(null);

  const { data: instrument } = useMarket(symbol);
  const { data: candles } = useMarketHistory(symbol, timeframe);
  const live = useLivePrice(instrument?.id, { price: instrument?.price ?? null, changePct24h: instrument?.changePct24h ?? null });
  const price = live.price ?? instrument?.price ?? null;
  const changePct = live.changePct24h ?? instrument?.changePct24h ?? null;
  const positive = (changePct ?? 0) >= 0;

  const chartHeight = height - 190;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.glass }]}>
          <Ionicons name="close" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.symbol}>{params.displaySymbol ?? instrument?.displaySymbol ?? ""}</ThemedText>
          <ThemedText style={{ color: positive ? colors.positive : colors.negative, fontSize: 12, fontWeight: "600" }}>
            {formatPct(changePct)}
          </ThemedText>
        </View>
        <View style={styles.iconButton}>
          <PriceText value={price} variant="mono" style={styles.headerPrice} />
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
          livePrice={price}
          drawMode={drawMode}
          onDrawStage={setDrawStage}
          timeframe={timeframe}
        />
      </View>

      <View style={styles.footer}>
        {drawMode ? (
          <ThemedText style={[styles.hint, { color: colors.brand }]}>
            {drawStage === "start" ? "Tap a point to start your line" : "Tap a second point to finish"}
          </ThemedText>
        ) : (
          <ThemedText variant="subtle" style={styles.hint}>
            Hold a price level to set an alert
          </ThemedText>
        )}
        <View style={styles.footerButtons}>
          <Pressable
            onPress={() => {
              haptics.selection();
              setDrawStage("start");
              setDrawMode((v) => !v);
            }}
            style={[
              styles.footerButton,
              { backgroundColor: colors.glass, borderColor: colors.glassBorder },
              drawMode && { backgroundColor: colors.brandGlow, borderColor: colors.brand },
            ]}
          >
            <Ionicons name="pencil-outline" size={16} color={drawMode ? colors.brand : colors.foregroundMuted} />
            <ThemedText style={[styles.footerButtonText, { color: drawMode ? colors.brand : colors.foregroundMuted }]}>
              {drawMode ? "Drawing" : "Draw"}
            </ThemedText>
          </Pressable>
          {drawMode && (
            <Pressable
              onPress={() => {
                haptics.light();
                chartRef.current?.clearDrawings();
                setDrawStage("start");
              }}
              style={[styles.footerButton, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.foregroundMuted} />
              <ThemedText style={[styles.footerButtonText, { color: colors.foregroundMuted }]}>Clear</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  headerCenter: { alignItems: "center", gap: 2 },
  iconButton: { minWidth: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  symbol: { fontSize: 16, fontWeight: "600" },
  headerPrice: { fontSize: 14 },
  tfScroll: { flexGrow: 0, marginBottom: 8 },
  tfRow: { paddingHorizontal: 16 },
  segment: { flexDirection: "row", padding: 3, borderRadius: radius.full, borderWidth: 1, gap: 2 },
  segmentItem: { minWidth: 44, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, alignItems: "center" },
  segmentText: { fontSize: 12, fontWeight: "600" },
  chartWrap: { paddingHorizontal: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  hint: { textAlign: "center", fontSize: 12 },
  footerButtons: { flexDirection: "row", justifyContent: "center", gap: 10 },
  footerButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 40, borderRadius: radius.full, borderWidth: 1 },
  footerButtonText: { fontSize: 13, fontWeight: "600" },
});
