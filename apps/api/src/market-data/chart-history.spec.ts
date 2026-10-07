import Redis from "ioredis-mock";
import type { Candle } from "@levelpulse/shared-types";
import { syntheticCandles } from "./providers/synthetic-candles";
import { TwelveDataProvider, aggregateCandles } from "./providers/twelvedata/twelvedata.provider";
import { MarketDataService } from "./market-data.service";

describe("syntheticCandles (demo instruments)", () => {
  it("returns the same bars on every call, aligned to bar boundaries, ending at the live price", () => {
    const first = syntheticCandles("xauusd", "1h", 2400, 0.001);
    const second = syntheticCandles("xauusd", "1h", 2400, 0.001);

    expect(second).toEqual(first);
    expect(first.every((c) => c.time % 3600 === 0)).toBe(true);
    expect(first[first.length - 1].close).toBeCloseTo(2400, 8);
    expect(first[first.length - 1].open).toBeCloseTo(first[first.length - 2].close, 8);
    expect(first.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close))).toBe(true);
  });
});

it("keeps closed demo bars fixed while the live price moves within the current bar", () => {
  const before = syntheticCandles("ethusdt", "1d", 3000, 0.001);
  const after = syntheticCandles("ethusdt", "1d", 3050, 0.001);

  expect(after.slice(0, -1)).toEqual(before.slice(0, -1));
  expect(after[after.length - 1]).toMatchObject({ open: before[before.length - 1].open, close: 3050 });
});

describe("aggregateCandles", () => {
  it("merges 1-minute bars into 3-minute bars with correct OHLCV", () => {
    const bars: Candle[] = [
      { time: 180, open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { time: 240, open: 11, high: 15, low: 10, close: 14, volume: 2 },
      { time: 300, open: 14, high: 14, low: 8, close: 9, volume: 3 },
      { time: 360, open: 9, high: 10, low: 9, close: 10, volume: 4 },
    ];
    expect(aggregateCandles(bars, 180)).toEqual([
      { time: 180, open: 10, high: 15, low: 8, close: 9, volume: 6 },
      { time: 360, open: 9, high: 10, low: 9, close: 10, volume: 4 },
    ]);
  });
});

describe("TwelveDataProvider.getHistoricalData", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("requests UTC times and reads them as UTC, oldest bar first", async () => {
    let requested = "";
    global.fetch = (async (url: string) => {
      requested = url;
      return {
        ok: true,
        json: async () => ({
          values: [
            { datetime: "2026-10-07 05:00:00", open: "2", high: "3", low: "1", close: "2.5" },
            { datetime: "2026-10-07 04:00:00", open: "1", high: "2", low: "1", close: "2" },
          ],
        }),
      };
    }) as any;
    const provider = new TwelveDataProvider({ get: (key: string) => (key === "TWELVE_DATA_API_KEY" ? "key" : undefined) } as any);

    const candles = await provider.getHistoricalData("xauusd", "1h");

    expect(requested).toContain("timezone=UTC");
    expect(candles.map((c) => c.time)).toEqual([Date.UTC(2026, 9, 7, 4) / 1000, Date.UTC(2026, 9, 7, 5) / 1000]);
  });
});

describe("MarketDataService.getHistoricalCandles", () => {
  const instrument = { id: "inst-1", providerSymbol: "btcusdt", displaySymbol: "BTC/USDT", providerId: "binance-id" };

  async function makeService(binanceHistory: () => Promise<Candle[]>) {
    const redis = new Redis();
    await redis.flushall();
    const mockProvider = { getHistoricalData: async () => [{ time: 1, open: 1, high: 1, low: 1, close: 1 }] };
    const binance = { getHistoricalData: jestFn(binanceHistory) };
    const service = new MarketDataService(
      {} as any,
      { get: () => false } as any,
      {} as any,
      {} as any,
      {} as any,
      mockProvider as any,
      binance as any,
      {} as any,
      redis as any,
    );
    (service as any).instrumentsById.set(instrument.id, instrument);
    (service as any).instrumentAdapter.set(instrument.id, "binance");
    return { service, binance, redis };
  }

  /** Minimal call-counting wrapper (avoids pulling the jest object into ESM scope). */
  function jestFn<T extends (...args: any[]) => any>(impl: T) {
    const fn = ((...args: Parameters<T>) => {
      fn.calls++;
      return impl(...args);
    }) as T & { calls: number };
    fn.calls = 0;
    return fn;
  }

  const real: Candle[] = [{ time: 60, open: 100, high: 101, low: 99, close: 100.5, volume: 3 }];

  it("serves repeat and concurrent requests from one upstream fetch", async () => {
    const { service, binance } = await makeService(async () => real);
    await Promise.all([service.getHistoricalCandles(instrument.id, "1m"), service.getHistoricalCandles(instrument.id, "1m")]);
    await service.getHistoricalCandles(instrument.id, "1m");
    expect(binance.getHistoricalData.calls).toBe(1);
  });

  it("never substitutes simulated candles for a real instrument when the provider returns nothing", async () => {
    const { service } = await makeService(async () => []);
    expect(await service.getHistoricalCandles(instrument.id, "1h")).toEqual([]);
  });

  it("falls back to the last real candles when a later fetch fails", async () => {
    let fail = false;
    const { service, redis } = await makeService(async () => (fail ? [] : real));
    await service.getHistoricalCandles(instrument.id, "1m");
    for (const key of await redis.keys("candles:inst-1:1m:*")) await redis.del(key); // fresh copy expired
    fail = true;
    expect(await service.getHistoricalCandles(instrument.id, "1m")).toEqual(real);
  });
});
