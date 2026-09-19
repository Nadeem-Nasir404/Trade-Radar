import { randomBytes } from "node:crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { NotificationChannelType } from "@prisma/client";
import { NOTIFICATION_QUEUE_BY_CHANNEL, type NotificationJobPayload } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { InjectRedis } from "../redis/inject-redis.decorator";
import type { EnvConfig } from "../common/config/env.validation";

const TELEGRAM_LINK_TTL_SECONDS = 600;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.EMAIL]) private readonly emailQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.WEBPUSH]) private readonly webpushQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.TELEGRAM]) private readonly telegramQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.DISCORD]) private readonly discordQueue: Queue<NotificationJobPayload>,
    @InjectQueue(NOTIFICATION_QUEUE_BY_CHANNEL[NotificationChannelType.EXPO_PUSH]) private readonly expoPushQueue: Queue<NotificationJobPayload>,
  ) {}

  listChannels(userId: string) {
    return this.prisma.notificationChannel.findMany({ where: { userId } });
  }

  async connectDiscord(userId: string, webhookUrl: string) {
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhookUrl)) {
      throw new BadRequestException("That doesn't look like a Discord webhook URL");
    }
    return this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type: NotificationChannelType.DISCORD } },
      update: { config: { webhookUrl }, isEnabled: true, isVerified: true },
      create: { userId, type: NotificationChannelType.DISCORD, config: { webhookUrl }, isEnabled: true, isVerified: true },
    });
  }

  async setEmailEnabled(userId: string, isEnabled: boolean) {
    return this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type: NotificationChannelType.EMAIL } },
      update: { isEnabled, isVerified: true },
      create: { userId, type: NotificationChannelType.EMAIL, config: {}, isEnabled, isVerified: true },
    });
  }

  async disconnectChannel(userId: string, type: NotificationChannelType) {
    await this.prisma.notificationChannel.deleteMany({ where: { userId, type } });
  }

  /** Generates a short-lived code the user sends to the Telegram bot as `/start <code>` to link their chat. */
  async generateTelegramLinkCode(userId: string): Promise<{ code: string; deepLink: string }> {
    const code = randomBytes(6).toString("hex");
    await this.redis.set(`telegram:link:${code}`, userId, "EX", TELEGRAM_LINK_TTL_SECONDS);
    const botToken = this.config.get("TELEGRAM_BOT_TOKEN", { infer: true });
    const botUsername = botToken ? await this.resolveBotUsername(botToken) : "levelpulse_bot";
    return { code, deepLink: `https://t.me/${botUsername}?start=${code}` };
  }

  private async resolveBotUsername(botToken: string): Promise<string> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = (await res.json()) as { result?: { username?: string } };
      return data.result?.username ?? "levelpulse_bot";
    } catch {
      return "levelpulse_bot";
    }
  }

  /** Called by the Telegram webhook controller when a `/start <code>` message arrives. */
  async completeTelegramLink(code: string, chatId: number): Promise<boolean> {
    const userId = await this.redis.get(`telegram:link:${code}`);
    if (!userId) return false;
    await this.redis.del(`telegram:link:${code}`);
    await this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type: NotificationChannelType.TELEGRAM } },
      update: { config: { chatId }, isEnabled: true, isVerified: true },
      create: { userId, type: NotificationChannelType.TELEGRAM, config: { chatId }, isEnabled: true, isVerified: true },
    });
    return true;
  }

  async subscribeWebPush(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
      create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
    });
    await this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type: NotificationChannelType.WEBPUSH } },
      update: { isEnabled: true, isVerified: true, config: {} },
      create: { userId, type: NotificationChannelType.WEBPUSH, config: {}, isEnabled: true, isVerified: true },
    });
  }

  async unsubscribeWebPush(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Registers/refreshes this device's Expo push token - called by the app right after notification permission is granted. */
  async registerExpoPushToken(userId: string, token: string) {
    return this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type: NotificationChannelType.EXPO_PUSH } },
      update: { config: { token }, isEnabled: true, isVerified: true },
      create: { userId, type: NotificationChannelType.EXPO_PUSH, config: { token }, isEnabled: true, isVerified: true },
    });
  }

  getVapidPublicKey(): string | null {
    return this.config.get("VAPID_PUBLIC_KEY", { infer: true }) ?? null;
  }

  /**
   * Sends a synthetic test notification through a single channel, bypassing the alert-trigger
   * pipeline entirely, by creating a throwaway AlertEvent-shaped delivery job directly.
   */
  async sendTest(userId: string, channelType: NotificationChannelType): Promise<void> {
    const channel = await this.prisma.notificationChannel.findUnique({
      where: { userId_type: { userId, type: channelType } },
    });
    if (channelType !== NotificationChannelType.EMAIL && (!channel || !channel.isEnabled)) {
      throw new BadRequestException(`You haven't connected ${channelType} yet`);
    }

    // A test send has no real AlertEvent, so processors special-case deliveryId === "test".
    const payload: NotificationJobPayload = { alertEventId: "test", userId, deliveryId: "test" };
    const queue = this.queueFor(channelType);
    await queue.add("test", payload);
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
