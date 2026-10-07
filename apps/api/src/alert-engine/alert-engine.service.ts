import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { ConditionType } from "@prisma/client";
import { QUEUE_NAMES, type AlertTriggerJobPayload } from "@levelpulse/shared-types";
import { MARKET_TICK_EVENT, type MarketTickEvent } from "../market-data/market-data.events";
import { AlertRegistryService, type RegisteredAlert } from "./alert-registry.service";
import type { PriceSnapshot } from "../market-data/price-cache/price-cache.service";

export interface TriggerContext {
  eventTime: number;
  receivedTime: number;
  providerId: string;
}

/**
 * The heart of LevelPulse: reacts to every accepted price tick (already deduplicated/ordered by
 * PriceCacheService upstream in MarketDataService) and fires exactly one BullMQ job per genuine
 * threshold/range crossing. Depends only on AlertRegistryService (Redis) and a BullMQ Queue, so
 * it is fully unit-testable by calling evaluateTick() directly with crafted MarketTickEvent
 * fixtures - no live socket, timers, or Postgres required.
 */
@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private readonly registry: AlertRegistryService,
    @InjectQueue(QUEUE_NAMES.ALERT_TRIGGER) private readonly triggerQueue: Queue<AlertTriggerJobPayload>,
  ) {}

  @OnEvent(MARKET_TICK_EVENT)
  async evaluateTick(tick: MarketTickEvent): Promise<void> {
    const { instrumentId, prevPrice: prev, price: curr, seq } = tick;
    if (prev === curr) return; // no movement -> nothing could have crossed

    const direction: "UP" | "DOWN" = curr > prev ? "UP" : "DOWN";

    await Promise.all([
      this.evaluateThresholdAlerts(instrumentId, prev, curr, direction, seq, tick),
      this.evaluateEqualsAlerts(instrumentId, prev, curr, seq, tick),
      this.evaluateRangeAlerts(instrumentId, prev, curr, seq, tick),
    ]);
  }

  private async evaluateThresholdAlerts(
    instrumentId: string,
    prev: number,
    curr: number,
    direction: "UP" | "DOWN",
    seq: number,
    tick: MarketTickEvent,
  ) {
    // Target only needs to lie in (prev, curr] (or [curr, prev) going down) - this is what
    // correctly catches a price jump that skips clean over the target in one tick.
    const candidateIds =
      direction === "UP"
        ? await this.registry.candidatesAbove(instrumentId, prev, curr)
        : await this.registry.candidatesBelow(instrumentId, curr, prev);

    await Promise.all(candidateIds.map((alertId) => this.triggerAlert(alertId, prev, curr, seq, tick)));
  }

  private async evaluateEqualsAlerts(instrumentId: string, prev: number, curr: number, seq: number, tick: MarketTickEvent) {
    const [lo, hi] = prev < curr ? [prev, curr] : [curr, prev];
    const candidateIds = await this.registry.candidatesEquals(instrumentId, lo, hi);
    await Promise.all(candidateIds.map((alertId) => this.triggerAlert(alertId, prev, curr, seq, tick)));
  }

  private async evaluateRangeAlerts(instrumentId: string, prev: number, curr: number, seq: number, tick: MarketTickEvent) {
    const candidateIds = await this.registry.candidatesRangeNear(instrumentId, prev, curr);
    for (const alertId of candidateIds) {
      const bounds = await this.registry.getRangeBounds(alertId);
      if (!bounds) continue;

      const wasInside = prev >= bounds.lower && prev <= bounds.upper;
      const isInside = curr >= bounds.lower && curr <= bounds.upper;
      if (wasInside === isInside) continue; // no transition -> not a crossing

      const alert = await this.registry.getAlertHash(alertId);
      if (!alert) continue;
      const wantsEnter = alert.conditionType === ConditionType.ENTERS_RANGE;
      if ((wantsEnter && isInside) || (!wantsEnter && wasInside)) {
        await this.triggerAlert(alertId, prev, curr, seq, tick, alert);
      }
    }
  }

  /**
   * ABOVE and BELOW are level conditions ("price is above X"), unlike CROSSES_ABOVE/BELOW: if the
   * live price is already past the level when the alert is armed, it fires now instead of waiting
   * for a crossing that may never come. Called whenever an alert becomes active or its level moves.
   */
  async fireIfLevelAlreadyMet(alertId: string, conditionType: ConditionType, snapshot: PriceSnapshot | null): Promise<void> {
    if (conditionType !== ConditionType.ABOVE && conditionType !== ConditionType.BELOW) return;
    if (!snapshot || snapshot.feedStatus !== "LIVE") return; // never fire on a stale price

    const alert = await this.registry.getAlertHash(alertId);
    if (!alert) return;
    const met = conditionType === ConditionType.ABOVE ? snapshot.price >= alert.targetValue : snapshot.price <= alert.targetValue;
    if (!met) return;

    await this.triggerAlert(alertId, snapshot.price, snapshot.price, snapshot.seq, {
      eventTime: snapshot.eventTime,
      receivedTime: snapshot.receivedTime,
      providerId: snapshot.providerId ?? "unknown",
    }, alert);
  }

  /**
   * Re-checks status/expiry/cooldown, claims the idempotency key, and enqueues the trigger job.
   * Public so PctWindowEvaluatorService (PCT_CHANGE_WINDOW isn't ZSET-indexed, see
   * AlertIndexerService) can reuse the exact same trigger path instead of duplicating it.
   */
  async triggerAlert(
    alertId: string,
    prev: number,
    curr: number,
    seq: number,
    context: TriggerContext,
    preloaded?: RegisteredAlert,
  ): Promise<void> {
    const alert = preloaded ?? (await this.registry.getAlertHash(alertId));
    if (!alert) return; // race: deleted between ZRANGEBYSCORE and here

    // seq is a monotonic per-instrument accepted-tick counter (from PriceCacheService), so
    // {alertId, seq} is deterministic and unique per real crossing event - safe as an
    // idempotency key across reconnects and concurrent evaluator races. Dash-separated (not
    // colon-separated): BullMQ rejects colons in custom job IDs, and this same string is used
    // as the jobId below.
    const transitionId = `${alertId}-${seq}`;
    // Status, expiry, cooldown and idempotency are checked and claimed in one atomic step, so
    // concurrent ticks can't both fire the same alert (see AlertRegistryService.claimTrigger).
    const claim = await this.registry.claimTrigger(alertId, transitionId, Date.now());
    if (!claim.claimed) return;

    const payload: AlertTriggerJobPayload = {
      alertId,
      userId: alert.userId,
      instrumentId: alert.instrumentId,
      conditionType: alert.conditionType,
      targetValue: String(alert.targetValue),
      observedPrice: String(curr),
      previousPrice: String(prev),
      eventTime: context.eventTime,
      receivedTime: context.receivedTime,
      providerId: context.providerId,
      transitionId,
    };

    try {
      await this.triggerQueue.add("trigger", payload, { jobId: transitionId });
    } catch (err) {
      // Undo the claim and keep the alert indexed, so a queue outage delays the alert to its
      // next crossing instead of silently dropping it.
      await this.registry
        .releaseTrigger(alertId, transitionId, claim.previousLastTriggeredAt)
        .catch(() => undefined); // Redis itself down: boot-time reconcile restores the index
      this.logger.error(`Failed to enqueue trigger for alert ${alertId}: ${(err as Error).message}`);
      return;
    }
    if (!alert.isRecurring) await this.registry.unregister(alertId, alert.instrumentId, alert.conditionType);

    this.logger.log(`Alert ${alertId} triggered: ${alert.conditionType} ${alert.targetValue} (observed ${curr})`);
  }
}
