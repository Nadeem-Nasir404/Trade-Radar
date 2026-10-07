import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AlertStatus, ConditionType, Prisma, type Alert } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AlertIndexerService } from "../alert-engine/alert-indexer.service";
import { AlertEngineService } from "../alert-engine/alert-engine.service";
import { MarketDataService } from "../market-data/market-data.service";
import { PriceCacheService } from "../market-data/price-cache/price-cache.service";
import type { CreateAlertDto } from "./dto/create-alert.dto";
import type { UpdateAlertDto } from "./dto/update-alert.dto";
import type { ListAlertsDto } from "./dto/list-alerts.dto";

const ALERT_INCLUDE = {
  instrument: { include: { provider: true, exchange: true } },
  channelPrefs: true,
  group: true,
} satisfies Prisma.AlertInclude;

type AlertWithRelations = Prisma.AlertGetPayload<{ include: typeof ALERT_INCLUDE }>;

function isRangeCondition(conditionType: ConditionType) {
  return conditionType === ConditionType.ENTERS_RANGE || conditionType === ConditionType.EXITS_RANGE;
}

function assertValidRange(lower: number, upper: number) {
  if (!(lower < upper)) throw new BadRequestException("A range alert's lower bound must be below its upper bound");
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly indexer: AlertIndexerService,
    private readonly marketData: MarketDataService,
    private readonly priceCache: PriceCacheService,
    private readonly engine: AlertEngineService,
  ) {}

  async create(userId: string, dto: CreateAlertDto) {
    await this.subscriptions.assertCanCreateAlert(userId);

    const instrument = await this.prisma.instrument.findUnique({ where: { id: dto.instrumentId } });
    if (!instrument || !instrument.isActive) throw new NotFoundException("Instrument not found");

    if (isRangeCondition(dto.conditionType)) {
      if (dto.secondaryValue === undefined) throw new BadRequestException("Range alerts require a secondaryValue (the upper bound)");
      assertValidRange(dto.targetValue, dto.secondaryValue);
    }
    await this.assertOwnsGroup(userId, dto.alertGroupId);

    let secondaryValue = dto.secondaryValue;
    if (dto.conditionType === ConditionType.PCT_CHANGE) {
      const snapshot = await this.priceCache.getSnapshot(dto.instrumentId);
      const baseline = snapshot?.price ?? (instrument.lastPrice ? Number(instrument.lastPrice) : null);
      if (!baseline) {
        throw new ForbiddenException("Cannot create a percentage-change alert: no live price available for this instrument yet");
      }
      secondaryValue = baseline; // baseline captured at creation time, see AlertIndexerService
    }

    const alert = await this.prisma.alert.create({
      data: {
        userId,
        instrumentId: dto.instrumentId,
        alertGroupId: dto.alertGroupId,
        conditionType: dto.conditionType,
        targetValue: new Prisma.Decimal(dto.targetValue),
        secondaryValue: secondaryValue !== undefined ? new Prisma.Decimal(secondaryValue) : undefined,
        timeframe: dto.timeframe,
        isRecurring: dto.isRecurring ?? false,
        cooldownSeconds: dto.cooldownSeconds ?? 0,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        notes: dto.notes,
        tags: dto.tags ?? [],
        channelPrefs: {
          create: (
            dto.channels ?? [
              { channelType: "WEBPUSH", isEnabled: true },
              { channelType: "EMAIL", isEnabled: true },
              { channelType: "EXPO_PUSH", isEnabled: true },
            ]
          ).map((c) => ({
            channelType: c.channelType,
            isEnabled: c.isEnabled,
          })),
        },
      },
      include: ALERT_INCLUDE,
    });

    await this.arm(alert);
    return this.serialize(alert);
  }

  async findAllForUser(userId: string, filters: ListAlertsDto) {
    const alerts = await this.prisma.alert.findMany({
      where: {
        userId,
        status: filters.status,
        alertGroupId: filters.alertGroupId,
        instrument: {
          assetType: filters.assetType,
          ...(filters.search
            ? {
                OR: [
                  { symbol: { contains: filters.search, mode: "insensitive" } },
                  { displaySymbol: { contains: filters.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      },
      include: ALERT_INCLUDE,
      orderBy: this.resolveOrderBy(filters.sort),
    });

    const snapshots = await this.priceCache.getSnapshots([...new Set(alerts.map((a) => a.instrumentId))]);
    const serialized = alerts.map((a) => this.serialize(a, snapshots.get(a.instrumentId)));

    if (filters.sort === "nearest") {
      serialized.sort((a, b) => Math.abs(a.distancePct ?? Infinity) - Math.abs(b.distancePct ?? Infinity));
    }
    return serialized;
  }

  private resolveOrderBy(sort?: string): Prisma.AlertOrderByWithRelationInput {
    switch (sort) {
      case "recently_triggered":
        return { lastTriggeredAt: "desc" };
      case "asset":
        return { instrument: { symbol: "asc" } };
      case "recent":
      default:
        return { createdAt: "desc" };
    }
  }

  async findOne(userId: string, id: string) {
    const alert = await this.findOwned(userId, id);
    const snapshot = await this.priceCache.getSnapshot(alert.instrumentId);
    return this.serialize(alert, snapshot ?? undefined);
  }

  private async findOwned(userId: string, id: string): Promise<AlertWithRelations> {
    const alert = await this.prisma.alert.findFirst({ where: { id, userId }, include: ALERT_INCLUDE });
    if (!alert) throw new NotFoundException("Alert not found");
    return alert;
  }

  async update(userId: string, id: string, dto: UpdateAlertDto) {
    const existing = await this.findOwned(userId, id);
    if (isRangeCondition(existing.conditionType)) {
      assertValidRange(dto.targetValue ?? Number(existing.targetValue), dto.secondaryValue ?? Number(existing.secondaryValue));
    }
    await this.assertOwnsGroup(userId, dto.alertGroupId);

    const updated = await this.prisma.alert.update({
      where: { id },
      data: {
        targetValue: dto.targetValue !== undefined ? new Prisma.Decimal(dto.targetValue) : undefined,
        secondaryValue: dto.secondaryValue !== undefined ? new Prisma.Decimal(dto.secondaryValue) : undefined,
        timeframe: dto.timeframe,
        isRecurring: dto.isRecurring,
        cooldownSeconds: dto.cooldownSeconds,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        notes: dto.notes,
        tags: dto.tags,
        alertGroupId: dto.alertGroupId,
        ...(dto.channels
          ? {
              channelPrefs: {
                deleteMany: {},
                create: dto.channels.map((c) => ({ channelType: c.channelType, isEnabled: c.isEnabled })),
              },
            }
          : {}),
      },
      include: ALERT_INCLUDE,
    });

    // Re-index on any change, not just the level: cooldown, expiry and recurrence are read from
    // the Redis copy at trigger time too.
    if (existing.status === AlertStatus.ACTIVE) {
      await this.indexer.deindexAlert(existing.id, existing.instrumentId, existing.conditionType);
      await this.indexer.indexAlert(updated);
      await this.fireIfLevelAlreadyMet(updated);
    }

    return this.serialize(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const alert = await this.findOwned(userId, id);
    await this.indexer.deindexAlert(alert.id, alert.instrumentId, alert.conditionType);
    if (alert.status === AlertStatus.ACTIVE) {
      await this.marketData.onAlertDeactivated(alert.instrumentId, alert.id);
    }
    await this.prisma.alert.delete({ where: { id } });
  }

  async pause(userId: string, id: string) {
    const alert = await this.findOwned(userId, id);
    if (alert.status !== AlertStatus.ACTIVE) throw new ForbiddenException("Only active alerts can be paused");

    await this.indexer.deindexAlert(alert.id, alert.instrumentId, alert.conditionType);
    await this.marketData.onAlertDeactivated(alert.instrumentId, alert.id);
    const updated = await this.prisma.alert.update({ where: { id }, data: { status: AlertStatus.PAUSED }, include: ALERT_INCLUDE });
    return this.serialize(updated);
  }

  async resume(userId: string, id: string) {
    const alert = await this.findOwned(userId, id);
    if (alert.status !== AlertStatus.PAUSED) throw new ForbiddenException("Only paused alerts can be resumed");
    await this.subscriptions.assertCanCreateAlert(userId);

    const updated = await this.prisma.alert.update({ where: { id }, data: { status: AlertStatus.ACTIVE }, include: ALERT_INCLUDE });
    await this.arm(updated);
    return this.serialize(updated);
  }

  async clone(userId: string, id: string) {
    const source = await this.findOwned(userId, id);
    await this.subscriptions.assertCanCreateAlert(userId);

    const cloned = await this.prisma.alert.create({
      data: {
        userId,
        instrumentId: source.instrumentId,
        alertGroupId: source.alertGroupId,
        conditionType: source.conditionType,
        targetValue: source.targetValue,
        secondaryValue: source.secondaryValue,
        timeframe: source.timeframe,
        isRecurring: source.isRecurring,
        cooldownSeconds: source.cooldownSeconds,
        tags: source.tags,
        channelPrefs: {
          create: source.channelPrefs.map((c) => ({ channelType: c.channelType, isEnabled: c.isEnabled })),
        },
      },
      include: ALERT_INCLUDE,
    });

    await this.arm(cloned);
    return this.serialize(cloned);
  }

  // --- Alert groups ---------------------------------------------------------

  async createGroup(userId: string, name: string) {
    return this.prisma.alertGroup.create({ data: { userId, name } });
  }

  async listGroups(userId: string) {
    return this.prisma.alertGroup.findMany({
      where: { userId },
      include: { _count: { select: { alerts: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async setGroupPaused(userId: string, groupId: string, paused: boolean) {
    const group = await this.prisma.alertGroup.findFirst({ where: { id: groupId, userId } });
    if (!group) throw new NotFoundException("Alert group not found");

    const alerts = await this.prisma.alert.findMany({
      where: { alertGroupId: groupId, userId, status: paused ? AlertStatus.ACTIVE : AlertStatus.PAUSED },
    });
    if (!paused) await this.subscriptions.assertCanActivateAlerts(userId, alerts.length);

    for (const alert of alerts) {
      if (paused) {
        await this.indexer.deindexAlert(alert.id, alert.instrumentId, alert.conditionType);
        await this.marketData.onAlertDeactivated(alert.instrumentId, alert.id);
      }
    }

    await this.prisma.alert.updateMany({
      where: { id: { in: alerts.map((a) => a.id) } },
      data: { status: paused ? AlertStatus.PAUSED : AlertStatus.ACTIVE },
    });

    if (!paused) {
      for (const alert of alerts) {
        await this.arm({ ...alert, status: AlertStatus.ACTIVE });
      }
    }

    await this.prisma.alertGroup.update({ where: { id: groupId }, data: { isPaused: paused } });
    return { groupId, affectedAlerts: alerts.length, paused };
  }

  private async assertOwnsGroup(userId: string, groupId: string | undefined | null) {
    if (!groupId) return;
    const group = await this.prisma.alertGroup.findFirst({ where: { id: groupId, userId }, select: { id: true } });
    if (!group) throw new NotFoundException("Alert group not found");
  }

  /** Puts an active alert into the engine's index, keeps its market feed open, and fires it at once if its level is already met. */
  private async arm(alert: Alert) {
    await this.indexer.indexAlert(alert);
    await this.marketData.onAlertActivated(alert.instrumentId, alert.id);
    await this.fireIfLevelAlreadyMet(alert);
  }

  private async fireIfLevelAlreadyMet(alert: Alert) {
    await this.engine.fireIfLevelAlreadyMet(alert.id, alert.conditionType, await this.priceCache.getSnapshot(alert.instrumentId));
  }

  /** Expired alerts leave the engine, release their market feed, and stop counting against the plan limit. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireDueAlerts() {
    const due = await this.prisma.alert.findMany({
      where: { status: AlertStatus.ACTIVE, expiresAt: { lte: new Date() } },
      select: { id: true, instrumentId: true, conditionType: true },
    });
    if (due.length === 0) return;

    await this.prisma.alert.updateMany({
      where: { id: { in: due.map((a) => a.id) }, status: AlertStatus.ACTIVE },
      data: { status: AlertStatus.EXPIRED },
    });
    for (const alert of due) {
      await this.indexer.deindexAlert(alert.id, alert.instrumentId, alert.conditionType);
      await this.marketData.onAlertDeactivated(alert.instrumentId, alert.id);
    }
  }

  private serialize(alert: AlertWithRelations, snapshot?: Awaited<ReturnType<PriceCacheService["getSnapshot"]>>) {
    const currentPrice = snapshot?.price ?? (alert.instrument.lastPrice ? Number(alert.instrument.lastPrice) : null);
    const target = Number(alert.targetValue);
    const distancePct = currentPrice !== null && target !== 0 ? ((currentPrice - target) / target) * 100 : null;

    return {
      id: alert.id,
      instrumentId: alert.instrumentId,
      symbol: alert.instrument.displaySymbol,
      iconUrl: alert.instrument.iconUrl,
      provider: alert.instrument.provider.name,
      exchange: alert.instrument.exchange?.name ?? null,
      assetType: alert.instrument.assetType,
      conditionType: alert.conditionType,
      targetValue: target,
      secondaryValue: alert.secondaryValue ? Number(alert.secondaryValue) : null,
      timeframe: alert.timeframe,
      status: alert.status,
      isRecurring: alert.isRecurring,
      cooldownSeconds: alert.cooldownSeconds,
      triggerCount: alert.triggerCount,
      lastTriggeredAt: alert.lastTriggeredAt,
      expiresAt: alert.expiresAt,
      notes: alert.notes,
      tags: alert.tags,
      alertGroupId: alert.alertGroupId,
      alertGroupName: alert.group?.name ?? null,
      channels: alert.channelPrefs.map((c) => ({ channelType: c.channelType, isEnabled: c.isEnabled })),
      currentPrice,
      distancePct,
      createdAt: alert.createdAt,
    };
  }
}
