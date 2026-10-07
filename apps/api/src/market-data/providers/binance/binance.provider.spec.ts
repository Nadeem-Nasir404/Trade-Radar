import Redis from "ioredis-mock";
import { AlertStatus, ConditionType, type Alert } from "@prisma/client";
import type { NormalizedTick } from "@levelpulse/shared-types";
import { BinanceProvider } from "./binance.provider";
import { PriceCacheService } from "../../price-cache/price-cache.service";
import { AlertRegistryService } from "../../../alert-engine/alert-registry.service";
import { AlertEngineService } from "../../../alert-engine/alert-engine.service";

function makeProvider() {
  const provider = new BinanceProvider({ get: () => "wss://example.invalid" } as any);
  const ticks: NormalizedTick[] = [];
  provider.onTick((t) => ticks.push(t));
  const deliver = (data: object) => (provider as any).handleMessage(Buffer.from(JSON.stringify({ stream: "x", data })));
  return { ticks, deliver };
}

const aggTrade = (a: number, p: string, T: number) => ({ e: "aggTrade", E: T + 5, s: "BTCUSDT", a, p, T });

describe("BinanceProvider stream parsing", () => {
  it("turns every aggregate trade into a price tick ordered by trade id", () => {
    const { ticks, deliver } = makeProvider();
    deliver(aggTrade(501, "100000.10", 1_700_000_000_000));

    expect(ticks).toEqual([
      expect.objectContaining({ providerSymbol: "btcusdt", price: 100000.1, eventTime: 1_700_000_000_000, providerSeq: 501 }),
    ]);
    expect(ticks[0].statsOnly).toBeUndefined();
  });

  it("turns the 24h ticker into a stats-only update", () => {
    const { ticks, deliver } = makeProvider();
    deliver({ e: "24hrTicker", E: 1, s: "BTCUSDT", c: "100000", o: "98000", P: "2.04", h: "101000", l: "97000", v: "1", q: "5000000" });

    expect(ticks[0]).toMatchObject({ statsOnly: true, open24h: 98000, high24h: 101000, low24h: 97000, volume24h: 5000000 });
  });
});

describe("Binance trades through tick admission and the alert engine", () => {
  it("fires an alert on a spike that crosses the level and comes back within the same second", async () => {
    const redis = new Redis();
    await redis.flushall();
    const priceCache = new PriceCacheService(redis as any);
    const registry = new AlertRegistryService(redis as any);
    const enqueued: string[] = [];
    const engine = new AlertEngineService(registry, { add: async (_name: string, p: { alertId: string }) => void enqueued.push(p.alertId) } as any);

    await registry.register(
      {
        id: "a1",
        userId: "u1",
        instrumentId: "BTC",
        conditionType: ConditionType.ABOVE,
        targetValue: 100_050 as any,
        status: AlertStatus.ACTIVE,
        cooldownSeconds: 0,
        isRecurring: false,
        lastTriggeredAt: null,
        expiresAt: null,
      } as Alert,
      100_050,
    );

    // Four trades inside one second, two of them in the same millisecond. The once-a-second
    // ticker would only have reported the last price (100,000), missing the 100,080 spike.
    const second = 1_700_000_000_000;
    const { ticks, deliver } = makeProvider();
    deliver(aggTrade(1, "100000", second + 10));
    deliver(aggTrade(2, "100080", second + 400));
    deliver(aggTrade(3, "100020", second + 400));
    deliver(aggTrade(4, "100000", second + 900));

    for (const t of ticks) {
      const result = await priceCache.applyTick({ instrumentId: "BTC", price: t.price, eventTime: t.eventTime, receivedTime: t.receivedTime, providerId: "binance", isDemo: false, providerSeq: t.providerSeq });
      expect(result.accepted).toBe(true);
      await engine.evaluateTick({ instrumentId: "BTC", symbol: "BTC/USDT", price: t.price, prevPrice: result.prevPrice, seq: result.seq, eventTime: t.eventTime, receivedTime: t.receivedTime, providerId: "binance", providerName: "binance", isDemo: false, changePct24h: null });
    }

    expect(enqueued).toEqual(["a1"]);
  });
});
