import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { NotificationChannelType } from "@prisma/client";
import { NOTIFICATION_QUEUE_BY_CHANNEL, type NotificationJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { ALERT_TRIGGERED_EVENT, type AlertTriggeredPayload } from "../alert-engine/alert-engine.events";

/**
 * Reacts to every persisted AlertEvent and fans it out to whichever channels the alert has
 * enabled AND the user has actually connected - one BullMQ job per channel, each in its own
 * queue, so a slow/rate-limited channel (e.g. Telegram 429s) can never delay another user's
 * email or push notification.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.EMAIL]) private readonly emailQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.WEBPUSH]) private readonly webpushQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.TELEGRAM]) private readonly telegramQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.DISCORD]) private readonly discordQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.EXPO_PUSH]) private readonly expoPushQueue: Queue<NotificationJobPayload>,
  ) {}

  @OnEvent(ALERT_TRIGGERED_EVENT)
  async handleAlertTriggered(payload: AlertTriggeredPayload): Promise<void> {
    const [alertChannelPrefs, connectedChannels] = await Promise.all([
      this.prisma.alertChannelPreference.findMany({ where: { alertId: payload.alertId, isEnabled: true } }),
      this.prisma.notificationChannel.findMany({ where: { userId: payload.userId, isEnabled: true } }),
    ]);

    // Email needs no setup - every account has a verified address - so it's on unless the user
    // has explicitly turned it off (which leaves a disabled row). Without this, users who never
    // touched the toggle silently never got email.
    const emailRowExists = connectedChannels.some((c) => c.type === NotificationChannelType.EMAIL) ||
      (await this.prisma.notificationChannel.count({ where: { userId: payload.userId, type: NotificationChannelType.EMAIL } })) > 0;
    const connectedTypes = new Set(connectedChannels.map((c) => c.type));
    if (!emailRowExists) connectedTypes.add(NotificationChannelType.EMAIL);
    const channelsToNotify = alertChannelPrefs.filter((p) => connectedTypes.has(p.channelType)).map((p) => p.channelType);

    if (channelsToNotify.length === 0) {
      this.logger.debug(`Alert ${payload.alertId} triggered but has no connected+enabled notification channels`);
      return;
    }

    for (const channelType of channelsToNotify) {
      const delivery = await this.prisma.notificationDelivery.create({
        data: { alertEventId: payload.alertEventId, userId: payload.userId, channelType },
      });
      const jobPayload: NotificationJobPayload = { alertEventId: payload.alertEventId, userId: payload.userId, deliveryId: delivery.id };
      await this.queueFor(channelType).add(
        "notify",
        jobPayload,
        { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
      );
    }
  }

  private queueFor(channelType: NotificationChannelType): Queue<NotificationJobPayload> {
    switch (channelType) {
      case NotificationChannelType.EMAIL:
        return this.emailQueue;
      case NotificationChannelType.WEBPUSH:
        return this.webpushQueue;
      case NotificationChannelType.TELEGRAM:
        return this.telegramQueue;
      case NotificationChannelType.DISCORD:
        return this.discordQueue;
      case NotificationChannelType.EXPO_PUSH:
        return this.expoPushQueue;
    }
  }
}
