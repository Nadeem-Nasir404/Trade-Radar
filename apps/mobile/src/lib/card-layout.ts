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
  // With a position size the percent and the dollar amount are both headline numbers;
  // without one the percent fills the space alone.
  pnlPercent: { x: 72, y: 728, fontSize: 150, tracking: -2 },
  pnlPercentSolo: { y: 770, fontSize: 160 },
  pnlUsd: { x: 78, y: 904, fontSize: 72, tracking: -1 },
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
  | "xmr"
  | "apucandle"
  | "wolf"
  | "wolfpen"
  | "wolfyacht"
  | "moneyrain"
  | "diamond"
  | "gigachad"
  | "bateman"
  | "gigaphone"
  | "gigadesk"
  | "stoic"
  | "patrick"
  | "peter"
  | "tom"
  | "feelsgood"
  | "apuyacht"
  | "pepedump"
  | "onepercent"
  | "wojak"
  | "rainy"
  | "fine"
  | "stonks"
  | "catpump"
  | "printer"
  | "bogdanoff"
  | "bear"
  | "kurumi"
  | "atomic"
  | "atomicmoon"
  | "moonlit"
  | "noir"
  | "blush"
  | "minimal";

/** Used when nothing (or a since-removed style) is saved. */
export const DEFAULT_CARD_STYLE: CardStyle = "wolf";

/** Whether the trade is up or down; picks which of a family's artwork shows. */
export type CardOutcome = "profit" | "loss";

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
  /**
   * Which result the artwork is about: a winning meme, a losing one, or either (unset). A family
   * shows its matching artwork for the trade's result - see resolveStyle.
   */
  mood?: CardOutcome;
}

export const CARD_THEMES: Record<CardStyle, CardTheme> = {
  xmr: {
    label: "Chart Check",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#26A69A",
    pillText: "#FFFFFF",
    pillBorder: "#26A69A",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/xmr.jpg"),
    tagline: { profit: "Number go up", loss: "Number go down" },
    corners: true,
    mood: "profit",
  },
  apucandle: {
    label: "Green Candle",
    text: "#111118",
    sub: "#5B6B66",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#15803D",
    pillText: "#FFFFFF",
    pillBorder: "#15803D",
    divider: "#11111822",
    shadow: false,
    fallback: ["#DCFCE7", "#FFFFFF"],
    background: require("../../assets/cards/apucandle.jpg"),
    tagline: { profit: "Green candle energy", loss: "Shrinkage" },
    corners: true,
    mood: "profit",
  },
  bogdanoff: {
    label: "Dump It",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#DC2626",
    pillText: "#FFFFFF",
    pillBorder: "#DC2626",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/bogdanoff.jpg"),
    tagline: { profit: "They sold? Pump it", loss: "Got dumped on" },
    corners: true,
    mood: "loss",
  },
  pepedump: {
    label: "Dump It Apu",
    text: "#FFFFFF",
    sub: "#BFD4F5",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#60A5FA",
    pillText: "#0B1220",
    pillBorder: "#60A5FA",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#141A2A", "#080B14"],
    background: require("../../assets/cards/pepedump.jpg"),
    tagline: { profit: "Pumped it", loss: "Dumped it" },
    corners: true,
    mood: "loss",
  },
  bear: {
    label: "Laser Bear",
    text: "#FFFFFF",
    sub: "#FECACA",
    profit: "#4ADE80",
    loss: "#FECACA",
    pillBg: "#FFFFFF",
    pillText: "#7F1D1D",
    pillBorder: "#FFFFFF",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#7F1D1D", "#2A0707"],
    background: require("../../assets/cards/bear.jpg"),
    tagline: { profit: "Bear trapped", loss: "Bear market" },
    corners: true,
    mood: "loss",
  },
  gigaphone: {
    label: "Giga Call",
    text: "#FFFFFF",
    sub: "#D4D4D8",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#FFFFFF",
    pillText: "#111118",
    pillBorder: "#FFFFFF",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#3F3F46", "#09090B"],
    background: require("../../assets/cards/gigaphone.jpg"),
    tagline: { profit: "Buy everything", loss: "Buy the dip" },
    corners: true,
  },
  gigadesk: {
    label: "Giga Desk",
    text: "#FFFFFF",
    sub: "#D4D4D8",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#FFFFFF",
    pillText: "#111118",
    pillBorder: "#FFFFFF",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#3F3F46", "#09090B"],
    background: require("../../assets/cards/gigadesk.jpg"),
    tagline: { profit: "3am trader", loss: "Still at the desk" },
    corners: true,
  },
  bateman: {
    label: "Bateman",
    text: "#FFFFFF",
    sub: "#E7E5E4",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#B91C1C",
    pillText: "#FFFFFF",
    pillBorder: "#B91C1C",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#3B3530", "#0C0A09"],
    background: require("../../assets/cards/bateman.jpg"),
    tagline: { profit: "Let's see Paul Allen's P&L", loss: "Returning some videotapes" },
    corners: true,
  },
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
    mood: "profit",
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
    mood: "loss",
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
    mood: "loss",
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
    mood: "loss",
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
    mood: "profit",
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
    mood: "profit",
  },
  atomic: {
    label: "Atomic",
    text: "#FFFFFF",
    sub: "#F5D0FE",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#A855F7",
    pillText: "#FFFFFF",
    pillBorder: "#A855F7",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#2A0F3A", "#0A0412"],
    background: require("../../assets/cards/atomic.jpg"),
    tagline: { profit: "I am atomic", loss: "Back to the shadows" },
    corners: true,
  },
  atomicmoon: {
    label: "Atomic Moon",
    text: "#FFFFFF",
    sub: "#A1A1AA",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#DC2626",
    pillText: "#FFFFFF",
    pillBorder: "#DC2626",
    divider: "#FFFFFF2E",
    shadow: false,
    fallback: ["#000000", "#000000"],
    background: require("../../assets/cards/atomicmoon.jpg"),
    tagline: { profit: "Eminence in profit", loss: "Hiding in the shadows" },
    corners: true,
  },
  apuyacht: {
    label: "Yacht Apu",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#0EA5E9",
    pillText: "#FFFFFF",
    pillBorder: "#0EA5E9",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/apuyacht.jpg"),
    tagline: { profit: "Comfy gains", loss: "Still comfy" },
    corners: true,
    mood: "profit",
  },
  catpump: {
    label: "Cat Pump",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#14B8A6",
    pillText: "#04201C",
    pillBorder: "#14B8A6",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/catpump.jpg"),
    tagline: { profit: "Wait, it's pumping?", loss: "Wait, it's dumping?" },
    corners: true,
    mood: "profit",
  },
  onepercent: {
    label: "Up 1%",
    text: "#111118",
    sub: "#5B6B66",
    profit: "#16A34A",
    loss: "#DC2626",
    pillBg: "#15803D",
    pillText: "#FFFFFF",
    pillBorder: "#15803D",
    divider: "#11111822",
    shadow: false,
    fallback: ["#FFFFFF", "#FFFFFF"],
    background: require("../../assets/cards/onepercent.jpg"),
    tagline: { profit: "Up 1%? Retiring", loss: "Down 1%? It's over" },
    corners: true,
    mood: "profit",
  },
  stoic: {
    label: "Stoic",
    text: "#FFFFFF",
    sub: "#D9F99D",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#A3E635",
    pillText: "#142000",
    pillBorder: "#A3E635",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#0B2A12", "#03100A"],
    background: require("../../assets/cards/stoic.jpg"),
    tagline: { profit: "Discipline pays", loss: "Stoic about it" },
    corners: true,
  },
  patrick: {
    label: "Patrick",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#F472B6",
    pillText: "#FFFFFF",
    pillBorder: "#F472B6",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/patrick.jpg"),
    tagline: { profit: "Professional trader", loss: "Back under the rock" },
    corners: true,
    mood: "profit",
  },
  peter: {
    label: "Peter",
    text: "#FFFFFF",
    sub: "#D6DAE6",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#22C55E",
    pillText: "#FFFFFF",
    pillBorder: "#22C55E",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#1F2937", "#0A0A0A"],
    background: require("../../assets/cards/peter.jpg"),
    tagline: { profit: "Mine. All mine.", loss: "Gone. All gone." },
    corners: true,
    mood: "profit",
  },
  tom: {
    label: "Lock In",
    text: "#FFFFFF",
    sub: "#FDE7C2",
    profit: "#4ADE80",
    loss: "#F87171",
    pillBg: "#F59E0B",
    pillText: "#1A1000",
    pillBorder: "#F59E0B",
    divider: "#FFFFFF33",
    shadow: true,
    fallback: ["#3A2A14", "#120C05"],
    background: require("../../assets/cards/tom.jpg"),
    tagline: { profit: "Locked in", loss: "Still locked in" },
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
    mood: "profit",
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
    mood: "profit",
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
    mood: "profit",
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
    mood: "profit",
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
    divider: "#11111822",
    shadow: false,
    fallback: ["#FFFFFF", "#F4F4F6"],
    // Soft colour blobs with a frosted-glass panel behind the numbers.
    background: require("../../assets/cards/minimal.jpg"),
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
 * Styles grouped into families. The picker shows one tile per family. A family's cover is its first
 * style that suits the trade's result; tapping the family shows the cover, tapping again shuffles.
 */
export type CardPackId = "diamond" | "gigachad" | "cartoons" | "apu" | "wojak" | "stonks" | "anime" | "aesthetic" | "minimal";

export const CARD_PACKS: Record<CardPackId, { label: string; styles: CardStyle[] }> = {
  diamond: { label: "Diamond Hands", styles: ["wolf", "wolfpen", "wolfyacht", "moneyrain", "diamond"] },
  gigachad: { label: "Gigachad", styles: ["gigachad", "bateman", "gigaphone", "gigadesk", "stoic"] },
  cartoons: { label: "Cartoons", styles: ["patrick", "peter", "tom"] },
  apu: { label: "Apu", styles: ["feelsgood", "apuyacht", "apucandle", "pepedump"] },
  wojak: { label: "Wojak", styles: ["onepercent", "wojak", "rainy", "fine"] },
  stonks: { label: "Stonks", styles: ["stonks", "catpump", "printer", "xmr", "bogdanoff", "bear"] },
  anime: { label: "Anime", styles: ["kurumi", "atomic", "atomicmoon"] },
  aesthetic: { label: "Aesthetic", styles: ["moonlit", "noir", "blush"] },
  minimal: { label: "Minimal", styles: ["minimal"] },
};

/** Picker order. */
export const CARD_PACK_ORDER: CardPackId[] = ["diamond", "gigachad", "cartoons", "apu", "wojak", "stonks", "anime", "aesthetic", "minimal"];

/** Every style, in family order. */
export const CARD_STYLES: CardStyle[] = CARD_PACK_ORDER.flatMap((id) => CARD_PACKS[id].styles);

export function packOf(style: CardStyle): CardPackId {
  return CARD_PACK_ORDER.find((id) => CARD_PACKS[id].styles.includes(style)) ?? "minimal";
}

function suits(style: CardStyle, outcome: CardOutcome | undefined): boolean {
  const mood = CARD_THEMES[style].mood;
  return outcome == null || mood == null || mood === outcome;
}

/** The family's styles that suit `outcome`; all of them if none do. */
export function stylesFor(pack: CardPackId, outcome?: CardOutcome): CardStyle[] {
  const all = CARD_PACKS[pack].styles;
  const matching = all.filter((s) => suits(s, outcome));
  return matching.length > 0 ? matching : all;
}

/** What the family shows first for `outcome`. */
export function coverFor(pack: CardPackId, outcome?: CardOutcome): CardStyle {
  return stylesFor(pack, outcome)[0];
}

/**
 * The style to draw for the chosen one and the trade's result: the chosen style if it suits, else
 * its family's cover for that result (so a winning meme never sits on a losing trade). Deterministic,
 * so a live card doesn't flicker while the price moves.
 */
export function resolveStyle(style: CardStyle, outcome: CardOutcome): CardStyle {
  if (suits(style, outcome)) return style;
  const cover = coverFor(packOf(style), outcome);
  return suits(cover, outcome) ? cover : style;
}

/** A random suitable style from `pack`, never `current` when the pack has others to choose from. */
export function randomStyleFrom(pack: CardPackId, current?: CardStyle, outcome?: CardOutcome): CardStyle {
  const pool = stylesFor(pack, outcome);
  const options = pool.filter((s) => s !== current);
  const pick = options.length > 0 ? options : pool;
  return pick[Math.floor(Math.random() * pick.length)];
}

export function isCardStyle(value: unknown): value is CardStyle {
  return typeof value === "string" && (CARD_STYLES as string[]).includes(value);
}

export const CARD_STYLE_LABELS: Record<CardStyle, string> = Object.fromEntries(
  CARD_STYLES.map((k) => [k, CARD_THEMES[k].label]),
) as Record<CardStyle, string>;
