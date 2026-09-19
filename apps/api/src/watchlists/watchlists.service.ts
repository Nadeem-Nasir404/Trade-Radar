import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AlertStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { PriceCacheService } from "../market-data/price-cache/price-cache.service";

@Injectable()
export class WatchlistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly priceCache: PriceCacheService,
  ) {}

  async list(userId: string) {
    const watchlists = await this.prisma.watchlist.findMany({
      where: { userId },
      include: { items: { include: { instrument: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });

    const instrumentIds = [...new Set(watchlists.flatMap((w) => w.items.map((i) => i.instrumentId)))];
    const [snapshots, alertCounts] = await Promise.all([
      this.priceCache.getSnapshots(instrumentIds),
      this.alertCountsByInstrument(userId, instrumentIds),
    ]);

    return watchlists.map((w) => ({
      id: w.id,
      name: w.name,
      isDefault: w.isDefault,
      items: w.items.map((item) => {
        const snapshot = snapshots.get(item.instrumentId);
        return {
          id: item.id,
          instrumentId: item.instrumentId,
          symbol: item.instrument.displaySymbol,
          iconUrl: item.instrument.iconUrl,
          assetType: item.instrument.assetType,
          price: snapshot?.price ?? (item.instrument.lastPrice ? Number(item.instrument.lastPrice) : null),
          changePct24h: snapshot?.changePct24h ?? null,
          alertCount: alertCounts.get(item.instrumentId) ?? 0,
          sortOrder: item.sortOrder,
        };
      }),
    }));
  }

  private async alertCountsByInstrument(userId: string, instrumentIds: string[]): Promise<Map<string, number>> {
    if (instrumentIds.length === 0) return new Map();
    const grouped = await this.prisma.alert.groupBy({
      by: ["instrumentId"],
      where: { userId, instrumentId: { in: instrumentIds }, status: AlertStatus.ACTIVE },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.instrumentId, g._count._all]));
  }

  async create(userId: string, name: string) {
    await this.subscriptions.assertCanCreateWatchlist(userId);
    const count = await this.prisma.watchlist.count({ where: { userId } });
    return this.prisma.watchlist.create({ data: { userId, name, isDefault: count === 0, sortOrder: count } });
  }

  async remove(userId: string, id: string) {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id, userId } });
    if (!watchlist) throw new NotFoundException("Watchlist not found");
    await this.prisma.watchlist.delete({ where: { id } });
  }

  async addItem(userId: string, watchlistId: string, instrumentId: string) {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!watchlist) throw new NotFoundException("Watchlist not found");

    const instrument = await this.prisma.instrument.findUnique({ where: { id: instrumentId } });
    if (!instrument) throw new NotFoundException("Instrument not found");

    const count = await this.prisma.watchlistItem.count({ where: { watchlistId } });
    return this.prisma.watchlistItem.upsert({
      where: { watchlistId_instrumentId: { watchlistId, instrumentId } },
      update: {},
      create: { watchlistId, instrumentId, sortOrder: count },
    });
  }

  async removeItem(userId: string, watchlistId: string, itemId: string) {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!watchlist) throw new NotFoundException("Watchlist not found");
    await this.prisma.watchlistItem.deleteMany({ where: { id: itemId, watchlistId } });
  }

  async reorder(userId: string, watchlistId: string, itemIdsInOrder: string[]) {
    const watchlist = await this.prisma.watchlist.findFirst({ where: { id: watchlistId, userId }, include: { items: true } });
    if (!watchlist) throw new NotFoundException("Watchlist not found");

    const validIds = new Set(watchlist.items.map((i) => i.id));
    if (itemIdsInOrder.some((id) => !validIds.has(id))) {
      throw new ForbiddenException("Reorder list contains items that don't belong to this watchlist");
    }

    await this.prisma.$transaction(
      itemIdsInOrder.map((id, index) => this.prisma.watchlistItem.update({ where: { id }, data: { sortOrder: index } })),
    );
  }
}
