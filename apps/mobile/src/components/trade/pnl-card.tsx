import { forwardRef, useState, type ReactNode } from "react";
import { View, Image, StyleSheet, type LayoutChangeEvent, type TextStyle, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { formatCompactPrice } from "@/lib/format";
import { pnlPct, type Trade } from "@/lib/stores/trades-store";
import { CARD_LAYOUT as L, CARD_STYLE_LABELS, CARD_THEMES, type CardStyle } from "@/lib/card-layout";

export { CARD_STYLE_LABELS };

const LOGO = require("../../../assets/splash-icon.png");
const W = L.canvas.width;
const H = L.canvas.height;

// Base gradient for each style. Decorations are drawn on top in Backdrop.
const BASE: Record<CardStyle, [string, string]> = {
  minimal: ["#FFFFFF", "#EEF0F7"],
  bold: ["#0A0A0A", "#0A0A0A"],
  neon: ["#06060F", "#140D3A"],
  gradient: ["#6D28D9", "#DB2777"],
  grid: ["#0F172A", "#0B1224"],
  noir: ["#1C1C1E", "#141415"],
  blush: ["#F4D3D2", "#D9B0AF"],
  moonlit: ["#0A0618", "#1B0F3D"],
  gigachad: ["#0A0A0A", "#0A0A0A"],
};

/** Shareable P&L card. Layout is fixed on a 1080x1350 canvas and scaled to the rendered width. */
export const PnlCard = forwardRef<View, { trade: Trade; livePrice: number | null; style?: CardStyle }>(function PnlCard(
  { trade, livePrice, style = "neon" },
  ref,
) {
  const [width, setWidth] = useState(0);
  const k = width / W;
  const t = CARD_THEMES[style];

  const closed = trade.exitPrice != null;
  const current = closed ? (trade.exitPrice as number) : livePrice ?? trade.entryPrice;
  const pct = pnlPct(trade.side, trade.entryPrice, current);
  const tone = pct >= 0 ? t.profit : t.loss;
  const held = formatHeld((trade.closedAt ?? Date.now()) - trade.openedAt);
  // Spot-style P&L: the position's USD notional moved by the same percentage.
  const usd = trade.sizeUsd != null ? (trade.sizeUsd * pct) / 100 : null;
  const pctText = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  // Big moves (+1250.00%) would be truncated at full size, so shrink the hero number as it grows.
  const pctSize = L.pnlPercent.fontSize * Math.min(1, 7 / pctText.length);

  const at = (x: number, y: number) => ({ position: "absolute" as const, left: x * k, top: y * k });
  const shadow: TextStyle = t.shadow
    ? { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 12 * k, textShadowOffset: { width: 0, height: 2 * k } }
    : {};
  const pill = { backgroundColor: t.pillBg, alignItems: "center" as const, justifyContent: "center" as const };

  const stats = [
    { label: "Entry", value: formatCompactPrice(trade.entryPrice) },
    { label: closed ? "Exit" : "Now", value: formatCompactPrice(current) },
    { label: "Held", value: held },
  ];

  return (
    <View ref={ref} collapsable={false} style={styles.card} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {/* Until the first layout pass k is 0, and Android crashes on text with fontSize 0, so wait for a real width. */}
      {width > 0 && (
        <>
          <Backdrop style={style} k={k} background={t.background} />

          <Image source={LOGO} style={[at(L.logo.x, L.logo.y), { width: L.logo.size * k, height: L.logo.size * k }]} />
          <ThemedText style={[at(L.brand.x, L.brand.y), { color: t.text, fontSize: L.brand.fontSize * k, fontWeight: "700" }, shadow]}>
            {L.brand.text}
          </ThemedText>

          <View
            style={[
              { position: "absolute", right: L.statusPill.right * k, top: L.statusPill.y * k, height: L.statusPill.height * k, borderRadius: L.statusPill.radius * k, paddingHorizontal: 24 * k, borderWidth: Math.max(StyleSheet.hairlineWidth, 2 * k), borderColor: t.pillBorder },
              pill,
            ]}
          >
            <ThemedText style={{ color: t.pillText, fontSize: L.statusPill.fontSize * k, fontWeight: "600" }}>{closed ? "Trade closed" : "Live"}</ThemedText>
          </View>

          <View style={[at(L.symbol.x, L.symbol.y), { flexDirection: "row", alignItems: "center", gap: L.sidePill.gap * k }]}>
            <ThemedText style={[{ color: t.text, fontSize: L.symbol.fontSize * k, fontWeight: "700" }, shadow]}>{trade.symbol}</ThemedText>
            <View style={[{ height: L.sidePill.height * k, paddingHorizontal: 22 * k, borderRadius: L.sidePill.radius * k }, pill]}>
              <ThemedText style={{ color: t.pillText, fontSize: L.sidePill.fontSize * k, fontWeight: "700" }}>{trade.side}</ThemedText>
            </View>
          </View>

          <ThemedText
            numberOfLines={1}
            style={[at(L.pnlPercent.x, L.pnlPercent.y), { color: tone, fontSize: pctSize * k, fontWeight: "800", letterSpacing: -4 * k, lineHeight: pctSize * k }, shadow]}
          >
            {pctText}
          </ThemedText>

          {usd != null && (
            <ThemedText style={[at(L.pnlUsd.x, L.pnlUsd.y), { color: tone, fontSize: L.pnlUsd.fontSize * k, fontWeight: "600" }, shadow]}>
              {usd >= 0 ? "+" : "-"}${Math.abs(usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
          )}

          <View style={[at(L.divider.x, L.divider.y), { width: (W - 2 * L.divider.x) * k, height: L.divider.thickness * k, backgroundColor: t.divider }]} />

          {stats.map((col, i) => {
            const x = L.stats.columns[i];
            return (
              <View key={col.label} style={at(x, L.stats.y)}>
                <ThemedText style={{ color: t.sub, fontSize: L.stats.labelSize * k, textTransform: "uppercase", letterSpacing: 1 * k }}>{col.label}</ThemedText>
                <ThemedText style={{ color: t.text, fontSize: L.stats.valueSize * k, fontWeight: "700", marginTop: (L.stats.valueGap - L.stats.labelSize) * k }}>{col.value}</ThemedText>
              </View>
            );
          })}

          <ThemedText style={[at(L.padding, L.footer.y), { color: t.sub, fontSize: L.footer.fontSize * k }]}>coinradar.app</ThemedText>
        </>
      )}
    </View>
  );
});

/** Decorative layer per style, all drawn with plain views so it renders the same on every device. */
function Backdrop({ style, k, background }: { style: CardStyle; k: number; background: number | undefined }) {
  const s = (v: number) => v * k;
  const blob = (x: number, y: number, r: number, color: string, opacity = 1) => (
    <View key={`${x}-${y}-${r}`} style={{ position: "absolute", left: s(x - r), top: s(y - r), width: s(2 * r), height: s(2 * r), borderRadius: s(r), backgroundColor: color, opacity }} />
  );
  const ring = (x: number, y: number, r: number, color: string, opacity = 1) => (
    <View key={`ring-${x}-${y}-${r}`} style={{ position: "absolute", left: s(x - r), top: s(y - r), width: s(2 * r), height: s(2 * r), borderRadius: s(r), borderWidth: Math.max(1, 2 * k), borderColor: color, opacity }} />
  );
  const line = (x: number, y: number, w: number, h: number, color: string, opacity = 1, rotate?: string) => (
    <View key={`l-${x}-${y}-${w}-${h}`} style={{ position: "absolute", left: s(x), top: s(y), width: s(w), height: s(h), backgroundColor: color, opacity, transform: rotate ? [{ rotate }] : undefined }} />
  );

  const shapes = (() => {
    switch (style) {
      case "minimal":
        return [blob(900, 120, 320, "#C4B5FD", 0.35), blob(120, 1200, 260, "#DDD6FE", 0.35), ring(W - 40, H - 60, 300, "#C9CCD8"), ring(W - 40, H - 60, 420, "#D6D8E2")];
      case "bold":
        return [line(W - 430, -180, 700, 260, "#C6F432", 1, "35deg"), line(W - 300, 60, 520, 40, "#C6F432", 0.7, "35deg"), line(-220, H - 170, 900, 80, "#C6F432", 0.9, "-18deg")];
      case "neon":
        return [blob(900, 170, 300, "#7C3AED", 0.4), blob(160, 620, 230, "#22D3EE", 0.18), blob(W / 2, H + 40, 560, "#A855F7", 0.28), line(0, H * 0.78, W, 2, "#22D3EE", 0.35), line(0, H * 0.86, W, 1.5, "#22D3EE", 0.2)];
      case "gradient":
        return [ring(880, 1040, 170, "#FFFFFF", 0.4), blob(880, 1040, 170, "#FFFFFF", 0.1), ring(700, 1220, 80, "#FFFFFF", 0.4), blob(960, 120, 95, "#FFFFFF", 0.14), ring(960, 120, 95, "#FFFFFF", 0.4)];
      case "grid":
        return gridAndCandles(s);
      case "noir":
        return [blob(W / 2, H + 60, 560, "#B07A2E", 0.35), <View key="frame" style={{ position: "absolute", left: s(44), top: s(44), width: s(W - 88), height: s(H - 88), borderWidth: Math.max(1, 1.5 * k), borderColor: "#3A3A3C" }} />];
      case "blush":
        return [blob(W / 2, H * 0.38, 430, "#FFF1EE", 0.55), ...corners(s, "#2A2626")];
      case "moonlit":
        return [blob(W * 0.76, H * 0.16, 340, "#8B5CF6", 0.25), blob(W * 0.76, H * 0.16, 200, "#C4B5FD"), blob(W * 0.72, H * 0.14, 40, "#A78BFA", 0.5), blob(W * 0.8, H * 0.2, 26, "#A78BFA", 0.45), blob(W / 2, H + 500, 900, "#05030B"), ...stars(s)];
      default:
        return [];
    }
  })();

  if (style === "gigachad" && background) {
    return (
      <>
        <Image source={background} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.85)"]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      </>
      );
  }

  return (
    <>
      <LinearGradient colors={BASE[style]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
        {shapes}
      </View>
    </>
  );
}

/** Faint grid, plus a row of candles along the bottom third. */
function gridAndCandles(s: (v: number) => number) {
  const items: ReactNode[] = [];
  for (let i = 1; i < 36; i++) items.push(<View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: s(i * 37.5), height: StyleSheet.hairlineWidth, backgroundColor: "rgba(148,163,184,0.12)" }} />);
  for (let i = 1; i < 30; i++) items.push(<View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: s(i * 36), width: StyleSheet.hairlineWidth, backgroundColor: "rgba(148,163,184,0.12)" }} />);
  const count = 18;
  const step = (W - 120) / count;
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i * 0.55) * 0.5 + Math.cos(i * 0.23) * 0.3 + i * 0.02;
    const up = wave >= 0;
    const bodyH = 40 + Math.abs(Math.sin(i * 1.7)) * 110;
    const top = H * 0.7 + (Math.sin(i * 0.9) * 0.5 + 0.5) * 150;
    const color = up ? "#22D3EE" : "#3B6B9A";
    const x = 60 + i * step;
    items.push(<View key={`w${i}`} style={{ position: "absolute", left: s(x + step / 2 - 1), top: s(top - 30), width: s(2), height: s(bodyH + 60), backgroundColor: color, opacity: 0.45 }} />);
    items.push(<View key={`b${i}`} style={{ position: "absolute", left: s(x + step * 0.22), top: s(top), width: s(step * 0.56), height: s(bodyH), backgroundColor: color, opacity: up ? 0.6 : 0.45, borderRadius: s(3) }} />);
  }
  return items;
}

function corners(s: (v: number) => number, color: string) {
  const L2 = 48;
  const T = 5;
  const inset = 28;
  const bars: ReactNode[] = [];
  const spots = [
    { x: inset, y: inset, dx: 1, dy: 1 },
    { x: W - inset, y: inset, dx: -1, dy: 1 },
    { x: inset, y: H - inset, dx: 1, dy: -1 },
    { x: W - inset, y: H - inset, dx: -1, dy: -1 },
  ];
  spots.forEach((c, i) => {
    const hx = c.dx > 0 ? c.x : c.x - L2;
    const vy = c.dy > 0 ? c.y : c.y - L2;
    bars.push(<View key={`h${i}`} style={{ position: "absolute", left: s(hx), top: s(c.dy > 0 ? c.y : c.y - T), width: s(L2), height: s(T), backgroundColor: color }} />);
    bars.push(<View key={`v${i}`} style={{ position: "absolute", left: s(c.dx > 0 ? c.x : c.x - T), top: s(vy), width: s(T), height: s(L2), backgroundColor: color }} />);
  });
  return bars;
}

function stars(s: (v: number) => number) {
  const out: ReactNode[] = [];
  for (let i = 0; i < 40; i++) {
    const x = (i * 271) % W;
    const y = 80 + ((i * 397) % (H * 0.6));
    const r = 1.5 + (i % 3);
    out.push(<View key={`s${i}`} style={{ position: "absolute", left: s(x), top: s(y), width: s(r * 2), height: s(r * 2), borderRadius: s(r), backgroundColor: "#D8CCFF", opacity: 0.25 + (i % 5) * 0.12 }} />);
  }
  return out;
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
  card: { width: "100%", aspectRatio: W / H, borderRadius: 28, overflow: "hidden", backgroundColor: "#0A0A0A" } as ViewStyle,
});
