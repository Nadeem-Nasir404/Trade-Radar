import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AssetType,
  type Candle,
  type MarketDataProvider,
  type NormalizedPrice,
  type NormalizedTick,
  type ProviderHealth,
  type Timeframe,
} from "@levelpulse/shared-types";
import type { EnvConfig } from "../../../common/config/env.validation";

interface TwelveDataQuote {
  symbol: string;
  close: string;
  high: string;
  low: string;
  previous_close: string;
  percent_change: string;
  volume?: string;
  timestamp?: number;
}

const TIMEFRAME_INTERVAL: Record<Timeframe, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
};

// Free-tier Twelve Data caps out around 800 requests/day and 8/minute. One batched /quote call
// per poll (regardless of how many symbols are subscribed) at this interval stays comfortably
// under both: 120s -> 720 calls/day for any number of symbols in a single request.
const POLL_INTERVAL_MS = 120_000;

/**
 * REST-polling provider for real spot forex/commodity/index quotes (no WebSocket tier on the
 * free plan). Used for instruments Binance has no genuine feed for - e.g. gold is priced here as
 * true XAU/USD spot, not a crypto-token proxy like PAXG that trades at its own premium/spread.
 */
@Injectable()
export class TwelveDataProvider implements MarketDataProvider, OnModuleDestroy {
  readonly name = "twelvedata";
  readonly assetTypes = [AssetType.COMMODITY, AssetType.FOREX, AssetType.INDEX];

  private readonly logger = new Logger(TwelveDataProvider.name);
  private readonly apiKey: string | undefined;
  private readonly subscribed = new Set<string>();
  private tickHandlers: Array<(tick: NormalizedTick) => void> = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private connected = false;
  private lastMessageAt: number | null = null;
  private lastLatencyMs: number | null = null;

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.apiKey = this.config.get("TWELVE_DATA_API_KEY", { infer: true }) || undefined;
  }

  async connect(): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn("TWELVE_DATA_API_KEY not set - instruments routed to Twelve Data will show no live price");
      return;
    }
    this.connected = true;
    this.pollInterval = setInterval(() => void this.pollAll(), POLL_INTERVAL_MS);
    void this.pollAll();
  }

  async disconnect(): Promise<void> {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = null;
    this.connected = false;
  }

  onModuleDestroy() {
    return this.disconnect();
  }

  async subscribe(providerSymbols: string[]): Promise<void> {
    const before = this.subscribed.size;
    for (const symbol of providerSymbols) this.subscribed.add(symbol.toLowerCase());
    if (this.connected && this.subscribed.size > before) void this.pollAll();
  }

  async unsubscribe(providerSymbols: string[]): Promise<void> {
    for (const symbol of providerSymbols) this.subscribed.delete(symbol.toLowerCase());
  }

  async getPrice(): Promise<NormalizedPrice | null> {
    // Live evaluation reads exclusively from PriceCacheService (Redis), which every poll cycle
    // already flows through - this provider does not expose a separate REST price lookup.
    return null;
  }

  private async pollAll(): Promise<void> {
    if (!this.apiKey || this.subscribed.size === 0) return;
    const symbols = [...this.subscribed];
    const start = Date.now();

    try {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`Twelve Data /quote responded ${res.status}`);
        return;
      }
      const body = (await res.json()) as Record<string, unknown>;
      this.lastLatencyMs = Date.now() - start;

      // A single-symbol request returns one quote object flat; multi-symbol returns {symbol: quote}.
      const quotes: TwelveDataQuote[] =
        symbols.length === 1 && typeof body.symbol === "string" ? [body as unknown as TwelveDataQuote] : Object.values(body as Record<string, TwelveDataQuote>);

      const now = Date.now();
      for (const quote of quotes) {
        if (!quote || quote.close === undefined || "code" in quote) continue;
        const price = Number(quote.close);
        if (!Number.isFinite(price)) continue;

        this.lastMessageAt = now;
        const volume = quote.volume !== undefined ? Number(quote.volume) : undefined;
        const tick: NormalizedTick = {
          instrumentId: quote.symbol.toLowerCase(),
          providerSymbol: quote.symbol.toLowerCase(),
          price,
          eventTime: quote.timestamp ? quote.timestamp * 1000 : now,
          receivedTime: now,
          providerId: this.name,
          high24h: quote.high !== undefined ? Number(quote.high) : undefined,
          low24h: quote.low !== undefined ? Number(quote.low) : undefined,
          changePct24h: quote.percent_change !== undefined ? Number(quote.percent_change) : undefined,
          volume24h: volume && volume > 0 ? volume : undefined,
        };
        for (const handler of this.tickHandlers) handler(tick);
      }
    } catch (err) {
      this.logger.warn(`Twelve Data poll failed: ${(err as Error).message}`);
    }
  }

  async getHistoricalData(providerSymbol: string, timeframe: Timeframe): Promise<Candle[]> {
    if (!this.apiKey) return [];
    const interval = TIMEFRAME_INTERVAL[timeframe];
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(providerSymbol)}&interval=${interval}&outputsize=200&apikey=${this.apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const body = (await res.json()) as { values?: Array<{ datetime: string; open: string; high: string; low: string; close: string }> };
      if (!body.values) return [];
      return body.values
        .map((v) => ({
          time: Math.floor(new Date(v.datetime).getTime() / 1000),
          open: Number(v.open),
          high: Number(v.high),
          low: Number(v.low),
          close: Number(v.close),
        }))
        .reverse();
    } catch (err) {
      this.logger.warn(`Failed to fetch Twelve Data time_series for ${providerSymbol}: ${(err as Error).message}`);
      return [];
    }
  }

  getHealth(): ProviderHealth {
    return {
      provider: this.name,
      connected: this.connected,
      latencyMs: this.lastLatencyMs,
      subscribedSymbols: this.subscribed.size,
      lastMessageAt: this.lastMessageAt,
      reconnectCount: 0,
    };
  }

  onTick(handler: (tick: NormalizedTick) => void): void {
    this.tickHandlers.push(handler);
  }
}
