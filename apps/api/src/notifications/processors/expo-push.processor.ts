import { Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import { ResilientWorkerHost } from "../../queues/resilient-worker-host";
import type { Job } from "bullmq";
import { NotificationChannelType } from "@prisma/client";
import { QUEUE_NAMES, type NotificationJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationContextService, formatConditionText } from "../notification-context.service";
import { DeliveryStatusService } from "../delivery-status.service";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Sends via Expo's push service, which relays to FCM (Android) / APNs (iOS) - this is what
 * actually wakes the app when it's fully closed, unlike the WebSocket-driven local notification
 * used while the app process is alive. Requires the project to have FCM V1 credentials uploaded
 * to EAS; without them Expo returns a DeviceNotRegistered/credentials error per-ticket.
 */
@Processor(QUEUE_NAMES.NOTIFY_EXPO_PUSH, { concurrency: 25 })
export class ExpoPushProcessor extends ResilientWorkerHost {
  private readonly logger = new Logger(ExpoPushProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: NotificationContextService,
    private readonly deliveryStatus: DeliveryStatusService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<void> {
    const start = Date.now();
    const channel = await this.prisma.notificationChannel.findUnique({
      where: { userId_type: { userId: job.data.userId, type: NotificationChannelType.EXPO_PUSH } },
    });
    const token = (channel?.config as { token?: string } | null)?.token;
    if (!token) {
      await this.deliveryStatus.markFailed(job.data.deliveryId, "User has not registered a device for push notifications", false);
      return;
    }

    const ctx = await this.context.load(job.data.alertEventId, job.data.userId);
    if (!ctx) return;

    const conditionText = formatConditionText(ctx.conditionType, ctx.targetValue);

    try {
      const res = await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: token,
          title: `${ctx.symbol} ${conditionText}`,
          body: `Observed price: ${ctx.observedPrice}`,
          data: { symbol: ctx.symbol.replace("/", ""), instrumentId: ctx.instrumentId, price: ctx.observedPrice, condition: ctx.conditionType, target: ctx.targetValue },
          sound: "default",
          priority: "high",
          channelId: "default",
        }),
      });
      if (!res.ok) throw new Error(`Expo push API responded ${res.status}: ${await res.text()}`);

      const data = (await res.json()) as { data?: ExpoPushTicket };
      const ticket = data.data;
      if (ticket?.status === "error") throw new Error(ticket.message ?? ticket.details?.error ?? "Expo push ticket error");

      await this.deliveryStatus.markSent(job.data.deliveryId, Date.now() - start);
    } catch (err) {
      const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
      await this.deliveryStatus.markFailed(job.data.deliveryId, (err as Error).message, willRetry);
      throw err;
    }
  }
}
