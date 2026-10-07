import { Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import { ResilientWorkerHost } from "../../queues/resilient-worker-host";
import type { Job } from "bullmq";
import { NotificationChannelType } from "@prisma/client";
import { QUEUE_NAMES, type NotificationJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationContextService, formatConditionText } from "../notification-context.service";
import { DeliveryStatusService } from "../delivery-status.service";

@Processor(QUEUE_NAMES.NOTIFY_DISCORD, { concurrency: 5 })
export class DiscordProcessor extends ResilientWorkerHost {
  private readonly logger = new Logger(DiscordProcessor.name);

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
      where: { userId_type: { userId: job.data.userId, type: NotificationChannelType.DISCORD } },
    });
    const webhookUrl = (channel?.config as { webhookUrl?: string } | null)?.webhookUrl;
    if (!webhookUrl) {
      await this.deliveryStatus.markFailed(job.data.deliveryId, "User has not connected a Discord webhook", false);
      return;
    }

    const ctx = await this.context.load(job.data.alertEventId, job.data.userId);
    if (!ctx) return;

    const conditionText = formatConditionText(ctx.conditionType, ctx.targetValue);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: `🔔 ${ctx.symbol} ${conditionText}`,
              description: `Observed price: ${ctx.observedPrice}`,
              color: 0x6366f1,
              timestamp: ctx.eventTime.toISOString(),
              footer: { text: "CoinRadar" },
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Discord webhook responded ${res.status}: ${await res.text()}`);
      await this.deliveryStatus.markSent(job.data.deliveryId, Date.now() - start);
    } catch (err) {
      const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
      await this.deliveryStatus.markFailed(job.data.deliveryId, (err as Error).message, willRetry);
      throw err;
    }
  }
}
