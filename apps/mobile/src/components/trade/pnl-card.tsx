import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { radius } from "@/lib/theme";
import { formatCompactPrice } from "@/lib/format";
import { pnlPct, type CardStyle, type Trade } from "@/lib/stores/trades-store";

interface Theme {
  bg: [string, string];
  ink: string;
  muted: string;
  up: string;
  down: string;
  accent: string;
  pillBg: string;
  pillText: string;
}

const THEMES: Record<CardStyle, Theme> = {
  minimal: { bg: ["#FFFFFF", "#F4F4F6"], ink: "#111114", muted: "#8A8A93", up: "#16A34A", down: "#DC2626", accent: "#111114", pillBg: "#111114", pillText: "#FFFFFF" },
  bold: { bg: ["#0A0A0A", "#0A0A0A"], ink: "#FFFFFF", muted: "#9CA3AF", up: "#C6F432", down: "#FF4D4D", accent: "#C6F432", pillBg: "#C6F432", pillText: "#0A0A0A" },
  neon: { bg: ["#06060F", "#0E0A22"], ink: "#E9E7FF", muted: "#7C78A6", up: "#39FF88", down: "#FF3D9A", accent: "#A78BFA", pillBg: "rgba(167,139,250,0.18)", pillText: "#D8CCFF" },
  gradient: { bg: ["#7C3AED", "#EC4899"], ink: "#FFFFFF", muted: "rgba(255,255,255,0.75)", up: "#FFFFFF", down: "#FFE4E6", accent: "#FFFFFF", pillBg: "rgba(255,255,255,0.22)", pillText: "#FFFFFF" },
  grid: { bg: ["#0F172A", "#0F172A"], ink: "#F1F5F9", muted: "#64748B", up: "#34D399", down: "#F87171", accent: "#38BDF8", pillBg: "rgba(56,189,248,0.14)", pillText: "#7DD3FC" },
};

export const CARD_STYLE_LABELS: Record<CardStyle, string> = {
  minimal: "Minimal",
  bold: "Bold",
  neon: "Neon",
  gradient: "Gradient",
  grid: "Grid",
};

/** Shareable P&L card in one of several visual styles. */
export function PnlCard({ trade, livePrice, style = "neon" }: { trade: Trade; livePrice: number | null; style?: CardStyle }) {
  const t = THEMES[style];
  const closed = trade.exitPrice != null;
  const current = closed ? (trade.exitPrice as number) : livePrice ?? trade.entryPrice;
  const pct = pnlPct(trade.side, trade.entryPrice, current);
  const positive = pct >= 0;
  const tone = positive ? t.up : t.down;
  const sideLabel = closed ? "Closed" : trade.side === "LONG" ? "Long" : "Short";

  return (
    <LinearGradient colors={t.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, style === "minimal" && styles.cardLight]}>
      {style === "grid" && <GridLines color="rgba(148,163,184,0.12)" />}
      {style === "neon" && <View style={styles.neonGlow} pointerEvents="none" />}
      {style === "gradient" && <View style={styles.gradientSheen} pointerEvents="none" />}

      <View style={styles.topRow}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: style === "bold" ? "#C6F432" : t.accent }]}>
            <Ionicons name="pulse" size={13} color={style === "bold" ? "#0A0A0A" : "#FFFFFF"} />
          </View>
          <ThemedText style={[styles.brandText, { color: t.ink }]}>CoinRadar</ThemedText>
        </View>
        <View style={[styles.pill, { backgroundColor: t.pillBg }]}>
          <ThemedText style={[styles.pillText, { color: t.pillText }]}>{sideLabel}</ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.symbol, { color: t.muted }]}>{trade.symbol}</ThemedText>
      <ThemedText style={[style === "bold" ? styles.pctBold : styles.pct, { color: tone }]} numberOfLines={1}>
        {positive ? "+" : ""}
        {pct.toFixed(2)}%
      </ThemedText>
      <ThemedText style={[styles.status, { color: t.muted }]}>{closed ? "Trade closed" : "Live · trade open"}</ThemedText>

      <View style={styles.legs}>
        <View>
          <ThemedText style={[styles.legLabel, { color: t.muted }]}>Entry</ThemedText>
          <ThemedText style={[styles.legValue, { color: t.ink }]}>{formatCompactPrice(trade.entryPrice)}</ThemedText>
        </View>
        <View>
          <ThemedText style={[styles.legLabel, { color: t.muted }]}>{closed ? "Exit" : "Now"}</ThemedText>
          <ThemedText style={[styles.legValue, { color: t.ink }]}>{formatCompactPrice(current)}</ThemedText>
        </View>
      </View>
    </LinearGradient>
  );
}

function GridLines({ color }: { color: string }) {
  const lines = Array.from({ length: 9 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: (i + 1) * 28, height: StyleSheet.hairlineWidth, backgroundColor: color }} />
      ))}
      {lines.map((_, i) => (
        <View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: (i + 1) * 36, width: StyleSheet.hairlineWidth, backgroundColor: color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: 22, gap: 6, overflow: "hidden", minHeight: 280 },
  cardLight: { borderWidth: 1, borderColor: "#E4E4E7" },
  neonGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, right: -80, top: -90, backgroundColor: "rgba(167,139,250,0.22)" },
  gradientSheen: { position: "absolute", width: 300, height: 300, borderRadius: 150, left: -120, bottom: -140, backgroundColor: "rgba(255,255,255,0.12)" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  brandText: { fontWeight: "700", fontSize: 14 },
  pill: { paddingHorizontal: 12, height: 26, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  pillText: { fontWeight: "700", fontSize: 12 },
  symbol: { fontSize: 13, marginTop: 20 },
  pct: { fontSize: 50, fontWeight: "800", letterSpacing: -1.5, lineHeight: 56 },
  pctBold: { fontSize: 64, fontWeight: "900", letterSpacing: -2.5, lineHeight: 66, textTransform: "uppercase" },
  status: { fontSize: 12 },
  legs: { flexDirection: "row", gap: 36, marginTop: 22 },
  legLabel: { fontSize: 12 },
  legValue: { fontSize: 18, fontWeight: "700", marginTop: 2 },
});
