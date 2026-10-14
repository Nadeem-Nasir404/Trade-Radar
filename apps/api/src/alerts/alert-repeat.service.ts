import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AlertStatus, Prisma, type Alert, type Instrument } from "@prisma/client";
import { MAX_ALERT_REMINDERS, REPEATABLE_CONDITIONS } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { PriceCacheService } from "../market-data/price-cache/price-cache.service";
import { MarketDataService } from "../market-data/market-data.service";
import { ALERT_TRIGGERED_EVENT, type AlertTriggeredPayload } from "../alert-engine/alert-engine.events";
import { isConditionStillMet } from "../alert-engine/alert-repeat";

type AlertWithInstrument = Alert & { instrument: Instrument };

/**
 * Repeat reminders: after an alert fires, if it has a repeat interval, keep notifying every N
 * minutes while the level is still crossed. A run ends when the user opens the alert in the app
 * (acknowledge), the price moves back past the level, the MAX_ALERT_REMINDERS cap is reached, or
 * the alert is paused/deleted. A reminder goes through the normal pipeline - a new AlertEvent
 * (isReminder) and ALERT_TRIGGERED_EVENT - so every channel and the WS gateway handle it as usual.
 */
@Injectable()
export class AlertRepeatService {
  private readonly logger = new Logger(AlertRepeatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priceCache: PriceCacheService,
    private readonly marketData: MarketDataService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDueReminders(now: Date = new Date()): Promise<void> {
    const candidates = await this.prisma.alert.findMany({
      where: {
        repeatIntervalMinutes: { not: null },
        repeatEndedAt: null,
        lastTriggeredAt: { not: null },
        conditionType: { in: [...REPEATABLE_CONDITIONS] },
        // One-shot alerts sit in TRIGGERED after firing; recurring ones stay ACTIVE between firings.
        OR: [{ status: AlertStatus.TRIGGERED }, { status: AlertStatus.ACTIVE, isRecurring: true }],
      },
      include: { instrument: true },
    });

    for (const alert of candidates) {
      try {
        await this.processAlert(alert, now);
      } catch (err) {
        this.logger.warn(`Reminder for alert ${alert.id} failed: ${(err as Error).message}`);
      }
    }
  }

  /** The user has seen the alert in the app, so its current run of reminders stops. */
  async acknowledge(userId: string, alertId: string): Promise<{ acknowledged: boolean }> {
    const alert = await this.prisma.alert.findFirst({ where: { id: alertId, userId }, include: { instrument: true } });
    if (!alert) throw new NotFoundException("Alert not found");
    if (alert.repeatEndedAt || !alert.lastTriggeredAt) return { acknowledged: false };
    await this.endRun(alert, new Date());
    return { acknowledged: true };
  }

  private async processAlert(alert: AlertWithInstrument, now: Date): Promise<void> {
    const anchor = alert.lastRepeatedAt ?? (alert.lastTriggeredAt as Date);
    if (now.getTime() - anchor.getTime() < (alert.repeatIntervalMinutes as number) * 60_000) return;

    if (alert.repeatCount >= MAX_ALERT_REMINDERS) {
      await this.endRun(alert, now);
      return;
    }

    const snapshot = await this.priceCache.getSnapshot(alert.instrumentId);
    // No fresh price to judge by: try again next minute rather than guess.
    if (!snapshot || snapshot.feedStatus === "STALE") return;

    const stillMet = isConditionStillMet(
      {
        conditionType: alert.conditionType,
        targetValue: Number(alert.targetValue),
        secondaryValue: alert.secondaryValue != null ? Number(alert.secondaryValue) : null,
      },
      snapshot.price,
    );
    if (!stillMet) {
      await this.endRun(alert, now);
      return;
    }

    const next = alert.repeatCount + 1;
    const event = await this.prisma.$transaction(async (tx) => {
      // Claim this reminder: if repeatCount moved since we read it, another API instance running
      // the same cron already sent it.
      const claimed = await tx.alert.updateMany({
        where: { id: alert.id, repeatCount: alert.repeatCount, repeatEndedAt: null },
        data: { repeatCount: next, lastRepeatedAt: now },
      });
      if (claimed.count === 0) return null;
      return tx.alertEvent.create({
        data: {
          alertId: alert.id,
          userId: alert.userId,
          instrumentId: alert.instrumentId,
          providerId: alert.instrument.providerId,
          conditionType: alert.conditionType,
          targetValue: alert.targetValue,
          observedPrice: new Prisma.Decimal(snapshot.price),
          eventTime: now,
          receivedTime: now,
          // Unique per trigger and reminder number, so a retry can never create a duplicate.
          transitionId: `${alert.id}-r${(alert.lastTriggeredAt as Date).getTime()}-${next}`,
          isReminder: true,
        },
      });
    });
    if (!event) return;

    const payload: AlertTriggeredPayload = {
      alertEventId: event.id,
      alertId: alert.id,
      userId: alert.userId,
      instrumentId: alert.instrumentId,
      symbol: alert.instrument.displaySymbol,
      conditionType: alert.conditionType,
      targetValue: alert.targetValue.toString(),
      observedPrice: String(snapshot.price),
      eventTime: now.getTime(),
      deactivated: false,
      isReminder: true,
    };
    this.events.emit(ALERT_TRIGGERED_EVENT, payload);
  }

  /**
   * Stops the current run of reminders. A one-shot alert kept its market feed open only for the
   * reminders (AlertTriggerProcessor), so the feed is released here.
   */
  private async endRun(alert: Alert, now: Date): Promise<void> {
    const ended = await this.prisma.alert.updateMany({
      where: { id: alert.id, repeatEndedAt: null },
      data: { repeatEndedAt: now },
    });
    if (ended.count > 0 && alert.status === AlertStatus.TRIGGERED) {
      await this.marketData.onAlertDeactivated(alert.instrumentId, alert.id);
    }
  }
}
