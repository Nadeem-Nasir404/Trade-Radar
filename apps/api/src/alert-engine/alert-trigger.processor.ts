import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job } from "bullmq";
import { AlertStatus, Prisma } from "@prisma/client";
import { QUEUE_NAMES, type AlertTriggerJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { ALERT_TRIGGERED_EVENT, type AlertTriggeredPayload } from "./alert-engine.events";

/**
 * Consumes QUEUE_NAMES.ALERT_TRIGGER. This is the durability boundary: AlertEngineService's
 * Redis-only hot path has already decided a crossing genuinely happened and claimed the
 * idempotency key, so this processor's only job is to make it permanent in Postgres and hand
 * off to notifications - never to re-derive whether the alert should have fired.
 */
// Jobs are independent (idempotent per transition), so a burst of triggers on one level -
// hundreds of users' alerts at the same round number - is persisted in parallel, not in a line.
@Processor(QUEUE_NAMES.ALERT_TRIGGER, { concurrency: 25 })
export class AlertTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertTriggerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<AlertTriggerJobPayload>): Promise<void> {
    const data = job.data;

    // BullMQ's jobId-based dedup (jobId: transitionId) means a retried/duplicate job is not
    // re-added, but guard here too in case of at-least-once redelivery after a crash mid-job.
    const existing = await this.prisma.alertEvent.findUnique({ where: { transitionId: data.transitionId } });
    if (existing) {
      this.logger.warn(`AlertEvent for transition ${data.transitionId} already exists - skipping duplicate job`);
      return;
    }

    const alert = await this.prisma.alert.findUnique({
      where: { id: data.alertId },
      include: { instrument: true },
    });
    if (!alert) {
      this.logger.warn(`Alert ${data.alertId} no longer exists - dropping trigger job`);
      return;
    }

    const alertEvent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.alertEvent.create({
        data: {
          alertId: data.alertId,
          userId: data.userId,
          instrumentId: data.instrumentId,
          providerId: data.providerId,
          conditionType: alert.conditionType,
          targetValue: new Prisma.Decimal(data.targetValue),
          observedPrice: new Prisma.Decimal(data.observedPrice),
          previousPrice: new Prisma.Decimal(data.previousPrice),
          eventTime: new Date(data.eventTime),
          receivedTime: new Date(data.receivedTime),
          transitionId: data.transitionId,
        },
      });

      await tx.alert.update({
        where: { id: data.alertId },
        data: {
          triggerCount: { increment: 1 },
          lastTriggeredAt: new Date(data.eventTime),
          lastEvaluatedPrice: new Prisma.Decimal(data.observedPrice),
          status: alert.isRecurring ? alert.status : AlertStatus.TRIGGERED,
        },
      });

      return created;
    });

    const payload: AlertTriggeredPayload = {
      alertEventId: alertEvent.id,
      alertId: data.alertId,
      userId: data.userId,
      instrumentId: data.instrumentId,
      symbol: alert.instrument.displaySymbol,
      conditionType: data.conditionType,
      targetValue: data.targetValue,
      observedPrice: data.observedPrice,
      eventTime: data.eventTime,
      deactivated: !alert.isRecurring,
    };
    this.events.emit(ALERT_TRIGGERED_EVENT, payload);
  }
}
