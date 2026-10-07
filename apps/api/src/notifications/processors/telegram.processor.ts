import { Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import { ResilientWorkerHost } from "../../queues/resilient-worker-host";
import { ConfigService } from "@nestjs/config";
import type { Job } from "bullmq";
import { NotificationChannelType } from "@prisma/client";
import { QUEUE_NAMES, type NotificationJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationContextService, formatConditionText } from "../notification-context.service";
import { DeliveryStatusService } from "../delivery-status.service";
import type { EnvConfig } from "../../common/config/env.validation";

@Processor(QUEUE_NAMES.NOTIFY_TELEGRAM, { concurrency: 10 })
export class TelegramProcessor extends ResilientWorkerHost {
  private readonly logger = new Logger(TelegramProcessor.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly context: NotificationContextService,
    private readonly deliveryStatus: DeliveryStatusService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<void> {
    const start = Date.now();
    const botToken = this.config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    if (!botToken) {
      await this.deliveryStatus.markFailed(job.data.deliveryId, "Telegram bot is not configured on this server", false);
      return;
    }

    const channel = await this.prisma.notificationChannel.findUnique({
      where: { userId_type: { userId: job.data.userId, type: NotificationChannelType.TELEGRAM } },
    });
    const chatId = (channel?.config as { chatId?: number } | null)?.chatId;
    if (!chatId) {
      await this.deliveryStatus.markFailed(job.data.deliveryId, "User has not connected Telegram", false);
      return;
    }

    const ctx = await this.context.load(job.data.alertEventId, job.data.userId);
    if (!ctx) return;

    const conditionText = formatConditionText(ctx.conditionType, ctx.targetValue);
    const text = `🔔 *${ctx.symbol}* ${conditionText}\nObserved price: ${ctx.observedPrice}`;

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      });
      if (!res.ok) throw new Error(`Telegram API responded ${res.status}: ${await res.text()}`);
      await this.deliveryStatus.markSent(job.data.deliveryId, Date.now() - start);
    } catch (err) {
      const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
      await this.deliveryStatus.markFailed(job.data.deliveryId, (err as Error).message, willRetry);
      throw err;
    }
  }
}
