import { Injectable, NotFoundException } from "@nestjs/common";
import type { AssetType, Instrument } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PriceCacheService, type PriceSnapshot } from "../market-data/price-cache/price-cache.service";

type InstrumentWithRelations = Instrument & {
  provider: { name: string };
  exchange: { name: string } | null;
};

export interface InstrumentListFilters {
  assetType?: AssetType;
  search?: string;
  limit?: number;
}

@Injectable()
export class InstrumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceCache: PriceCacheService,
  ) {}

  async list(filters: InstrumentListFilters) {
    const instruments = await this.prisma.instrument.findMany({
      where: {
        isActive: true,
        assetType: filters.assetType,
        ...(filters.search
          ? {
              OR: [
                { symbol: { contains: filters.search, mode: "insensitive" } },
                { displaySymbol: { contains: filters.search, mode: "insensitive" } },
                { name: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { provider: true, exchange: true },
      orderBy: { symbol: "asc" },
      take: filters.limit ?? 100,
    });

    const snapshots = await this.priceCache.getSnapshots(instruments.map((i) => i.id));

    return instruments.map((instrument) => this.serialize(instrument, snapshots.get(instrument.id)));
  }

  async getBySymbol(symbol: string) {
    const instrument = await this.prisma.instrument.findFirst({
      where: { symbol: { equals: symbol, mode: "insensitive" }, isActive: true },
      include: { provider: true, exchange: true },
    });
    if (!instrument) throw new NotFoundException(`Instrument ${symbol} not found`);
    const snapshot = await this.priceCache.getSnapshot(instrument.id);
    return this.serialize(instrument, snapshot ?? undefined);
  }

  async getById(id: string) {
    const instrument = await this.prisma.instrument.findUnique({
      where: { id },
      include: { provider: true, exchange: true },
    });
    if (!instrument) throw new NotFoundException("Instrument not found");
    return instrument;
  }

  private serialize(instrument: InstrumentWithRelations, snapshot?: PriceSnapshot | null) {
    return {
      id: instrument.id,
      symbol: instrument.symbol,
      displaySymbol: instrument.displaySymbol,
      name: instrument.name,
      assetType: instrument.assetType,
      quoteCurrency: instrument.quoteCurrency,
      provider: instrument.provider.name,
      exchange: instrument.exchange?.name ?? null,
      iconUrl: instrument.iconUrl,
      price: snapshot?.price ?? (instrument.lastPrice ? Number(instrument.lastPrice) : null),
      changePct24h: snapshot?.changePct24h ?? null,
      high24h: snapshot?.high24h ?? null,
      low24h: snapshot?.low24h ?? null,
      volume24h: snapshot?.volume24h ?? null,
      feedStatus: snapshot?.feedStatus ?? "UNKNOWN",
      isDemo: snapshot?.isDemo ?? false,
      lastUpdateAt: snapshot?.eventTime ?? instrument.lastPriceAt?.getTime() ?? null,
    };
  }
}
