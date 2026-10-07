import { useMemo } from "react";
import { View, Pressable, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useTradesStore, pnlPct, type Trade } from "@/lib/stores/trades-store";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useTheme } from "@/lib/use-theme";
import { withAlpha } from "@/lib/color";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { formatCompactPrice } from "@/lib/format";
import { useMinuteClock } from "@/lib/hooks/use-minute-clock";

/** Content stays phone-width on tablets and large screens instead of stretching edge to edge. */
const MAX_CONTENT_WIDTH = 640;

export default function TradesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const trades = useTradesStore((s) => s.trades);

  const { open, closed, stats } = useMemo(() => {
    const openTrades = trades.filter((t) => t.closedAt === null);
    const closedTrades = trades.filter((t) => t.closedAt !== null);
    const results = closedTrades.map((t) => pnlPct(t.side, t.entryPrice, t.exitPrice as number));
    const realizedUsd = closedTrades.reduce((sum, t) => {
      if (t.sizeUsd == null) return sum;
      return sum + (t.sizeUsd * pnlPct(t.side, t.entryPrice, t.exitPrice as number)) / 100;
    }, 0);
    return {
      open: openTrades,
      closed: closedTrades,
      stats: {
        winRate: results.length ? (results.filter((r) => r > 0).length / results.length) * 100 : null,
        best: results.length ? Math.max(...results) : null,
        realizedUsd: closedTrades.some((t) => t.sizeUsd != null) ? realizedUsd : null,
      },
    };
  }, [trades]);

  const openDetail = (id: string) => {
    haptics.light();
    router.push({ pathname: "/trade/[id]", params: { id } });
  };
  const newTrade = () => {
    haptics.light();
    router.push("/new-trade");
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <View style={[styles.topBar, styles.centered, { width: Math.min(width, MAX_CONTENT_WIDTH) }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Back"
          style={[styles.iconBtn, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={newTrade} style={[styles.newBtn, { backgroundColor: colors.brand }]}>
          <Ionicons name="add" size={18} color={colors.brandForeground} />
          <ThemedText style={{ color: colors.brandForeground, fontWeight: "700" }}>New trade</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, styles.centered, { width: Math.min(width, MAX_CONTENT_WIDTH) }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="My trades" subtitle={`${open.length} open · ${closed.length} closed`} />

        {trades.length === 0 ? (
          <Surface style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: withAlpha(colors.brand, 0.14) }]}>
              <Ionicons name="journal-outline" size={26} color={colors.brand} />
            </View>
            <ThemedText style={styles.emptyTitle}>Your trade journal is empty</ThemedText>
            <ThemedText variant="subtle" style={styles.emptyText}>
              Log a trade to track its P&L live and turn it into a shareable card.
            </ThemedText>
            <Pressable onPress={newTrade} style={[styles.emptyCta, { backgroundColor: colors.brand }]}>
              <ThemedText style={{ color: colors.brandForeground, fontWeight: "700" }}>Log your first trade</ThemedText>
            </Pressable>
          </Surface>
        ) : (
          <>
            {closed.length > 0 && (
              <Surface style={styles.summary}>
                <SummaryStat
                  label="Realized"
                  value={stats.realizedUsd == null ? "--" : formatUsd(stats.realizedUsd)}
                  tone={stats.realizedUsd == null ? undefined : stats.realizedUsd >= 0 ? colors.positive : colors.negative}
                />
                <View style={[styles.summaryDivider, { backgroundColor: colors.glassBorder }]} />
                <SummaryStat label="Win rate" value={stats.winRate == null ? "--" : `${Math.round(stats.winRate)}%`} />
                <View style={[styles.summaryDivider, { backgroundColor: colors.glassBorder }]} />
                <SummaryStat
                  label="Best"
                  value={stats.best == null ? "--" : formatSignedPct(stats.best)}
                  tone={stats.best == null ? undefined : stats.best >= 0 ? colors.positive : colors.negative}
                />
              </Surface>
            )}

            {open.length > 0 && <SectionLabel>Open · {open.length}</SectionLabel>}
            {open.map((t) => (
              <TradeRow key={t.id} trade={t} onPress={() => openDetail(t.id)} />
            ))}
            {closed.length > 0 && <SectionLabel>Closed · {closed.length}</SectionLabel>}
            {closed.map((t) => (
              <TradeRow key={t.id} trade={t} onPress={() => openDetail(t.id)} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** One trade: side, symbol, entry -> exit (or live price), and P&L - live for open trades with a market feed. */
function TradeRow({ trade, onPress }: { trade: Trade; onPress: () => void }) {
  const { colors } = useTheme();
  const isOpen = trade.closedAt === null;
  // Only open trades started from a market have a live price; hand-logged ones show their entry.
  const live = useLivePrice(isOpen && trade.instrumentId ? trade.instrumentId : undefined);
  const price = isOpen ? live.price : trade.exitPrice;
  const pct = price != null ? pnlPct(trade.side, trade.entryPrice, price) : null;
  const usd = pct != null && trade.sizeUsd != null ? (trade.sizeUsd * pct) / 100 : null;
  const tone = pct == null ? colors.foregroundMuted : pct >= 0 ? colors.positive : colors.negative;
  const sideTone = trade.side === "LONG" ? colors.positive : colors.negative;
  const now = useMinuteClock(isOpen);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${trade.side} ${trade.symbol}`}>
      {({ pressed }) => (
        <Surface style={[styles.row, pressed && { opacity: 0.85 }]}>
          <View style={[styles.sidePill, { backgroundColor: withAlpha(sideTone, 0.14) }]}>
            <Ionicons name={trade.side === "LONG" ? "trending-up" : "trending-down"} size={14} color={sideTone} />
            <ThemedText style={[styles.sideText, { color: sideTone }]}>{trade.side}</ThemedText>
          </View>
          <View style={styles.rowText}>
            <ThemedText style={styles.symbol} numberOfLines={1}>
              {trade.symbol}
            </ThemedText>
            <ThemedText variant="subtle" numberOfLines={1}>
              {formatCompactPrice(trade.entryPrice)} → {price != null ? formatCompactPrice(price) : "open"}
              {` · ${formatHeld((trade.closedAt ?? now) - trade.openedAt)}`}
            </ThemedText>
          </View>
          <View style={styles.rowRight}>
            <ThemedText style={[styles.pct, { color: tone }]}>{pct == null ? "Open" : formatSignedPct(pct)}</ThemedText>
            {usd != null && <ThemedText style={[styles.usd, { color: tone }]}>{formatUsd(usd)}</ThemedText>}
            {isOpen && pct != null && (
              <View style={styles.liveRow}>
                <View style={[styles.liveDot, { backgroundColor: colors.positive }]} />
                <ThemedText variant="subtle" style={styles.liveText}>
                  Live
                </ThemedText>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.foregroundSubtle} />
        </Surface>
      )}
    </Pressable>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.summaryStat}>
      <ThemedText variant="subtle" style={styles.summaryLabel}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.summaryValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText variant="label" style={styles.section}>
      {String(children).toUpperCase()}
    </ThemedText>
  );
}

function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatUsd(usd: number): string {
  return `${usd >= 0 ? "+" : "-"}$${Math.abs(usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact duration: 45m, 3h 10m, 2d. */
function formatHeld(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignSelf: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 16, borderRadius: radius.full },
  body: { padding: 20, gap: 10, paddingBottom: 40 },
  section: { marginTop: 12, marginLeft: 4, fontSize: 11, letterSpacing: 1 },
  summary: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 8, marginTop: 4 },
  summaryStat: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 6 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 17, fontWeight: "800" },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  sidePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 28, borderRadius: radius.full },
  sideText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  symbol: { fontWeight: "700", fontSize: 16 },
  rowRight: { alignItems: "flex-end", gap: 1 },
  pct: { fontWeight: "800", fontSize: 16 },
  usd: { fontSize: 12, fontWeight: "600" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11 },
  empty: { padding: 28, alignItems: "center", gap: 10, marginTop: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontWeight: "700", fontSize: 17 },
  emptyText: { textAlign: "center", maxWidth: 300 },
  emptyCta: { marginTop: 6, height: 46, paddingHorizontal: 20, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
});
