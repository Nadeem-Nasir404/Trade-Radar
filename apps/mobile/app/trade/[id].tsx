import { useMemo, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { ModalHeader } from "@/components/ui/modal-header";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { SectionErrorBoundary } from "@/components/ui/error-boundary";
import { PnlCard } from "@/components/trade/pnl-card";
import { CardActions } from "@/components/trade/card-actions";
import { CardStylePicker } from "@/components/trade/card-style-picker";
import { useTradesStore, pnlPct } from "@/lib/stores/trades-store";
import { useTheme } from "@/lib/use-theme";
import { radius, fonts } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatCompactPrice } from "@/lib/format";

export default function TradeDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  // Tablets and landscape phones: card on the left, details on the right.
  const wide = screenWidth >= 760;
  const cardWidth = wide ? 420 : Math.min(screenWidth - 40, 460);
  const { id } = useLocalSearchParams<{ id: string }>();
  const trade = useTradesStore((s) => s.trades.find((t) => t.id === id));
  const close = useTradesStore((s) => s.close);
  const remove = useTradesStore((s) => s.remove);
  const cardStyle = useTradesStore((s) => s.cardStyle);
  const setCardStyle = useTradesStore((s) => s.setCardStyle);

  // Trades started from an alert carry an instrument, so they get the same live price as the chart.
  // Hand-logged trades have no instrument, so the user types the current price for those.
  const live = useLivePrice(trade?.instrumentId || undefined);
  const cardRef = useRef<View>(null);
  const [current, setCurrent] = useState("");
  const typedPrice = useMemo(() => {
    const n = Number(current);
    return current.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
  }, [current]);
  const currentPrice = live.price ?? typedPrice;

  if (!trade) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <AmbientOrbs />
        <ModalHeader />
        <ThemedText variant="subtle" style={{ padding: 20 }}>This trade was removed.</ThemedText>
      </SafeAreaView>
    );
  }

  const isOpen = trade.closedAt === null;
  // Same price the card shows, so the picker offers artwork for the card's result.
  const cardPrice = trade.exitPrice ?? (isOpen ? currentPrice : null) ?? trade.entryPrice;
  const outcome = pnlPct(trade.side, trade.entryPrice, cardPrice) >= 0 ? "profit" : "loss";

  const endTrade = () => {
    if (currentPrice == null) return;
    haptics.medium();
    close(trade.id, currentPrice);
  };

  const confirmRemove = () => {
    Alert.alert("Delete this trade?", "It will be removed from your journal.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          remove(trade.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <ModalHeader title={trade.symbol} action={<IconButton icon="trash-outline" label="Delete trade" color={colors.negative} onPress={confirmRemove} />} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.body, wide && styles.bodyWide]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.cardColumn, { width: cardWidth }]}>
            <SectionErrorBoundary label="Trade card">
              <PnlCard ref={cardRef} trade={trade} livePrice={isOpen ? currentPrice : null} style={cardStyle} />
            </SectionErrorBoundary>

            <CardActions cardRef={cardRef} />
          </View>

          <View style={[styles.detailColumn, wide ? styles.detailColumnWide : { width: cardWidth }]}>
            <ThemedText variant="label" style={styles.pickerLabel}>
              CARD STYLE · TAP AGAIN TO SHUFFLE
            </ThemedText>
            <CardStylePicker value={cardStyle} onChange={setCardStyle} outcome={outcome} />

            <Surface style={styles.info}>
              <InfoRow label="Direction" value={trade.side} tone={trade.side === "LONG" ? colors.positive : colors.negative} />
              <InfoRow label="Entry" value={formatCompactPrice(trade.entryPrice)} />
              <InfoRow
                label={isOpen ? "Current" : "Exit"}
                value={isOpen ? (currentPrice != null ? formatCompactPrice(currentPrice) : "not set") : formatCompactPrice(trade.exitPrice)}
              />
              {trade.sizeUsd != null && <InfoRow label="Size" value={`$${trade.sizeUsd.toLocaleString("en-US")}`} />}
              <InfoRow label="Opened" value={new Date(trade.openedAt).toLocaleString()} />
              {trade.closedAt && <InfoRow label="Closed" value={new Date(trade.closedAt).toLocaleString()} />}
            </Surface>

            {isOpen && (
              <Surface style={styles.info}>
                <ThemedText variant="label">{live.price != null ? "CLOSE AT THE LIVE PRICE" : "CURRENT PRICE"}</ThemedText>
                {live.price == null && (
                  <View style={[styles.numRow, { borderColor: colors.glassBorder }]}>
                    <TextInput
                      value={current}
                      onChangeText={(v) => setCurrent(v.replace(/[^0-9.]/g, ""))}
                      placeholder="Type the price now"
                      placeholderTextColor={colors.foregroundMuted}
                      keyboardType="decimal-pad"
                      style={[styles.numInput, { color: colors.foreground }]}
                    />
                  </View>
                )}
                <Button title={`Close trade${currentPrice != null ? ` at ${formatCompactPrice(currentPrice)}` : ""}`} onPress={endTrade} disabled={currentPrice == null} />
              </Surface>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="subtle">{label}</ThemedText>
      <ThemedText style={[{ fontWeight: "600", flexShrink: 1, textAlign: "right" }, tone ? { color: tone } : null]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 20, gap: 16, paddingBottom: 40, alignItems: "center" },
  bodyWide: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 24 },
  cardColumn: { gap: 12 },
  detailColumn: { gap: 14 },
  detailColumnWide: { width: 380 },
  pickerLabel: { marginLeft: 4, fontSize: 11, letterSpacing: 1 },
  info: { padding: 16, gap: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  numRow: { height: 50, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
  numInput: { fontSize: 16, fontFamily: fonts.bodySemibold, padding: 0 },
});
