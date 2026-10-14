import { jest } from "@jest/globals";
import { AlertStatus, ConditionType, Prisma } from "@prisma/client";
import { MAX_ALERT_REMINDERS } from "@levelpulse/shared-types";
import { AlertRepeatService } from "./alert-repeat.service";
import { isConditionStillMet, repeatsReminders } from "../alert-engine/alert-repeat";
import { ALERT_TRIGGERED_EVENT } from "../alert-engine/alert-engine.events";

describe("isConditionStillMet", () => {
  const level = (conditionType: string, targetValue: number, secondaryValue: number | null = null) => ({ conditionType, targetValue, secondaryValue });

  it("treats a crossing as its lasting side of the level", () => {
    expect(isConditionStillMet(level("CROSSES_ABOVE", 100), 101)).toBe(true);
    expect(isConditionStillMet(level("CROSSES_ABOVE", 100), 99)).toBe(false);
    expect(isConditionStillMet(level("CROSSES_BELOW", 100), 99)).toBe(true);
    expect(isConditionStillMet(level("BELOW", 100), 100)).toBe(true);
  });

  it("checks inside/outside for ranges", () => {
    expect(isConditionStillMet(level("ENTERS_RANGE", 90, 110), 100)).toBe(true);
    expect(isConditionStillMet(level("ENTERS_RANGE", 90, 110), 120)).toBe(false);
    expect(isConditionStillMet(level("EXITS_RANGE", 90, 110), 120)).toBe(true);
    expect(isConditionStillMet(level("EXITS_RANGE", 90, 110), 100)).toBe(false);
  });

  it("compares % change against the baseline captured at creation", () => {
    expect(isConditionStillMet(level("PCT_CHANGE", 5, 100), 106)).toBe(true);
    expect(isConditionStillMet(level("PCT_CHANGE", 5, 100), 104)).toBe(false);
    expect(isConditionStillMet(level("PCT_CHANGE", -5, 100), 94)).toBe(true);
  });

  it("never repeats one-touch or self-resetting conditions", () => {
    expect(repeatsReminders({ conditionType: "EQUALS", repeatIntervalMinutes: 10 })).toBe(false);
    expect(repeatsReminders({ conditionType: "PCT_CHANGE_WINDOW", repeatIntervalMinutes: 10 })).toBe(false);
    expect(repeatsReminders({ conditionType: "ABOVE", repeatIntervalMinutes: null })).toBe(false);
    expect(repeatsReminders({ conditionType: "ABOVE", repeatIntervalMinutes: 10 })).toBe(true);
  });
});

describe("AlertRepeatService", () => {
  const firedAt = new Date("2026-10-14T10:00:00Z");
  const baseAlert = {
    id: "a1",
    userId: "u1",
    instrumentId: "i1",
    conditionType: ConditionType.CROSSES_ABOVE,
    targetValue: new Prisma.Decimal(100),
    secondaryValue: null,
    status: AlertStatus.TRIGGERED,
    isRecurring: false,
    repeatIntervalMinutes: 10,
    repeatCount: 0,
    lastRepeatedAt: null as Date | null,
    repeatEndedAt: null as Date | null,
    lastTriggeredAt: firedAt,
    instrument: { providerId: "p1", displaySymbol: "BTC/USDT" },
  };

  function setup(alert: Record<string, unknown>, price: number | null, feedStatus = "LIVE") {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const createEvent = jest.fn(async () => ({ id: "ev1" }));
    const tx = { alert: { updateMany }, alertEvent: { create: createEvent } };
    const prisma = {
      alert: { findMany: jest.fn(async () => [alert]), updateMany },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const priceCache = { getSnapshot: jest.fn(async () => (price === null ? null : { price, feedStatus })) };
    const marketData = { onAlertDeactivated: jest.fn(async () => undefined) };
    const events = { emit: jest.fn() };
    const service = new AlertRepeatService(prisma as never, priceCache as never, marketData as never, events as never);
    return { service, updateMany, createEvent, marketData, events };
  }

  it("sends a reminder once the interval has passed and the level is still crossed", async () => {
    const { service, createEvent, events } = setup(baseAlert, 105);
    await service.sendDueReminders(new Date(firedAt.getTime() + 10 * 60_000));
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isReminder: true }) }));
    expect(events.emit).toHaveBeenCalledWith(ALERT_TRIGGERED_EVENT, expect.objectContaining({ isReminder: true, deactivated: false }));
  });

  it("waits until the interval has passed", async () => {
    const { service, createEvent } = setup(baseAlert, 105);
    await service.sendDueReminders(new Date(firedAt.getTime() + 9 * 60_000));
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("ends the run and releases the feed when the price is back below the level", async () => {
    const { service, createEvent, updateMany, marketData } = setup(baseAlert, 95);
    await service.sendDueReminders(new Date(firedAt.getTime() + 10 * 60_000));
    expect(createEvent).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ repeatEndedAt: expect.any(Date) }) }));
    expect(marketData.onAlertDeactivated).toHaveBeenCalledWith("i1", "a1");
  });

  it("skips a stale price instead of guessing", async () => {
    const { service, createEvent, updateMany } = setup(baseAlert, 105, "STALE");
    await service.sendDueReminders(new Date(firedAt.getTime() + 10 * 60_000));
    expect(createEvent).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("stops at the reminder cap", async () => {
    const { service, createEvent, marketData } = setup({ ...baseAlert, repeatCount: MAX_ALERT_REMINDERS }, 105);
    await service.sendDueReminders(new Date(firedAt.getTime() + 60 * 60_000));
    expect(createEvent).not.toHaveBeenCalled();
    expect(marketData.onAlertDeactivated).toHaveBeenCalled();
  });

  it("does not send twice when another instance already claimed the reminder", async () => {
    const { service, createEvent, updateMany, events } = setup(baseAlert, 105);
    updateMany.mockResolvedValueOnce({ count: 0 });
    await service.sendDueReminders(new Date(firedAt.getTime() + 10 * 60_000));
    expect(createEvent).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
