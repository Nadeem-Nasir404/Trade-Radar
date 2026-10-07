import { useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, TextInput, Alert } from "react-native";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { saveCardToGallery } from "@/lib/save-card";
import { useToastStore } from "@/lib/stores/toast-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { SectionErrorBoundary } from "@/components/ui/error-boundary";
import { PnlCard, CARD_STYLE_LABELS } from "@/components/trade/pnl-card";
import { useTradesStore, type CardStyle } from "@/lib/stores/trades-store";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatCompactPrice } from "@/lib/format";

export default function TradeDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
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
  const showToast = useToastStore((s) => s.show);
  const [current, setCurrent] = useState("");
  const typedPrice = useMemo(() => {
    const n = Number(current);
    return current.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
  }, [current]);
  const currentPrice = live.price ?? typedPrice;

  const save = async () => {
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

  if (!trade) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <AmbientOrbs />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
          </Pressable>
        </View>
        <ThemedText variant="subtle" style={{ padding: 20 }}>This trade was removed.</ThemedText>
      </SafeAreaView>
    );
  }

  const isOpen = trade.closedAt === null;

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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Ionicons name="chevron-back" size={18} color={colors.foreground} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>{trade.symbol}</ThemedText>
        <Pressable onPress={confirmRemove} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Ionicons name="trash-outline" size={18} color={colors.negative} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.styleRow}>
          {(Object.keys(CARD_STYLE_LABELS) as CardStyle[]).map((st) => {
            const active = st === cardStyle;
            return (
              <Pressable
                key={st}
                onPress={() => {
                  haptics.selection();
                  setCardStyle(st);
                }}
                style={[styles.styleChip, { backgroundColor: active ? colors.brand : colors.glass, borderColor: colors.glassBorder }]}
              >
                <ThemedText style={{ color: active ? colors.brandForeground : colors.foregroundMuted, fontWeight: "600", fontSize: 12 }}>{CARD_STYLE_LABELS[st]}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <SectionErrorBoundary label="Trade card">
          <PnlCard ref={cardRef} trade={trade} livePrice={isOpen ? currentPrice : null} style={cardStyle} />
        </SectionErrorBoundary>

        <Pressable onPress={save} style={[styles.saveWrap, { borderColor: colors.glassBorder, backgroundColor: colors.glass }]}>
          <Ionicons name="download-outline" size={18} color={colors.foreground} />
          <ThemedText style={{ fontWeight: "700" }}>Save card to gallery</ThemedText>
        </Pressable>

        <Surface style={styles.info}>
          <InfoRow label="Direction" value={trade.side} />
          <InfoRow label="Entry" value={formatCompactPrice(trade.entryPrice)} />
          <InfoRow label={isOpen ? "Current" : "Exit"} value={isOpen ? (currentPrice != null ? formatCompactPrice(currentPrice) : "not set") : formatCompactPrice(trade.exitPrice)} />
          <InfoRow label="Opened" value={new Date(trade.openedAt).toLocaleString()} />
          {trade.closedAt && <InfoRow label="Closed" value={new Date(trade.closedAt).toLocaleString()} />}
        </Surface>

        {isOpen && (
          <Surface style={styles.info}>
            <ThemedText variant="label">CURRENT PRICE</ThemedText>
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
            <Pressable onPress={endTrade} disabled={currentPrice == null} style={[styles.closeWrap, { opacity: currentPrice == null ? 0.5 : 1 }]}>
              <LinearGradient colors={[colors.brand, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.close}>
                <ThemedText style={styles.closeText}>Close trade{currentPrice != null ? ` at ${formatCompactPrice(currentPrice)}` : ""}</ThemedText>
              </LinearGradient>
            </Pressable>
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText variant="subtle">{label}</ThemedText>
      <ThemedText style={{ fontWeight: "600" }}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  styleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleChip: { paddingHorizontal: 14, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  info: { padding: 16, gap: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  numRow: { height: 48, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
  numInput: { fontSize: 16, fontWeight: "600", padding: 0 },
  closeWrap: { borderRadius: radius.lg, overflow: "hidden" },
  close: { height: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.lg },
  closeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  saveWrap: { height: 50, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
