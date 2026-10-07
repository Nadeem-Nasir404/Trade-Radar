import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { QUEUE_NAMES, type NotificationJobPayload } from "@levelpulse/shared-types";
import { MailerService } from "../../common/mailer/mailer.service";
import { NotificationContextService, formatConditionText } from "../notification-context.service";
import { DeliveryStatusService } from "../delivery-status.service";
import { buildAlertEmailHtml, buildAlertEmailText } from "../email-templates";

@Processor(QUEUE_NAMES.NOTIFY_EMAIL, { concurrency: 10 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly context: NotificationContextService,
    private readonly deliveryStatus: DeliveryStatusService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<void> {
    const start = Date.now();
    const ctx = await this.context.load(job.data.alertEventId, job.data.userId);
    if (!ctx) {
      this.logger.warn(`No context found for delivery ${job.data.deliveryId} - dropping`);
      return;
    }

    const conditionText = formatConditionText(ctx.conditionType, ctx.targetValue);
    const templateParams = {
      symbol: ctx.symbol,
      conditionType: ctx.conditionType,
      conditionText,
      observedPrice: ctx.observedPrice,
      alertsUrl: `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/alerts`,
      userName: ctx.userName,
    };
    try {
      await this.mailer.send({
        to: ctx.userEmail,
        subject: `🔔 ${ctx.symbol} ${conditionText}`,
        html: buildAlertEmailHtml(templateParams),
        text: buildAlertEmailText(templateParams),
      });
      await this.deliveryStatus.markSent(job.data.deliveryId, Date.now() - start);
    } catch (err) {
      const willRetry = job.attemptsMade < (job.opts.attempts ?? 1) - 1;
      await this.deliveryStatus.markFailed(job.data.deliveryId, (err as Error).message, willRetry);
      throw err;
    }
  }
}
