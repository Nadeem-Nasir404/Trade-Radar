import { jest } from "@jest/globals";
import type { AlertTriggerJobPayload } from "@levelpulse/shared-types";
import Redis from "ioredis-mock";
import { AlertStatus, ConditionType, type Alert } from "@prisma/client";
import { AlertRegistryService } from "./alert-registry.service";
import { AlertEngineService } from "./alert-engine.service";
import type { MarketTickEvent } from "../market-data/market-data.events";

type QueueAdd = (name: string, payload: AlertTriggerJobPayload, opts?: unknown) => Promise<void>;

function makeAlert(overrides: Partial<Alert> & Pick<Alert, "id" | "userId" | "instrumentId" | "conditionType" | "targetValue">): Alert {
  return {
    alertGroupId: null,
    secondaryValue: null,
    timeframe: null,
    status: AlertStatus.ACTIVE,
    isRecurring: false,
    cooldownSeconds: 0,
    triggerCount: 0,
    lastTriggeredAt: null,
    lastEvaluatedPrice: null,
    expiresAt: null,
    notes: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Alert;
}

function makeTick(overrides: Partial<MarketTickEvent> = {}): MarketTickEvent {
  return {
    instrumentId: "BTC",
    symbol: "BTC/USDT",
    price: 0,
    prevPrice: 0,
    eventTime: Date.now(),
    receivedTime: Date.now(),
    seq: 1,
    providerId: "prov-1",
    providerName: "binance",
    isDemo: false,
    changePct24h: null,
    ...overrides,
  };
}

describe("AlertEngineService.evaluateTick (crossing logic)", () => {
  let redis: InstanceType<typeof Redis>;
  let registry: AlertRegistryService;
  let engine: AlertEngineService;
  let queueAdd: jest.Mock<QueueAdd>;

  beforeEach(async () => {
    redis = new Redis();
    await redis.flushall(); // ioredis-mock instances share a default in-memory store unless flushed
    registry = new AlertRegistryService(redis as any);
    queueAdd = jest.fn<QueueAdd>().mockResolvedValue(undefined);
    engine = new AlertEngineService(registry, { add: queueAdd } as any);
  });

  it("does not trigger while price stays below an ABOVE target", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_500, price: 99_900, seq: 1 }));
    await engine.evaluateTick(makeTick({ prevPrice: 99_900, price: 99_950, seq: 2 }));

    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("triggers exactly once when price cleanly crosses above the target", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.CROSSES_ABOVE, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    // BTC: 99,500 -> 99,900 -> 100,010 -> 100,050 -> 100,200 (per spec section 6 example)
    await engine.evaluateTick(makeTick({ prevPrice: 99_500, price: 99_900, seq: 1 }));
    await engine.evaluateTick(makeTick({ prevPrice: 99_900, price: 100_010, seq: 2 })); // crossing happens here
    await engine.evaluateTick(makeTick({ prevPrice: 100_010, price: 100_050, seq: 3 })); // must NOT re-trigger
    await engine.evaluateTick(makeTick({ prevPrice: 100_050, price: 100_200, seq: 4 })); // must NOT re-trigger

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [, payload] = queueAdd.mock.calls[0];
    expect(payload.alertId).toBe("a1");
    expect(payload.observedPrice).toBe("100010");
  });

  it("triggers exactly once when a single tick jumps clean over the target (skips the exact price)", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_900, price: 100_300, seq: 1 })); // jumps straight over 100,000

    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("triggers a BELOW/CROSSES_BELOW alert only on a genuine downward crossing", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.CROSSES_BELOW, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 100_200, price: 100_050, seq: 1 })); // still above, no trigger
    expect(queueAdd).not.toHaveBeenCalled();

    await engine.evaluateTick(makeTick({ prevPrice: 100_050, price: 99_900, seq: 2 })); // crosses below
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("supports multiple alerts at different thresholds on the same instrument, only firing the ones actually crossed", async () => {
    const alert105 = makeAlert({ id: "a105", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 105_000 as any });
    const alert110 = makeAlert({ id: "a110", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 110_000 as any });
    await registry.register(alert105, 105_000);
    await registry.register(alert110, 110_000);

    await engine.evaluateTick(makeTick({ prevPrice: 104_000, price: 106_000, seq: 1 })); // crosses 105k only

    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd.mock.calls[0][1].alertId).toBe("a105");
  });

  it("supports multiple different users' alerts on the same instrument independently", async () => {
    const alertUser1 = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any });
    const alertUser2 = makeAlert({ id: "a2", userId: "u2", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any });
    await registry.register(alertUser1, 100_000);
    await registry.register(alertUser2, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_000, price: 101_000, seq: 1 }));

    expect(queueAdd).toHaveBeenCalledTimes(2);
    const alertIds = queueAdd.mock.calls.map((c) => c[1].alertId).sort();
    expect(alertIds).toEqual(["a1", "a2"]);
  });

  it("does not trigger a paused alert even though it crossed", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any, status: AlertStatus.PAUSED });
    // A paused alert should never be registered by AlertIndexerService in the first place, but
    // simulate the race where it's still momentarily present in the ZSET.
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_000, price: 101_000, seq: 1 }));

    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("does not trigger an expired alert", async () => {
    const alert = makeAlert({
      id: "a1",
      userId: "u1",
      instrumentId: "BTC",
      conditionType: ConditionType.ABOVE,
      targetValue: 100_000 as any,
      expiresAt: new Date(Date.now() - 1000),
    });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_000, price: 101_000, seq: 1 }));

    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("respects cooldown for recurring alerts - re-arms only after the cooldown window", async () => {
    const alert = makeAlert({
      id: "a1",
      userId: "u1",
      instrumentId: "BTC",
      conditionType: ConditionType.CROSSES_ABOVE,
      targetValue: 100_000 as any,
      isRecurring: true,
      cooldownSeconds: 60,
    });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_000, price: 101_000, seq: 1 }));
    expect(queueAdd).toHaveBeenCalledTimes(1);

    // Price dips back below and crosses again immediately - still within cooldown, must not re-fire.
    await engine.evaluateTick(makeTick({ prevPrice: 101_000, price: 99_000, seq: 2 }));
    await engine.evaluateTick(makeTick({ prevPrice: 99_000, price: 101_500, seq: 3 }));
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("triggers ENTERS_RANGE only on the outside->inside transition, not while sitting inside", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ENTERS_RANGE, targetValue: 95_000 as any, secondaryValue: 97_000 as any });
    await registry.register(alert, 95_000, { lower: 95_000, upper: 97_000 });

    await engine.evaluateTick(makeTick({ prevPrice: 94_000, price: 96_000, seq: 1 })); // enters range -> trigger
    expect(queueAdd).toHaveBeenCalledTimes(1);

    await engine.evaluateTick(makeTick({ prevPrice: 96_000, price: 96_500, seq: 2 })); // still inside -> no re-trigger (also now TRIGGERED/deindexed)
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("triggers EXITS_RANGE only on the inside->outside transition", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.EXITS_RANGE, targetValue: 95_000 as any, secondaryValue: 97_000 as any });
    await registry.register(alert, 95_000, { lower: 95_000, upper: 97_000 });

    await engine.evaluateTick(makeTick({ prevPrice: 96_000, price: 96_500, seq: 1 })); // stays inside -> no trigger
    expect(queueAdd).not.toHaveBeenCalled();

    await engine.evaluateTick(makeTick({ prevPrice: 96_500, price: 97_500, seq: 2 })); // exits above -> trigger
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("triggers an EQUALS alert when the target price lies between prev and curr", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.EQUALS, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 99_998, price: 100_002, seq: 1 }));

    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: the same alertId+seq transition is only ever enqueued once even if evaluated twice", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    const tick = makeTick({ prevPrice: 99_000, price: 101_000, seq: 1 });
    await Promise.all([engine.evaluateTick(tick), engine.evaluateTick(tick)]); // simulate a concurrent duplicate evaluation

    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("does not evaluate when price is unchanged (no movement, nothing could have crossed)", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100_000 as any });
    await registry.register(alert, 100_000);

    await engine.evaluateTick(makeTick({ prevPrice: 100_500, price: 100_500, seq: 1 }));

    expect(queueAdd).not.toHaveBeenCalled();
  });

  it("fires a recurring alert once when two crossing ticks are evaluated at the same moment inside its cooldown", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100 as any, isRecurring: true, cooldownSeconds: 3600 });
    await registry.register(alert, 100);

    await Promise.all([
      engine.evaluateTick(makeTick({ prevPrice: 99, price: 101, seq: 1 })),
      engine.evaluateTick(makeTick({ prevPrice: 99.5, price: 102, seq: 2 })),
    ]);

    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("fires a one-shot alert once when two crossing ticks are evaluated at the same moment", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100 as any });
    await registry.register(alert, 100);

    await Promise.all([
      engine.evaluateTick(makeTick({ prevPrice: 99, price: 101, seq: 1 })),
      engine.evaluateTick(makeTick({ prevPrice: 99.5, price: 102, seq: 2 })),
    ]);

    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("keeps a one-shot alert armed when its trigger job can't be enqueued, so the next crossing fires it", async () => {
    const alert = makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100 as any });
    await registry.register(alert, 100);

    queueAdd.mockRejectedValueOnce(new Error("queue unavailable"));
    await engine.evaluateTick(makeTick({ prevPrice: 99, price: 101, seq: 1 }));
    expect((await registry.getAlertHash("a1"))?.status).toBe("ACTIVE");

    await engine.evaluateTick(makeTick({ prevPrice: 101, price: 99, seq: 2 }));
    await engine.evaluateTick(makeTick({ prevPrice: 99, price: 101, seq: 3 }));
    expect(queueAdd).toHaveBeenCalledTimes(2);
    expect(queueAdd.mock.calls[1][1].transitionId).toBe("a1-3");
  });

  describe("fireIfLevelAlreadyMet", () => {
    const snapshot = (price: number, feedStatus: "LIVE" | "STALE" = "LIVE") =>
      ({ instrumentId: "BTC", price, prevPrice: price, eventTime: 1, receivedTime: 1, providerId: "p", seq: 7, feedStatus, isDemo: false, high24h: null, low24h: null, volume24h: null, changePct24h: null });

    it("fires an ABOVE alert armed while the price is already above its level", async () => {
      await registry.register(makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.ABOVE, targetValue: 100 as any }), 100);
      await engine.fireIfLevelAlreadyMet("a1", ConditionType.ABOVE, snapshot(120));
      expect(queueAdd).toHaveBeenCalledTimes(1);
    });

    it("leaves CROSSES_ABOVE waiting for an actual crossing", async () => {
      await registry.register(makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.CROSSES_ABOVE, targetValue: 100 as any }), 100);
      await engine.fireIfLevelAlreadyMet("a1", ConditionType.CROSSES_ABOVE, snapshot(120));
      expect(queueAdd).not.toHaveBeenCalled();
    });

    it("does not fire on a stale price or when the level isn't met", async () => {
      await registry.register(makeAlert({ id: "a1", userId: "u1", instrumentId: "BTC", conditionType: ConditionType.BELOW, targetValue: 100 as any }), 100);
      await engine.fireIfLevelAlreadyMet("a1", ConditionType.BELOW, snapshot(90, "STALE"));
      await engine.fireIfLevelAlreadyMet("a1", ConditionType.BELOW, snapshot(110));
      expect(queueAdd).not.toHaveBeenCalled();
    });
  });
});
