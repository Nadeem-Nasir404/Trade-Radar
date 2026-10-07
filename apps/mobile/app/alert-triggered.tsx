import { useMemo, useRef, useState } from "react";
import { saveCardToGallery } from "@/lib/save-card";
import { View, Pressable, StyleSheet, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { Icon3D } from "@/components/ui/icon-3d";
import { ModalHeader } from "@/components/ui/modal-header";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { PnlCard } from "@/components/trade/pnl-card";
import { CardStylePicker } from "@/components/trade/card-style-picker";
import { SectionErrorBoundary } from "@/components/ui/error-boundary";
import { useToastStore } from "@/lib/stores/toast-store";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useTradesStore, pnlPct, type TradeSide } from "@/lib/stores/trades-store";
import { useTheme } from "@/lib/use-theme";
import { radius, fonts } from "@/lib/theme";
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
  const cardStyle = useTradesStore((s) => s.cardStyle);
  const setCardStyle = useTradesStore((s) => s.setCardStyle);
  const activeTrade = useMemo(() => trades.find((t) => t.symbol === symbol && t.closedAt === null), [trades, symbol]);

  const [amount, setAmount] = useState("");

  const showToast = useToastStore((s) => s.show);
  const cardRef = useRef<View>(null);

  const saveCard = async () => {
    if (!cardRef.current) return;
    try {
      const result = await saveCardToGallery(cardRef.current);
      if (result === "saved") {
        haptics.success();
        showToast("Saved to gallery", "Find the card in your Photos app", "success");
      } else {
        showToast("Permission needed", "Allow photo access to save the card", "error");
      }
    } catch (err) {
      console.error("[save card]", err);
      showToast("Could not save the card", (err as Error).message, "error");
    }
  };

  const start = (side: TradeSide) => {
    try {
      haptics.success();
      const size = Number(amount);
      open({ symbol, instrumentId, side, entryPrice: price ?? 0, sizeUsd: size > 0 ? size : null });
    } catch (err) {
      console.error("[start trade]", err);
      showToast("Could not start the trade", (err as Error).message, "error");
    }
  };

  const endTrade = () => {
    if (!activeTrade || price == null) return;
    haptics.medium();
    close(activeTrade.id, price);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <ModalHeader
        kind="close"
        title={activeTrade ? "Your trade" : "Alert hit"}
        action={<IconButton icon="journal-outline" label="My trades" onPress={() => router.push("/trades")} />}
      />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {activeTrade ? (
          <>
            <CardStylePicker
              value={cardStyle}
              onChange={setCardStyle}
              outcome={pnlPct(activeTrade.side, activeTrade.entryPrice, activeTrade.exitPrice ?? price ?? activeTrade.entryPrice) >= 0 ? "profit" : "loss"}
            />
            <SectionErrorBoundary label="Trade card">
              <PnlCard ref={cardRef} trade={activeTrade} livePrice={price} style={cardStyle} />
            </SectionErrorBoundary>
            <Button title="Save card to gallery" variant="glass" icon={<Ionicons name="download-outline" size={18} color={colors.foreground} />} onPress={saveCard} />
            <Button
              title={`Close trade at ${formatCompactPrice(price ?? activeTrade.entryPrice)}`}
              icon={<Ionicons name="stop-circle-outline" size={18} color={colors.brandForeground} />}
              onPress={endTrade}
            />
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
              POSITION SIZE (OPTIONAL)
            </ThemedText>
            <View style={[styles.amountRow, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "700", fontSize: 18 }}>$</ThemedText>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 1000"
                placeholderTextColor={colors.foregroundMuted}
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: colors.foreground }]}
              />
            </View>

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
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 22, alignItems: "center", gap: 8 },
  symbolLine: { marginTop: 12, letterSpacing: 1 },
  headline: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  bigPrice: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  question: { marginTop: 8, fontSize: 11, letterSpacing: 1 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 50, paddingHorizontal: 16, borderRadius: radius.lg, borderWidth: 1 },
  amountInput: { flex: 1, fontSize: 17, fontFamily: fonts.bodySemibold, padding: 0 },
  choiceWrap: { borderRadius: radius.xl, overflow: "hidden" },
  choice: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: radius.xl },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  choiceSub: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  thinking: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: radius.lg, borderWidth: 1 },
});
