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
}
