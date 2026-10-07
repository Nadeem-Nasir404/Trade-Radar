import type { Candle, Timeframe } from "@levelpulse/shared-types";

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
  "1w": 604_800,
};

/** Deterministic 0..1 value from a string (FNV-1a hash fed into mulberry32). */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let t = h + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Price each series' closed bars are anchored to, captured once per bar (see syntheticCandles). */
const barAnchors = new Map<string, { bar: number; price: number }>();

/**
 * Simulated history for demo instruments. Each bar's move is derived from (symbol, timeframe,
 * bar time), so refetching returns the same shape instead of a new random chart, and bars sit on
 * the same epoch-aligned boundaries the charts use for the live bar. Closed bars are anchored to
 * the price seen when the current bar began, so they stay fixed for the whole bar; the current
 * bar runs from that anchor to the live price, leaving no gap where live updates begin.
 */
export function syntheticCandles(symbol: string, timeframe: Timeframe, lastPrice: number, volatility: number, count = 200): Candle[] {
  const bucket = TIMEFRAME_SECONDS[timeframe];
  const currentBar = Math.floor(Date.now() / 1000 / bucket) * bucket;
  const unit = (time: number, salt: string) => seededUnit(`${symbol}|${timeframe}|${time}|${salt}`);
  const step = volatility * Math.sqrt(bucket / 60);

  const seriesKey = `${symbol}|${timeframe}`;
  let anchor = barAnchors.get(seriesKey);
  if (!anchor || anchor.bar !== currentBar) {
    anchor = { bar: currentBar, price: lastPrice };
    barAnchors.set(seriesKey, anchor);
  }

  // Walk backwards from the anchor: bar i's open is its close undone by bar i's own move.
  const candles: Candle[] = [
    {
      time: currentBar,
      open: anchor.price,
      high: Math.max(anchor.price, lastPrice),
      low: Math.min(anchor.price, lastPrice),
      close: lastPrice,
      volume: Math.round(unit(currentBar, "volume") * 1000 * 100) / 100,
    },
  ];
  let close = anchor.price;
  for (let i = 1; i < count; i++) {
    const time = currentBar - i * bucket;
    const move = (unit(time, "move") - 0.5) * 2 * step;
    const open = close / (1 + move);
    const high = Math.max(open, close) * (1 + unit(time, "high") * step * 0.5);
    const low = Math.min(open, close) * (1 - unit(time, "low") * step * 0.5);
    candles.push({ time, open, high, low, close, volume: Math.round(unit(time, "volume") * 1000 * 100) / 100 });
    close = open;
  }
  return candles.reverse();
}
