import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { formatCompactPrice } from "@/lib/format";
import { pnlPct, type Trade } from "@/lib/stores/trades-store";

/** Shareable P&L card: big return, side pill, entry and exit, over a soft dotted brand backdrop. */
export function PnlCard({ trade, livePrice }: { trade: Trade; livePrice: number | null }) {
  const { colors } = useTheme();
  const closed = trade.exitPrice != null;
  const current = closed ? (trade.exitPrice as number) : livePrice ?? trade.entryPrice;
  const pct = pnlPct(trade.side, trade.entryPrice, current);
  const positive = pct >= 0;
  const tone = positive ? "#22C55E" : "#F43F5E";
  const sideColor = trade.side === "LONG" ? "#22C55E" : "#F43F5E";

  return (
    <LinearGradient colors={["#14102A", "#0B0916"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.dots} pointerEvents="none">
        {Array.from({ length: 36 }).map((_, i) => (
          <View key={i} style={[styles.dot, { opacity: 0.08 + (i % 5) * 0.03 }]} />
        ))}
      </View>

      <View style={styles.topRow}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: colors.brand }]}>
            <Ionicons name="pulse" size={14} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.brandText}>CoinRadar</ThemedText>
        </View>
        <View style={[styles.pill, { backgroundColor: closed ? "rgba(255,255,255,0.12)" : sideColor }]}>
          <ThemedText style={styles.pillText}>{closed ? "Closed" : trade.side === "LONG" ? "Long" : "Short"}</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.symbol}>{trade.symbol}</ThemedText>
      <ThemedText style={[styles.pct, { color: tone }]}>
        {positive ? "+" : ""}
        {pct.toFixed(2)}%
      </ThemedText>
      <ThemedText style={styles.status}>{closed ? "Trade closed" : "Live · trade open"}</ThemedText>

      <View style={styles.legs}>
        <View>
          <ThemedText style={styles.legLabel}>Entry</ThemedText>
          <ThemedText style={styles.legValue}>{formatCompactPrice(trade.entryPrice)}</ThemedText>
        </View>
        <View>
          <ThemedText style={styles.legLabel}>{closed ? "Exit" : "Now"}</ThemedText>
          <ThemedText style={styles.legValue}>{formatCompactPrice(current)}</ThemedText>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 22, gap: 6, overflow: "hidden", minHeight: 260 },
  dots: { ...StyleSheet.absoluteFill, flexDirection: "row", flexWrap: "wrap", padding: 16, gap: 14, alignContent: "flex-start" },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#A78BFA" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  brandText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  pill: { paddingHorizontal: 12, height: 26, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  pillText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  symbol: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 18 },
  pct: { fontSize: 52, fontWeight: "800", letterSpacing: -1.5, lineHeight: 58 },
  status: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  legs: { flexDirection: "row", gap: 36, marginTop: 22 },
  legLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  legValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 2 },
});
