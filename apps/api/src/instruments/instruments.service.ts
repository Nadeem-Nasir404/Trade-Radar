import { Injectable, NotFoundException } from "@nestjs/common";
import type { AssetType, Instrument } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PriceCacheService, type PriceSnapshot } from "../market-data/price-cache/price-cache.service";
import { CoinGeckoService, type MarketCap, type MarketCapIndex } from "./coingecko.service";

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
    private readonly coingecko: CoinGeckoService,
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

    const [snapshots, caps] = await Promise.all([this.priceCache.getSnapshots(instruments.map((i) => i.id)), this.coingecko.getMarketCaps()]);

    return instruments.map((instrument) => this.serialize(instrument, snapshots.get(instrument.id), marketCapFor(instrument, caps)));
  }

  /** The instrument row alone - no price snapshot, so callers that only need its id never touch Redis. */
  async findActiveBySymbol(symbol: string): Promise<InstrumentWithRelations> {
    const instrument = await this.prisma.instrument.findFirst({
      where: { symbol: { equals: symbol, mode: "insensitive" }, isActive: true },
      include: { provider: true, exchange: true },
    });
    if (!instrument) throw new NotFoundException(`Instrument ${symbol} not found`);
    return instrument;
  }

  async getBySymbol(symbol: string) {
    const instrument = await this.findActiveBySymbol(symbol);
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

  private serialize(instrument: InstrumentWithRelations, snapshot?: PriceSnapshot | null, cap?: MarketCap) {
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
      // From CoinGecko, for sorting the Markets list; null for coins without a CoinGecko id (gold, forex).
      marketCap: cap?.marketCap ?? null,
      marketCapRank: cap?.marketCapRank ?? null,
      feedStatus: snapshot?.feedStatus ?? "UNKNOWN",
      isDemo: snapshot?.isDemo ?? false,
      lastUpdateAt: snapshot?.eventTime ?? instrument.lastPriceAt?.getTime() ?? null,
    };
  }
}

/** A coin's market cap: by its CoinGecko id when set, else by its base asset's ticker. */
function marketCapFor(instrument: Instrument, caps: MarketCapIndex): MarketCap | undefined {
  if (instrument.coingeckoId) return caps.byId.get(instrument.coingeckoId);
  if (instrument.assetType !== "CRYPTO" || !instrument.baseCurrency) return undefined;
  return caps.bySymbol.get(instrument.baseCurrency.toUpperCase());
}
