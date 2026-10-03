import Redis from "ioredis-mock";
import { PriceCacheService, STALE_AFTER_MS } from "./price-cache.service";

describe("PriceCacheService.applyTick (tick-guard)", () => {
  let redis: InstanceType<typeof Redis>;
  let service: PriceCacheService;

  beforeEach(async () => {
    redis = new Redis();
    await redis.flushall(); // ioredis-mock instances share a default in-memory store unless flushed
    service = new PriceCacheService(redis as any);
  });

  const tick = (overrides: Partial<Parameters<PriceCacheService["applyTick"]>[0]> = {}) => ({
    instrumentId: "BTC",
    price: 100,
    eventTime: 1000,
    receivedTime: 1000,
    providerId: "prov-1",
    isDemo: false,
    ...overrides,
  });

  it("accepts the very first tick for an instrument", async () => {
    const result = await service.applyTick(tick({ price: 100, eventTime: 1000 }));
    expect(result.accepted).toBe(true);
    expect(result.prevPrice).toBe(100); // no prior price -> prevPrice defaults to itself
    expect(result.seq).toBe(1);
  });

  it("accepts a subsequent tick with a later eventTime and reports the correct prevPrice", async () => {
    await service.applyTick(tick({ price: 100, eventTime: 1000 }));
    const result = await service.applyTick(tick({ price: 105, eventTime: 1001 }));
    expect(result.accepted).toBe(true);
    expect(result.prevPrice).toBe(100);
    expect(result.seq).toBe(2);
  });

  it("rejects a duplicate tick with the same eventTime", async () => {
    await service.applyTick(tick({ price: 100, eventTime: 1000 }));
    const result = await service.applyTick(tick({ price: 999, eventTime: 1000 }));
    expect(result.accepted).toBe(false);
  });

  it("rejects an out-of-order tick with an older eventTime than the last accepted one", async () => {
    await service.applyTick(tick({ price: 100, eventTime: 2000 }));
    const result = await service.applyTick(tick({ price: 999, eventTime: 1500 }));
    expect(result.accepted).toBe(false);
  });

  it("rejects a stale/replayed tick after a reconnect (eventTime at or before the last known)", async () => {
    await service.applyTick(tick({ price: 100, eventTime: 5000 }));
    await service.applyTick(tick({ price: 101, eventTime: 5001 }));
    // simulate a reconnect replaying an already-seen tick
    const replay = await service.applyTick(tick({ price: 100, eventTime: 5000 }));
    expect(replay.accepted).toBe(false);
  });

  it("advances seq monotonically only on accepted ticks", async () => {
    const r1 = await service.applyTick(tick({ eventTime: 1 }));
    const r2 = await service.applyTick(tick({ eventTime: 1 })); // rejected duplicate
    const r3 = await service.applyTick(tick({ eventTime: 2 }));
    expect(r1.seq).toBe(1);
    expect(r2.seq).toBe(0);
    expect(r3.seq).toBe(2);
  });

  it("persists the isDemo flag and exposes it on the snapshot", async () => {
    await service.applyTick(tick({ isDemo: true }));
    const snapshot = await service.getSnapshot("BTC");
    expect(snapshot?.isDemo).toBe(true);
  });

  it("reports feedStatus LIVE just after a tick and STALE once the threshold has clearly passed", async () => {
    const now = Date.now();
    await service.applyTick(tick({ eventTime: now }));
    const fresh = await service.getSnapshot("BTC");
    expect(fresh?.feedStatus).toBe("LIVE");

    await service.applyTick(tick({ eventTime: now - STALE_AFTER_MS - 1, price: 200 })); // won't be accepted (older), just proves rejection path is safe
    const staleCheckInstrument = "OLD";
    await service.applyTick(tick({ instrumentId: staleCheckInstrument, eventTime: now - STALE_AFTER_MS - 1_000 }));
    const stale = await service.getSnapshot(staleCheckInstrument);
    expect(stale?.feedStatus).toBe("STALE");
  });
});
