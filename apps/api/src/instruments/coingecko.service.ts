import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "../common/config/env.validation";

export interface CoinGeckoSearchResult {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
  thumb: string | null;
}

export interface CoinGeckoMarketData {
  id: string;
  currentPrice: number;
  marketCap: number | null;
  marketCapRank: number | null;
  priceChangePct24h: number | null;
  high24h: number | null;
  low24h: number | null;
  totalVolume: number | null;
  image: string | null;
}

/**
 * Used for coin discovery/metadata only (spec section 3) - never for live alert evaluation,
 * which relies exclusively on exchange WebSocket streams (BinanceProvider / MockMarketDataProvider).
 */
@Injectable()
export class CoinGeckoService {
  private readonly logger = new Logger(CoinGeckoService.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  /** Top coins by market cap for the Markets list, refreshed at most every MARKET_CAP_TTL_MS. */
  private marketCaps: MarketCapIndex = { byId: new Map(), bySymbol: new Map() };
  private marketCapsFetchedAt = 0;
  private marketCapsRefresh: Promise<void> | null = null;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.baseUrl = config.get("COINGECKO_API_BASE_URL", { infer: true });
    this.apiKey = config.get("COINGECKO_API_KEY", { infer: true });
  }

  private async fetchJson<T>(path: string): Promise<T | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers["x-cg-demo-api-key"] = this.apiKey;
      const res = await fetch(`${this.baseUrl}${path}`, { headers });
      if (!res.ok) {
        this.logger.warn(`CoinGecko request failed: ${path} -> ${res.status}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`CoinGecko request errored: ${path} -> ${(err as Error).message}`);
      return null;
    }
  }

  async search(query: string): Promise<CoinGeckoSearchResult[]> {
    const data = await this.fetchJson<{
      coins: Array<{ id: string; symbol: string; name: string; market_cap_rank: number | null; thumb: string | null }>;
    }>(`/search?query=${encodeURIComponent(query)}`);
    if (!data) return [];
    return data.coins.slice(0, 15).map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      marketCapRank: c.market_cap_rank,
      thumb: c.thumb,
    }));
  }

  async getMarketData(coingeckoIds: string[]): Promise<Map<string, CoinGeckoMarketData>> {
    const result = new Map<string, CoinGeckoMarketData>();
    if (coingeckoIds.length === 0) return result;

    const data = await this.fetchJson<
      Array<{
        id: string;
        current_price: number;
        market_cap: number | null;
        market_cap_rank: number | null;
        price_change_percentage_24h: number | null;
        high_24h: number | null;
        low_24h: number | null;
        total_volume: number | null;
        image: string | null;
      }>
    >(`/coins/markets?vs_currency=usd&ids=${coingeckoIds.join(",")}`);
    if (!data) return result;

    for (const coin of data) {
      result.set(coin.id, {
        id: coin.id,
        currentPrice: coin.current_price,
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        priceChangePct24h: coin.price_change_percentage_24h,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        totalVolume: coin.total_volume,
        image: coin.image,
      });
    }
    return result;
  }

  /**
   * Market cap and rank of the top coins, by CoinGecko id and by ticker (the seed stores no
   * CoinGecko ids, so instruments are matched on their base asset). Served from memory and
   * refreshed in the background every 10 minutes (two requests); the first call waits briefly for
   * data, and after that a slow or failing CoinGecko never holds up the list.
   */
  async getMarketCaps(): Promise<MarketCapIndex> {
    const stale = Date.now() - this.marketCapsFetchedAt > MARKET_CAP_TTL_MS;
    if (stale && !this.marketCapsRefresh) {
      this.marketCapsRefresh = this.refreshMarketCaps().finally(() => {
        this.marketCapsRefresh = null;
      });
    }
    if (this.marketCaps.byId.size === 0 && this.marketCapsRefresh) {
      let timer: NodeJS.Timeout | undefined;
      const wait = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, FIRST_FETCH_WAIT_MS);
      });
      await Promise.race([this.marketCapsRefresh, wait]).finally(() => clearTimeout(timer));
    }
    return this.marketCaps;
  }

  private async refreshMarketCaps(): Promise<void> {
    const byId = new Map<string, MarketCap>();
    const bySymbol = new Map<string, MarketCap>();
    for (let page = 1; page <= MARKET_CAP_PAGES; page++) {
      const coins = await this.fetchJson<Array<{ id: string; symbol: string; market_cap: number | null; market_cap_rank: number | null }>>(
        `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${MARKETS_PAGE_SIZE}&page=${page}`,
      );
      if (!coins) break;
      for (const coin of coins) {
        const cap = { marketCap: coin.market_cap, marketCapRank: coin.market_cap_rank };
        byId.set(coin.id, cap);
        // Pages come biggest first, so a ticker shared by several coins keeps the largest one.
        const symbol = coin.symbol.toUpperCase();
        if (!bySymbol.has(symbol)) bySymbol.set(symbol, cap);
      }
    }
    if (byId.size > 0) {
      this.marketCaps = { byId, bySymbol };
      this.marketCapsFetchedAt = Date.now();
    }
  }
}

export interface MarketCap {
  marketCap: number | null;
  marketCapRank: number | null;
}

export interface MarketCapIndex {
  byId: Map<string, MarketCap>;
  bySymbol: Map<string, MarketCap>;
}

const MARKET_CAP_TTL_MS = 10 * 60 * 1000;
const FIRST_FETCH_WAIT_MS = 2_500;
/** Two pages of 250: every coin a typical exchange lists outside the long tail. */
const MARKET_CAP_PAGES = 2;
/** CoinGecko's /coins/markets returns at most 250 coins per page. */
const MARKETS_PAGE_SIZE = 250;
