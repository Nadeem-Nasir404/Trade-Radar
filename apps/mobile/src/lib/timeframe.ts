export const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14_400,
  "1d": 86_400,
  "1w": 604_800,
};

/** Start (unix seconds) of the candle bucket containing `unixSeconds` for a timeframe. */
export function bucketStart(unixSeconds: number, timeframe: string): number {
  const size = TIMEFRAME_SECONDS[timeframe] ?? 3600;
  return Math.floor(unixSeconds / size) * size;
}
