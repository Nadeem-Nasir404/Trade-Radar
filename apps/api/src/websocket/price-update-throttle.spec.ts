import { jest } from "@jest/globals";
import type { PriceUpdateEvent } from "@levelpulse/shared-types";
import { PriceUpdateThrottle } from "./price-update-throttle";

const tick = (price: number, eventTime: number, instrumentId = "BTC"): PriceUpdateEvent => ({
  instrumentId,
  symbol: "BTC/USDT",
  price,
  prevPrice: price,
  changePct24h: null,
  eventTime,
});

describe("PriceUpdateThrottle", () => {
  let sent: PriceUpdateEvent[];
  let throttle: PriceUpdateThrottle;

  beforeEach(() => {
    jest.useFakeTimers();
    sent = [];
    throttle = new PriceUpdateThrottle((u) => sent.push(u), 250);
  });
  afterEach(() => jest.useRealTimers());

  it("sends the first update at once and the latest of a burst on the trailing edge", () => {
    throttle.push(tick(100, 1));
    throttle.push(tick(101, 2));
    throttle.push(tick(102, 3));
    expect(sent.map((u) => u.price)).toEqual([100]);

    jest.advanceTimersByTime(250);
    expect(sent.map((u) => u.price)).toEqual([100, 102]);
    expect(sent[1].prevPrice).toBe(100);
  });

  it("carries the spike between samples as the window high/low", () => {
    throttle.push(tick(100, 1_000));
    throttle.push(tick(130, 1_050)); // spike up, never sent on its own
    throttle.push(tick(90, 1_100)); // spike down
    throttle.push(tick(101, 1_200));
    jest.advanceTimersByTime(250);

    expect(sent[0]).toMatchObject({ price: 100, windowHigh: 100, windowLow: 100, windowStartTime: 1_000 });
    expect(sent[1]).toMatchObject({ price: 101, windowHigh: 130, windowLow: 90, windowStartTime: 1_050 });
  });

  it("starts a fresh window after each send", () => {
    throttle.push(tick(100, 1));
    throttle.push(tick(150, 2));
    jest.advanceTimersByTime(250);
    throttle.push(tick(105, 3));
    jest.advanceTimersByTime(250);

    expect(sent[2]).toMatchObject({ price: 105, windowHigh: 105, windowLow: 105, windowStartTime: 3 });
  });

  it("throttles each instrument independently", () => {
    throttle.push(tick(100, 1, "BTC"));
    throttle.push(tick(3000, 1, "ETH"));
    expect(sent.map((u) => u.instrumentId)).toEqual(["BTC", "ETH"]);
  });
});
