// Every P&L card shares one layout and one typeface; a theme changes only colours, decoration
// and background artwork. Positions are px on a 1080x1350 canvas - scale by (renderWidth / 1080).
// The numbers sit in the lower part of the card so the top belongs to the artwork.

import { fonts } from "./theme";

export const CARD_LAYOUT = {
  canvas: { width: 1080, height: 1350 },
  padding: 80,
  logo: { x: 80, y: 80, size: 80 },
  brand: { x: 180, y: 100, fontSize: 40, text: "CoinRadar" },
  statusPill: { right: 80, y: 88, height: 64, fontSize: 28, radius: 32 },
  tagline: { x: 80, y: 612, fontSize: 28 },
  symbol: { x: 80, y: 660, fontSize: 56 },
  sidePill: { gap: 20, height: 64, fontSize: 32, radius: 14 },
  pnlPercent: { x: 72, y: 736, fontSize: 158, tracking: -5 },
  pnlUsd: { x: 80, y: 924, fontSize: 52 },
  // Same height as the rule in Noir's artwork, so on that card the two coincide.
  divider: { x: 80, y: 1020, thickness: 2 },
  // Third column starts at 720 so values clear the antenna in Moonlit's artwork.
  stats: { y: 1060, labelSize: 26, valueGap: 44, valueSize: 50, columns: [80, 400, 720] },
  footer: { y: 1236, fontSize: 26 },
  /** Viewfinder brackets in the four corners; text keeps clear of them. */
  corners: { inset: 50, arm: 70, thickness: 5 },
};

/** One typeface for every card: the app's display face for numbers and titles, its text face for labels. */
export const CARD_FONTS = {
  display: fonts.display,
  body: fonts.bodySemibold,
};

/** Themes in picker order: the illustrated ones first, then the drawn ones. */
export type CardStyle = "gigachad" | "moonlit" | "noir" | "blush" | "neon" | "gradient" | "bold" | "grid" | "minimal";

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
  /** Short line in the theme's voice, picked by whether the trade is up or down. */
  tagline: { profit: string; loss: string };
  /** Draw the corner brackets; false when the artwork already has its own. */
  corners: boolean;
}

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
    tagline: { profit: "Closed in profit", loss: "Closed at a loss" },
    corners: true,
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
    tagline: { profit: "Big move", loss: "Took the hit" },
    corners: true,
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
    tagline: { profit: "Fully charged", loss: "Power dip" },
    corners: true,
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
    tagline: { profit: "Good vibes only", loss: "Reset and reload" },
    corners: true,
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
    tagline: { profit: "By the numbers", loss: "Risk managed" },
    corners: true,
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
    tagline: { profit: "Clean execution", loss: "Cost of doing business" },
    corners: true,
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
    tagline: { profit: "Pretty in profit", loss: "Soft landing" },
    corners: false, // the artwork has them built in
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
    tagline: { profit: "To the moon", loss: "The moon can wait" },
    corners: true,
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
    tagline: { profit: "Built different", loss: "Unbothered" },
    corners: true,
  },
};

export const CARD_STYLES: CardStyle[] = ["gigachad", "moonlit", "noir", "blush", "neon", "gradient", "bold", "grid", "minimal"];

export const CARD_STYLE_LABELS: Record<CardStyle, string> = Object.fromEntries(
  CARD_STYLES.map((k) => [k, CARD_THEMES[k].label]),
) as Record<CardStyle, string>;
