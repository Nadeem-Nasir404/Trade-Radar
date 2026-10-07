import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { AlertStatus, DeliveryStatus } from "@prisma/client";
import { QUEUE_NAMES } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { MarketDataService } from "../market-data/market-data.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    @InjectQueue(QUEUE_NAMES.ALERT_TRIGGER) private readonly triggerQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFY_EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFY_WEBPUSH) private readonly webpushQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFY_TELEGRAM) private readonly telegramQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFY_DISCORD) private readonly discordQueue: Queue,
  ) {}

  async getDashboardStats() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalUsers, activeAlerts, triggeredToday, failedNotifications, queueDepths] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.alert.count({ where: { status: AlertStatus.ACTIVE } }),
      this.prisma.alertEvent.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.notificationDelivery.count({ where: { status: DeliveryStatus.FAILED } }),
      this.getQueueDepths(),
    ]);

    return {
      totalUsers,
      activeAlerts,
      triggeredToday,
      failedNotifications,
      providers: this.marketData.getProviderHealth(),
      queueDepths,
    };
  }

  private async getQueueDepths() {
    const queues = {
      alertTrigger: this.triggerQueue,
      notifyEmail: this.emailQueue,
      notifyWebpush: this.webpushQueue,
      notifyTelegram: this.telegramQueue,
      notifyDiscord: this.discordQueue,
    };
    const entries = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => [name, await queue.getWaitingCount()] as const),
    );
    return Object.fromEntries(entries);
  }

  listUsers(search?: string) {
    return this.prisma.user.findMany({
      where: search
        ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }] }
        : undefined,
      include: { subscription: true, _count: { select: { alerts: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async suspendUser(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    // Revoking sessions stops refresh, so access ends when the current access token expires.
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isSuspended: true, suspendedReason: reason } }),
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return updated;
  }

  async unsuspendUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { isSuspended: false, suspendedReason: null } });
  }

  listProviders() {
    return this.prisma.provider.findMany({ orderBy: { priority: "desc" } });
  }

  async setProviderEnabled(providerId: string, isEnabled: boolean) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException("Provider not found");
    return this.prisma.provider.update({ where: { id: providerId }, data: { isEnabled } });
  }

  listInstruments() {
    return this.prisma.instrument.findMany({ include: { provider: true, exchange: true }, orderBy: { symbol: "asc" } });
  }

  async setInstrumentActive(instrumentId: string, isActive: boolean) {
    const instrument = await this.prisma.instrument.findUnique({ where: { id: instrumentId } });
    if (!instrument) throw new NotFoundException("Instrument not found");
    return this.prisma.instrument.update({ where: { id: instrumentId }, data: { isActive } });
  }

  listFailedNotifications() {
    return this.prisma.notificationDelivery.findMany({
      where: { status: DeliveryStatus.FAILED },
      include: { alertEvent: { include: { alert: { include: { instrument: true } } } }, user: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  listSystemEvents() {
    return this.prisma.systemEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  }
}
