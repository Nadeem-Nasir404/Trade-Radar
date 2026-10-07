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
  pnlPercent: { x: 72, y: 736, fontSize: 158, tracking: -2 },
  pnlUsd: { x: 80, y: 924, fontSize: 52 },
  // Same height as the rule in Noir's artwork, so on that card the two coincide.
  divider: { x: 80, y: 1020, thickness: 2 },
  // Third column starts at 720 so values clear the antenna in Moonlit's artwork.
  stats: { y: 1060, labelSize: 26, valueGap: 44, valueSize: 50, columns: [80, 400, 720] },
  footer: { y: 1236, fontSize: 26 },
  /** Viewfinder brackets in the four corners; text keeps clear of them. */
  corners: { inset: 50, arm: 70, thickness: 5 },
};

/** Same fonts on every card: the app's display face for titles and stats, its text face for labels, a wide face for the P&L. */
export const CARD_FONTS = {
  display: fonts.display,
  body: fonts.bodySemibold,
  /** Wide, flat figures for the P&L percent and dollar amount. */
  number: "EncodeSansExpanded_500Medium",
};

export type CardStyle =
  | "wolf"
  | "wolfpen"
  | "wolfyacht"
  | "gigachad"
  | "stonks"
  | "printer"
  | "feelsgood"
  | "wojak"
  | "notover"
  | "fine"
  | "rainy"
  | "anime"
  | "kurumi"
  | "moonlit"
  | "diamond"
  | "moneyrain"
  | "noir"
  | "blush"
  | "minimal";

/** Used when nothing (or a since-removed style) is saved. */
export const DEFAULT_CARD_STYLE: CardStyle = "wolf";

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
  feelsgood: {
    label: "Feels Good",
    text: "#111118",
    sub: "#6B7082",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#15803D",
    pillText: "#FFFFFF",
    pillBorder: "#15803D",
    divider: "#11111822",
    shadow: false,
    fallback: ["#F7F7F7", "#F7F7F7"],
    background: require("../../assets/cards/feelsgood.jpg"),
    tagline: { profit: "Feels good man", loss: "Feels bad man" },
    corners: true,
  },
  wojak: {
    label: "Wojak",
    text: "#111118",
    sub: "#6B7082",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#1D4ED8",
    pillText: "#FFFFFF",
    pillBorder: "#1D4ED8",
    divider: "#11111822",
    shadow: false,
    fallback: ["#FFFFFF", "#FFFFFF"],
    background: require("../../assets/cards/wojak.jpg"),
    tagline: { profit: "Tears of joy", loss: "It's over" },
    corners: true,
  },
  notover: {
    label: "Not Over",
    text: "#111118",
    sub: "#6B7082",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#15803D",
    pillText: "#FFFFFF",
    pillBorder: "#15803D",
    divider: "#11111822",
    shadow: false,
    fallback: ["#F8F8F8", "#F8F8F8"],
    background: require("../../assets/cards/notover.jpg"),
    tagline: { profit: "Told you so", loss: "Revenge trade loading" },
    corners: true,
  },
  fine: {
    label: "It's Fine",
    text: "#FFFFFF",
    sub: "#C7C9D3",
    profit: "#FFFFFF",
    loss: "#FECACA",
    pillBg: "#FDBA74",
    pillText: "#111118",
    pillBorder: "#FDBA74",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#141414", "#050505"],
    background: require("../../assets/cards/fine.jpg"),
    tagline: { profit: "Finally made it", loss: "It's fine. I'm fine." },
    corners: true,
  },
  rainy: {
    label: "Rainy Day",
    text: "#FFFFFF",
    sub: "#C7C9D3",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#E5E7EB",
    pillText: "#111118",
    pillBorder: "#E5E7EB",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#141414", "#050505"],
    background: require("../../assets/cards/rainy.jpg"),
    tagline: { profit: "After the storm", loss: "Raining red" },
    corners: true,
  },
  anime: {
    label: "Anime",
    text: "#FFFFFF",
    sub: "#E9D5FF",
    profit: "#A5F3FC",
    loss: "#FB7185",
    pillBg: "#F472B6",
    pillText: "#1E0B2E",
    pillBorder: "#F472B6",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1B0B3F", "#0A0616"],
    background: require("../../assets/cards/anime.jpg"),
    tagline: { profit: "Power level: over 9000", loss: "Training arc" },
    corners: true,
  },
  printer: {
    label: "Money Printer",
    text: "#FFFFFF",
    sub: "#BBF7D0",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#FACC15",
    pillText: "#1A1600",
    pillBorder: "#FACC15",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#06301A", "#020D07"],
    background: require("../../assets/cards/printer.jpg"),
    tagline: { profit: "Money printer go brrr", loss: "Printer jammed" },
    corners: true,
  },
  stonks: {
    label: "Stonks",
    text: "#FFFFFF",
    sub: "#93A4C8",
    profit: "#FB923C",
    loss: "#F87171",
    pillBg: "#F97316",
    pillText: "#FFFFFF",
    pillBorder: "#F97316",
    divider: "#FFFFFF2E",
    shadow: true,
    fallback: ["#0B1A3A", "#05080F"],
    background: require("../../assets/cards/stonks.jpg"),
    tagline: { profit: "Stonks", loss: "Not stonks" },
    corners: true,
  },
  wolf: {
    label: "Wolf",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#EAB308",
    pillText: "#1A1600",
    pillBorder: "#EAB308",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/wolf.jpg"),
    tagline: { profit: "I'm not leaving", loss: "Still not leaving" },
    corners: true,
  },
  wolfpen: {
    label: "Sell Me This Pen",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#EAB308",
    pillText: "#1A1600",
    pillBorder: "#EAB308",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/wolfpen.jpg"),
    tagline: { profit: "Sell me this pen", loss: "Pen still for sale" },
    corners: true,
  },
  wolfyacht: {
    label: "Yacht Life",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#EAB308",
    pillText: "#1A1600",
    pillBorder: "#EAB308",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/wolfyacht.jpg"),
    tagline: { profit: "Throwing money around", loss: "Yacht's still mine" },
    corners: true,
  },
  diamond: {
    label: "Diamond Hands",
    text: "#111118",
    sub: "#5B6B82",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#0369A1",
    pillText: "#FFFFFF",
    pillBorder: "#0369A1",
    divider: "#11111822",
    shadow: false,
    fallback: ["#DCEFFF", "#FFFFFF"],
    background: require("../../assets/cards/diamond.jpg"),
    tagline: { profit: "Diamond hands", loss: "Still holding" },
    corners: true,
  },
  moneyrain: {
    label: "Money Rain",
    text: "#111118",
    sub: "#5B7066",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#15803D",
    pillText: "#FFFFFF",
    pillBorder: "#15803D",
    divider: "#11111822",
    shadow: false,
    fallback: ["#DDF7E6", "#FFFFFF"],
    background: require("../../assets/cards/moneyrain.jpg"),
    tagline: { profit: "Make it rain", loss: "Rain check" },
    corners: true,
  },
  kurumi: {
    label: "Kurumi",
    text: "#FFFFFF",
    sub: "#FCE7F3",
    profit: "#FFFFFF",
    loss: "#FECDD3",
    pillBg: "#EC4899",
    pillText: "#FFFFFF",
    pillBorder: "#EC4899",
    divider: "#FFFFFF4D",
    shadow: true,
    fallback: ["#F9A8D4", "#4A0E3C"],
    background: require("../../assets/cards/kurumi.jpg"),
    tagline: { profit: "Main character energy", loss: "Emotional damage" },
    corners: true,
  },
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

/**
 * Styles grouped into families. The picker shows one tile per family with its first style as the
 * cover; tapping a family shows that cover, and tapping it again shuffles to another style.
 */
export type CardPackId = "diamond" | "gigachad" | "apu" | "wojak" | "stonks" | "anime" | "aesthetic" | "minimal";

export const CARD_PACKS: Record<CardPackId, { label: string; styles: CardStyle[] }> = {
  diamond: { label: "Diamond Hands", styles: ["wolf", "wolfpen", "wolfyacht", "diamond", "moneyrain"] },
  gigachad: { label: "Gigachad", styles: ["gigachad"] },
  apu: { label: "Apu", styles: ["feelsgood", "notover"] },
  wojak: { label: "Wojak", styles: ["wojak", "rainy", "fine"] },
  stonks: { label: "Stonks", styles: ["stonks", "printer"] },
  anime: { label: "Anime", styles: ["kurumi", "anime"] },
  aesthetic: { label: "Aesthetic", styles: ["moonlit", "noir", "blush"] },
  minimal: { label: "Minimal", styles: ["minimal"] },
};

/** Picker order. */
export const CARD_PACK_ORDER: CardPackId[] = ["diamond", "gigachad", "apu", "wojak", "stonks", "anime", "aesthetic", "minimal"];

export function packOf(style: CardStyle): CardPackId {
  return CARD_PACK_ORDER.find((id) => CARD_PACKS[id].styles.includes(style)) ?? "minimal";
}

/** A random style from `pack`, never `current` when the pack has others to choose from. */
export function randomStyleFrom(pack: CardPackId, current?: CardStyle): CardStyle {
  const options = CARD_PACKS[pack].styles.filter((s) => s !== current);
  const pool = options.length > 0 ? options : CARD_PACKS[pack].styles;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Every style, in family order. */
export const CARD_STYLES: CardStyle[] = [
  "wolf",
  "wolfpen",
  "wolfyacht",
  "gigachad",
  "stonks",
  "printer",
  "feelsgood",
  "wojak",
  "notover",
  "fine",
  "rainy",
  "anime",
  "kurumi",
  "moonlit",
  "diamond",
  "moneyrain",
  "noir",
  "blush",
  "minimal",
];

export function isCardStyle(value: unknown): value is CardStyle {
  return typeof value === "string" && (CARD_STYLES as string[]).includes(value);
}

export const CARD_STYLE_LABELS: Record<CardStyle, string> = Object.fromEntries(
  CARD_STYLES.map((k) => [k, CARD_THEMES[k].label]),
) as Record<CardStyle, string>;
