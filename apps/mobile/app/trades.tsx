import { useMemo } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useTradesStore, pnlPct } from "@/lib/stores/trades-store";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatCompactPrice } from "@/lib/format";

export default function TradesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const trades = useTradesStore((s) => s.trades);

  const { open, closed } = useMemo(
    () => ({
      open: trades.filter((t) => t.closedAt === null),
      closed: trades.filter((t) => t.closedAt !== null),
    }),
    [trades],
  );

  const openDetail = (id: string) => {
    haptics.light();
    router.push({ pathname: "/trade/[id]", params: { id } });
  };

  const renderRow = (t: (typeof trades)[number]) => {
    const pct = t.exitPrice != null ? pnlPct(t.side, t.entryPrice, t.exitPrice) : null;
    const tone = pct == null ? colors.foregroundMuted : pct >= 0 ? colors.positive : colors.negative;
    return (
      <Pressable key={t.id} onPress={() => openDetail(t.id)}>
        <Surface style={styles.row}>
          <View style={styles.rowText}>
            <ThemedText style={styles.symbol}>{t.symbol}</ThemedText>
            <ThemedText variant="subtle">
              {t.side} · entry {formatCompactPrice(t.entryPrice)}
              {t.exitPrice != null ? ` · exit ${formatCompactPrice(t.exitPrice)}` : " · open"}
            </ThemedText>
          </View>
          <ThemedText style={[styles.pct, { color: tone }]}>
            {pct == null ? "Open" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={colors.foregroundMuted} />
        </Surface>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.iconBtn, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/new-trade")}
          style={[styles.newBtn, { backgroundColor: colors.brand }]}
        >
          <Ionicons name="add" size={18} color={colors.brandForeground} />
          <ThemedText style={{ color: colors.brandForeground, fontWeight: "700" }}>New trade</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Trades" subtitle={`${open.length} open · ${closed.length} closed`} />

        {trades.length === 0 ? (
          <Surface style={styles.empty}>
            <ThemedText style={{ fontWeight: "700" }}>No trades yet</ThemedText>
            <ThemedText variant="subtle" style={{ textAlign: "center" }}>
              Start one from an alert hit, or log a trade you already made.
            </ThemedText>
          </Surface>
        ) : (
          <>
            {open.length > 0 && <ThemedText variant="label" style={styles.section}>OPEN</ThemedText>}
            {open.map(renderRow)}
            {closed.length > 0 && <ThemedText variant="label" style={styles.section}>CLOSED</ThemedText>}
            {closed.map(renderRow)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 14, borderRadius: radius.full },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  section: { marginTop: 8, fontSize: 11, letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowText: { flex: 1, gap: 2 },
  symbol: { fontWeight: "700", fontSize: 16 },
  pct: { fontWeight: "800", fontSize: 16 },
  empty: { padding: 24, alignItems: "center", gap: 8 },
});
