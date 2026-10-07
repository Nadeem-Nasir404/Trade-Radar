// One base layout for all PnL cards, with per-theme overrides where the artwork needs room
// (e.g. Gigachad keeps the numbers off the face). All positions are px on a 1080x1350 canvas;
// scale by (renderWidth / 1080).

export const CARD_LAYOUT = {
  canvas: { width: 1080, height: 1350 },
  padding: 80,
  logo: { x: 80, y: 80, size: 80 },
  brand: { x: 180, y: 100, fontSize: 40, weight: "700", text: "CoinRadar" },
  statusPill: { right: 80, y: 88, height: 64, fontSize: 28, radius: 32 },
  tagline: { x: 80, y: 262, fontSize: 28 },
  symbol: { x: 80, y: 330, fontSize: 56, weight: "700" },
  sidePill: { gap: 20, height: 64, fontSize: 34, radius: 14 },
  pnlPercent: { x: 72, y: 410, fontSize: 200, weight: "800" },
  pnlUsd: { x: 80, y: 650, fontSize: 64, weight: "600" },
  divider: { x: 80, y: 975, thickness: 2, visible: true },
  stats: { y: 1005, labelSize: 26, valueGap: 44, valueSize: 50, columns: [80, 420, 760] },
  footer: { y: 1222, fontSize: 28 },
};

export type CardLayout = typeof CARD_LAYOUT;

/** Numbers stacked along the bottom, leaving the top two thirds to the artwork. */
const BOTTOM_LAYOUT: CardLayout = {
  ...CARD_LAYOUT,
  tagline: { x: 80, y: 700, fontSize: 28 },
  symbol: { ...CARD_LAYOUT.symbol, y: 752 },
  pnlPercent: { ...CARD_LAYOUT.pnlPercent, y: 822, fontSize: 176 },
  pnlUsd: { ...CARD_LAYOUT.pnlUsd, y: 1004, fontSize: 56 },
  divider: { ...CARD_LAYOUT.divider, y: 1098 },
  stats: { ...CARD_LAYOUT.stats, y: 1124 },
  footer: { y: 1270, fontSize: 26 },
};

/** Moonlit keeps the stats on the dark ridge, below the antenna, and the number clear of the moon. */
const MOONLIT_LAYOUT: CardLayout = {
  ...CARD_LAYOUT,
  pnlPercent: { ...CARD_LAYOUT.pnlPercent, y: 430, fontSize: 184 },
  pnlUsd: { ...CARD_LAYOUT.pnlUsd, y: 650 },
  divider: { ...CARD_LAYOUT.divider, y: 1130 },
  stats: { ...CARD_LAYOUT.stats, y: 1152 },
  footer: { y: 1284, fontSize: 26 },
};

/** Noir's artwork has its own rule line and frame, so the card uses those instead of drawing one. */
const NOIR_LAYOUT: CardLayout = {
  ...CARD_LAYOUT,
  divider: { ...CARD_LAYOUT.divider, visible: false },
  stats: { ...CARD_LAYOUT.stats, y: 1050 },
  footer: { y: 1246, fontSize: 26 },
};

/** Themes in picker order: the illustrated ones first, then the drawn ones. */
export type CardStyle = "gigachad" | "moonlit" | "noir" | "blush" | "neon" | "gradient" | "bold" | "grid" | "minimal";

export const CARD_THEMES: Record<CardStyle, CardTheme> = {
  minimal: {
    label: "Minimal",
    text: "#111118",
    sub: "#6B7082",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#FFFFFF",
    pillText: "#111118",
    pillBorder: "#D3D5DF",
    divider: "#D3D5DF",
    shadow: false,
    fallback: ["#FFFFFF", "#F4F4F6"],
    background: undefined,
    layout: CARD_LAYOUT,
    tagline: undefined,
    fonts: { display: "PlusJakartaSans_800ExtraBold", body: "Manrope_600SemiBold" },
    heroFitChars: 7,
    heroTracking: -4,
  },
  bold: {
    label: "Bold",
    text: "#FFFFFF",
    sub: "#A3A3A3",
    profit: "#C6F432",
    loss: "#FF4D4D",
    pillBg: "#C6F432",
    pillText: "#050505",
    pillBorder: "#C6F432",
    divider: "#2A2A2A",
    shadow: false,
    fallback: ["#0A0A0A", "#0A0A0A"],
    background: undefined,
    layout: CARD_LAYOUT,
    tagline: undefined,
    fonts: { display: "ArchivoBlack_400Regular", body: "Manrope_700Bold" },
    heroFitChars: 6.2,
    heroTracking: -3,
  },
  neon: {
    label: "Neon",
    text: "#FFFFFF",
    sub: "#A5A3C9",
    profit: "#22D3EE",
    loss: "#FB7185",
    pillBg: "#1E1650",
    pillText: "#E0F7FF",
    pillBorder: "#22D3EE",
    divider: "#3A2F7A",
    shadow: true,
    fallback: ["#06060F", "#0E0A22"],
    background: undefined,
    layout: CARD_LAYOUT,
    tagline: undefined,
    fonts: { display: "Unbounded_700Bold", body: "Manrope_600SemiBold" },
    heroFitChars: 5.6,
    heroTracking: -2,
  },
  gradient: {
    label: "Gradient",
    text: "#FFFFFF",
    sub: "#F3E8FF",
    profit: "#FFFFFF",
    loss: "#FFE4E6",
    pillBg: "#FFFFFF",
    pillText: "#4C1D95",
    pillBorder: "#FFFFFF",
    divider: "#FFFFFF55",
    shadow: true,
    fallback: ["#7C3AED", "#EC4899"],
    background: undefined,
    layout: CARD_LAYOUT,
    tagline: undefined,
    fonts: { display: "Sora_700Bold", body: "Manrope_600SemiBold" },
    heroFitChars: 6.8,
    heroTracking: -4,
  },
  grid: {
    label: "Grid",
    text: "#FFFFFF",
    sub: "#7E9CC0",
    profit: "#22D3EE",
    loss: "#F87171",
    pillBg: "#0E2A47",
    pillText: "#22D3EE",
    pillBorder: "#22D3EE",
    divider: "#1E3A5F",
    shadow: false,
    fallback: ["#0F172A", "#0F172A"],
    background: undefined,
    layout: CARD_LAYOUT,
    tagline: undefined,
    fonts: { display: "JetBrainsMono_700Bold", body: "JetBrainsMono_500Medium" },
    heroFitChars: 7.4,
    heroTracking: -2,
  },
  noir: {
    label: "Noir",
    text: "#EDEDED",
    sub: "#8A8A8E",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#2A2418",
    pillText: "#E8C48A",
    pillBorder: "#5A4A2A",
    divider: "#343436",
    shadow: false,
    fallback: ["#1A1A1B", "#1A1A1B"],
    background: require("../../assets/cards/noir.jpg"),
    layout: NOIR_LAYOUT,
    tagline: { profit: "Clean execution", loss: "Cost of doing business" },
    fonts: { display: "PlayfairDisplay_700Bold", body: "Manrope_500Medium" },
    heroFitChars: 7.2,
    heroTracking: -1,
  },
  blush: {
    label: "Blush",
    text: "#262222",
    sub: "#6B5C5C",
    profit: "#1F7A3D",
    loss: "#B42318",
    pillBg: "#FAF4F2",
    pillText: "#262222",
    pillBorder: "#2A2626",
    divider: "#2A262633",
    shadow: false,
    fallback: ["#F2C9C8", "#C9A3A3"],
    background: require("../../assets/cards/blush.jpg"),
    layout: CARD_LAYOUT,
    tagline: { profit: "Pretty in profit", loss: "Soft landing" },
    fonts: { display: "Fraunces_700Bold", body: "Manrope_600SemiBold" },
    heroFitChars: 6.8,
    heroTracking: -2,
  },
  moonlit: {
    label: "Moonlit",
    text: "#FFFFFF",
    sub: "#C9BFF0",
    profit: "#E9DDFF",
    loss: "#FDA4AF",
    pillBg: "#C4B5FD",
    pillText: "#1B0F3D",
    pillBorder: "#C4B5FD",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#0A0618", "#1B0F3D"],
    background: require("../../assets/cards/moonlit.jpg"),
    layout: MOONLIT_LAYOUT,
    tagline: { profit: "To the moon", loss: "The moon can wait" },
    fonts: { display: "SpaceGrotesk_700Bold", body: "SpaceGrotesk_500Medium" },
    heroFitChars: 7,
    heroTracking: -4,
  },
  gigachad: {
    label: "Gigachad",
    text: "#FFFFFF",
    sub: "#9A9A9A",
    profit: "#FFFFFF",
    loss: "#FF4D4D",
    pillBg: "#FFFFFF",
    pillText: "#000000",
    pillBorder: "#FFFFFF",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#0A0A0A", "#0A0A0A"],
    background: require("../../assets/cards/gigachad.jpg"),
    layout: BOTTOM_LAYOUT,
    tagline: { profit: "Built different", loss: "Unbothered" },
    fonts: { display: "Anton_400Regular", body: "Manrope_600SemiBold" },
    heroFitChars: 9.5,
    heroTracking: 1,
  },
};

export interface CardTheme {
  label: string;
  text: string;
  sub: string;
  profit: string;
  loss: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  divider: string;
  shadow: boolean;
  fallback: readonly [string, string];
  /** Artwork drawn full-bleed behind the card; themes without one draw their own backdrop. */
  background: number | undefined;
  layout: CardLayout;
  /** Short line in the theme's voice, picked by whether the trade is up or down. */
  tagline: { profit: string; loss: string } | undefined;
  /**
   * Typefaces: `display` for the big numbers, symbol and tagline, `body` for small labels.
   * Explicit font files per weight - on Android, fontWeight does not pick a weight of a custom font.
   */
  fonts: { display: string; body: string };
  /** How many characters of the hero P&L fit across the card at full size; wide faces fit fewer. */
  heroFitChars: number;
  /** Letter spacing of the hero number, in canvas px. */
  heroTracking: number;
}

export const CARD_STYLES: CardStyle[] = ["gigachad", "moonlit", "noir", "blush", "neon", "gradient", "bold", "grid", "minimal"];

export const CARD_STYLE_LABELS: Record<CardStyle, string> = Object.fromEntries(
  CARD_STYLES.map((k) => [k, CARD_THEMES[k].label]),
) as Record<CardStyle, string>;
