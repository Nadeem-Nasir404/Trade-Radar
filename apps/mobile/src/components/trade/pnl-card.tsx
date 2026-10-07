import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { View, Image, StyleSheet, type LayoutChangeEvent, type TextStyle, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { formatCompactPrice } from "@/lib/format";
import { pnlPct, type Trade } from "@/lib/stores/trades-store";
import { useMinuteClock } from "@/lib/hooks/use-minute-clock";
import { CARD_FONTS, CARD_LAYOUT as L, CARD_STYLE_LABELS, CARD_STYLES, CARD_THEMES, DEFAULT_CARD_STYLE, type CardStyle } from "@/lib/card-layout";

export { CARD_STYLE_LABELS, CARD_STYLES };

const LOGO = require("../../../assets/splash-icon.png");
const W = L.canvas.width;
const H = L.canvas.height;
const { display, body } = CARD_FONTS;

/** Lining figures: serif faces like Playfair default to old-style numerals that bob above and below the line. */
const NUMBER_VARIANT: TextStyle["fontVariant"] = ["lining-nums"];

/** The card is a fixed-proportion image, so its text ignores the system font size (which would break the layout). */
function CardText(props: ComponentProps<typeof ThemedText>) {
  return <ThemedText allowFontScaling={false} {...props} />;
}

/** Shareable P&L card. Layout is fixed on a 1080x1350 canvas and scaled to the rendered width. */
export const PnlCard = forwardRef<View, { trade: Trade; livePrice: number | null; style?: CardStyle }>(function PnlCard(
  { trade, livePrice, style = DEFAULT_CARD_STYLE },
  ref,
) {
  const [width, setWidth] = useState(0);
  const k = width / W;
  const t = CARD_THEMES[style] ?? CARD_THEMES[DEFAULT_CARD_STYLE];

  const closed = trade.exitPrice != null;
  const current = closed ? (trade.exitPrice as number) : livePrice ?? trade.entryPrice;
  const pct = pnlPct(trade.side, trade.entryPrice, current);
  const tone = pct >= 0 ? t.profit : t.loss;
  const now = useMinuteClock(trade.closedAt == null);
  const held = formatHeld((trade.closedAt ?? now) - trade.openedAt);
  // Spot-style P&L: the position's USD notional moved by the same percentage.
  const usd = trade.sizeUsd != null ? (trade.sizeUsd * pct) / 100 : null;
  const pctText = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  // Big moves (+1250.00%) would be truncated at full size, so shrink the hero number as it grows.
  const pctSize = L.pnlPercent.fontSize * Math.min(1, 7.5 / pctText.length);
  const tagline = pct >= 0 ? t.tagline.profit : t.tagline.loss;

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
          {t.corners && <CornerBrackets k={k} color={t.text} />}

          <Image source={LOGO} style={[at(L.logo.x, L.logo.y), { width: L.logo.size * k, height: L.logo.size * k }]} />
          <CardText style={[at(L.brand.x, L.brand.y), { color: t.text, fontSize: L.brand.fontSize * k, fontFamily: display }, shadow]}>
            {L.brand.text}
          </CardText>

          <View
            style={[
              { position: "absolute", right: L.statusPill.right * k, top: L.statusPill.y * k, height: L.statusPill.height * k, borderRadius: L.statusPill.radius * k, paddingHorizontal: 24 * k, borderWidth: Math.max(StyleSheet.hairlineWidth, 2 * k), borderColor: t.pillBorder },
              pill,
            ]}
          >
            <CardText style={{ color: t.pillText, fontSize: L.statusPill.fontSize * k, fontFamily: body }}>{closed ? "Trade closed" : "Live"}</CardText>
          </View>

          <CardText style={[at(L.tagline.x, L.tagline.y), { color: t.sub, fontSize: L.tagline.fontSize * k, fontFamily: body, letterSpacing: 4 * k, textTransform: "uppercase" }, shadow]}>
            {tagline}
          </CardText>

          <View style={[at(L.symbol.x, L.symbol.y), { flexDirection: "row", alignItems: "center", gap: L.sidePill.gap * k }]}>
            <CardText style={[{ color: t.text, fontSize: L.symbol.fontSize * k, fontFamily: display }, shadow]}>{trade.symbol}</CardText>
            <View style={[{ height: L.sidePill.height * k, paddingHorizontal: 22 * k, borderRadius: L.sidePill.radius * k }, pill]}>
              <CardText style={{ color: t.pillText, fontSize: L.sidePill.fontSize * k, fontFamily: body }}>{trade.side}</CardText>
            </View>
          </View>

          <CardText
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              at(L.pnlPercent.x, L.pnlPercent.y),
              {
                width: (W - 2 * L.pnlPercent.x) * k,
                color: tone,
                fontSize: pctSize * k,
                fontFamily: display,
                letterSpacing: L.pnlPercent.tracking * k,
                fontVariant: NUMBER_VARIANT,
                lineHeight: pctSize * 1.12 * k,
              },
              shadow,
            ]}
          >
            {pctText}
          </CardText>

          {usd != null && (
            <CardText style={[at(L.pnlUsd.x, L.pnlUsd.y), { color: tone, fontSize: L.pnlUsd.fontSize * k, fontFamily: display, fontVariant: NUMBER_VARIANT }, shadow]}>
              {usd >= 0 ? "+" : "-"}${Math.abs(usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardText>
          )}

          <View style={[at(L.divider.x, L.divider.y), { width: (W - 2 * L.divider.x) * k, height: L.divider.thickness * k, backgroundColor: t.divider }]} />

          {stats.map((col, i) => {
            const x = L.stats.columns[i];
            return (
              <View key={col.label} style={at(x, L.stats.y)}>
                <CardText style={{ color: t.sub, fontSize: L.stats.labelSize * k, fontFamily: body, textTransform: "uppercase", letterSpacing: 2 * k }}>{col.label}</CardText>
                <CardText style={[{ color: t.text, fontSize: L.stats.valueSize * k, fontFamily: display, fontVariant: NUMBER_VARIANT, marginTop: (L.stats.valueGap - L.stats.labelSize) * k }, shadow]}>{col.value}</CardText>
              </View>
            );
          })}

          <CardText style={[at(L.padding, L.footer.y), { color: t.sub, fontSize: L.footer.fontSize * k, fontFamily: body }, shadow]}>coinradar.app</CardText>
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

  if (background) {
    return (
      <>
        <Image source={background} style={StyleSheet.absoluteFill} resizeMode="cover" />
        {ARTWORK_SCRIMS[style]}
      </>
    );
  }

  // Minimal is the one theme without artwork: a light gradient with soft shapes.
  const shapes = [blob(900, 120, 320, "#C4B5FD", 0.35), blob(120, 1200, 260, "#DDD6FE", 0.35), ring(W - 40, H - 60, 300, "#C9CCD8"), ring(W - 40, H - 60, 420, "#D6D8E2")];

  return (
    <>
      <LinearGradient colors={[...CARD_THEMES[style].fallback]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
        {shapes}
      </View>
    </>
  );
}

/** Shading laid over each artwork only where text sits, so numbers stay readable without dulling the picture. */
const ARTWORK_SCRIMS: Partial<Record<CardStyle, ReactNode>> = {
  // Face stays untouched in the top half; the numbers sit on a dark fade at the bottom.
  gigachad: (
    <LinearGradient
      colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
      locations={[0, 0.2, 0.55, 0.85]}
      style={StyleSheet.absoluteFill}
    />
  ),
  // Text runs down the left, away from the moon and the antenna on the right.
  moonlit: <LinearGradient colors={["rgba(10,6,24,0.55)", "rgba(10,6,24,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.75, y: 0.5 }} style={StyleSheet.absoluteFill} />,
};

/** Viewfinder-style brackets in the four corners, in the theme's text colour. */
function CornerBrackets({ k, color }: { k: number; color: string }) {
  const { inset, arm, thickness } = L.corners;
  const bar = (key: string, left: number, top: number, width: number, height: number) => (
    <View key={key} style={{ position: "absolute", left: left * k, top: top * k, width: width * k, height: height * k, backgroundColor: color }} />
  );
  const right = W - inset;
  const bottom = H - inset;
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} pointerEvents="none">
      {bar("tl-h", inset, inset, arm, thickness)}
      {bar("tl-v", inset, inset, thickness, arm)}
      {bar("tr-h", right - arm, inset, arm, thickness)}
      {bar("tr-v", right - thickness, inset, thickness, arm)}
      {bar("bl-h", inset, bottom - thickness, arm, thickness)}
      {bar("bl-v", inset, bottom - arm, thickness, arm)}
      {bar("br-h", right - arm, bottom - thickness, arm, thickness)}
      {bar("br-v", right - thickness, bottom - arm, thickness, arm)}
    </View>
  );
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
