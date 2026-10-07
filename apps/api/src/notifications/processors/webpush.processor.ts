import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import type { Job } from "bullmq";
import webpush from "web-push";
import { QUEUE_NAMES, type NotificationJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationContextService, formatConditionText } from "../notification-context.service";
import { DeliveryStatusService } from "../delivery-status.service";
import type { EnvConfig } from "../../common/config/env.validation";

@Injectable()
@Processor(QUEUE_NAMES.NOTIFY_WEBPUSH, { concurrency: 25 })
export class WebPushProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(WebPushProcessor.name);
  private configured = false;

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly context: NotificationContextService,
    private readonly deliveryStatus: DeliveryStatusService,
  ) {
    super();
  }

  onModuleInit() {
    const publicKey = this.config.get("VAPID_PUBLIC_KEY", { infer: true });
    const privateKey = this.config.get("VAPID_PRIVATE_KEY", { infer: true });
    if (publicKey && privateKey) {
      webpush.setVapidDetails(this.config.get("VAPID_SUBJECT", { infer: true }), publicKey, privateKey);
      this.configured = true;
    } else {
      this.logger.warn("VAPID keys not set - browser push notifications are disabled until configured");
    }
  }

  async process(job: Job<NotificationJobPayload>): Promise<void> {
    const start = Date.now();
    if (!this.configured) {
      await this.deliveryStatus.markFailed(job.data.deliveryId, "Web push is not configured on this server (missing VAPID keys)", false);
      return;
    }

    const ctx = await this.context.load(job.data.alertEventId, job.data.userId);
    if (!ctx) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId: job.data.userId } });
    if (subscriptions.length === 0) {
      await this.deliveryStatus.markFailed(job.data.deliveryId, "No browser push subscriptions registered for this user", false);
      return;
    }

    const conditionText = formatConditionText(ctx.conditionType, ctx.targetValue);
    const payload = JSON.stringify({
      title: `🔔 ${ctx.symbol} ${conditionText}`,
      body: `Observed price: ${ctx.observedPrice}`,
      url: "/alerts",
    });

    let anySucceeded = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        anySucceeded = true;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
        this.logger.warn(`Push send failed for subscription ${sub.id}: ${(err as Error).message}`);
      }
    }

    if (anySucceeded) {
      await this.deliveryStatus.markSent(job.data.deliveryId, Date.now() - start);
    } else {
      const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
      await this.deliveryStatus.markFailed(job.data.deliveryId, "All push subscriptions failed", willRetry);
      throw new Error("All web push deliveries failed");
    }
  }
}
