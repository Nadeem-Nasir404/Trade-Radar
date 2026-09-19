import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface ListAlertEventsFilters {
  instrumentId?: string;
  alertId?: string;
  limit?: number;
  cursor?: string;
}

const EVENT_INCLUDE = {
  alert: true,
  provider: true,
  exchange: true,
  deliveries: true,
} satisfies Prisma.AlertEventInclude;

type AlertEventWithRelations = Prisma.AlertEventGetPayload<{ include: typeof EVENT_INCLUDE }>;

@Injectable()
export class AlertEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: ListAlertEventsFilters) {
    const events = await this.prisma.alertEvent.findMany({
      where: { userId, instrumentId: filters.instrumentId, alertId: filters.alertId },
      include: EVENT_INCLUDE,
      orderBy: { eventTime: "desc" },
      take: (filters.limit ?? 50) + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const instruments = await this.prisma.instrument.findMany({
      where: { id: { in: [...new Set(events.map((e) => e.instrumentId))] } },
    });
    const instrumentById = new Map(instruments.map((i) => [i.id, i]));

    const hasMore = events.length > (filters.limit ?? 50);
    const page = hasMore ? events.slice(0, -1) : events;

    return {
      items: page.map((event) => this.serialize(event, instrumentById.get(event.instrumentId))),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getOne(userId: string, id: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id, userId },
      include: EVENT_INCLUDE,
    });
    if (!event) throw new NotFoundException("Alert event not found");
    const instrument = await this.prisma.instrument.findUnique({ where: { id: event.instrumentId } });
    return this.serialize(event, instrument ?? undefined);
  }

  private serialize(event: AlertEventWithRelations, instrument?: { symbol: string; displaySymbol: string } | null) {
    return {
      id: event.id,
      alertId: event.alertId,
      instrumentId: event.instrumentId,
      symbol: instrument?.displaySymbol ?? instrument?.symbol ?? event.instrumentId,
      conditionType: event.conditionType,
      targetValue: Number(event.targetValue),
      observedPrice: Number(event.observedPrice),
      previousPrice: event.previousPrice ? Number(event.previousPrice) : null,
      provider: event.provider.name,
      exchange: event.exchange?.name ?? null,
      eventTime: event.eventTime,
      receivedTime: event.receivedTime,
      latencyMs: Math.max(0, event.receivedTime.getTime() - event.eventTime.getTime()),
      deliveries: event.deliveries.map((d) => ({
        channelType: d.channelType,
        status: d.status,
        sentAt: d.sentAt,
        latencyMs: d.latencyMs,
        failReason: d.failReason,
      })),
    };
  }
}
