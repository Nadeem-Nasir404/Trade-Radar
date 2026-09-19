import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { ConditionType } from "@prisma/client";
import { QUEUE_NAMES, type AlertTriggerJobPayload } from "@levelpulse/shared-types";
import { MARKET_TICK_EVENT, type MarketTickEvent } from "../market-data/market-data.events";
import { AlertRegistryService, type RegisteredAlert } from "./alert-registry.service";

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

    if (alert.status !== "ACTIVE") return; // race guard vs pause/delete/already-triggered
    if (alert.expiresAt && Date.now() > alert.expiresAt) return;
    if (alert.cooldownSeconds > 0 && alert.lastTriggeredAt) {
      const secondsSinceLastTrigger = (Date.now() - alert.lastTriggeredAt) / 1000;
      if (secondsSinceLastTrigger < alert.cooldownSeconds) return;
    }

    // seq is a monotonic per-instrument accepted-tick counter (from PriceCacheService), so
    // {alertId, seq} is deterministic and unique per real crossing event - safe as an
    // idempotency key across reconnects and concurrent evaluator races. Dash-separated (not
    // colon-separated): BullMQ rejects colons in custom job IDs, and this same string is used
    // as the jobId below.
    const transitionId = `${alertId}-${seq}`;
    const claimed = await this.registry.claimIdempotency(alertId, transitionId);
    if (!claimed) return;

    await this.registry.markTriggered(alertId, Date.now());
    if (!alert.isRecurring) {
      await this.registry.markStatus(alertId, "TRIGGERED");
      await this.registry.unregister(alertId, alert.instrumentId, alert.conditionType);
    }

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

    await this.triggerQueue.add("trigger", payload, { jobId: transitionId });
    this.logger.log(`Alert ${alertId} triggered: ${alert.conditionType} ${alert.targetValue} (observed ${curr})`);
  }
}
