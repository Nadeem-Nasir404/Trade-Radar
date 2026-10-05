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
  high?: string;
  low?: string;
  previous_close?: string;
  percent_change?: string;
  volume?: string;
  timestamp?: number;
  last_quote_at?: number;
}

const TIMEFRAME_MINUTES: Partial<Record<Timeframe, number>> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
  "1w": 10080,
};

const TIMEFRAME_INTERVAL: Record<Timeframe, string> = {
  "1m": "1min",
  "5m": "5min",
  "3m": "3min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
};

const BASE_FALLBACK_PRICES: Record<string, number> = {
  xauusd: 2650.5,
  "xau/usd": 2650.5,
  eurusd: 1.085,
  "eur/usd": 1.085,
  gbpusd: 1.302,
  "gbp/usd": 1.302,
  usdjpy: 152.4,
  "usd/jpy": 152.4,
  spx: 5815.0,
  ndx: 20350.0,
};

@Injectable()
export class TwelveDataProvider implements MarketDataProvider, OnModuleDestroy {
  readonly name = "twelvedata";
  readonly assetTypes = [AssetType.COMMODITY, AssetType.FOREX, AssetType.INDEX];

  private readonly logger = new Logger(TwelveDataProvider.name);
  private readonly apiKey: string | undefined;
  private readonly pollIntervalMs: number;
  private readonly subscribed = new Set<string>();
  private tickHandlers: Array<(tick: NormalizedTick) => void> = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private connected = false;
  private lastMessageAt: number | null = null;
  private lastLatencyMs: number | null = null;

  // Fallback simulator state when TWELVE_DATA_API_KEY is not provided
  private readonly fallbackPrices = new Map<string, number>();

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.apiKey = this.config.get("TWELVE_DATA_API_KEY", { infer: true }) || undefined;
    this.pollIntervalMs = this.config.get("TWELVE_DATA_POLL_INTERVAL_MS", { infer: true }) || 60_000;
  }

  async connect(): Promise<void> {
    this.connected = true;

    if (!this.apiKey) {
      this.logger.warn(
        "TWELVE_DATA_API_KEY not set - running Twelve Data provider in simulated fallback mode for Gold/Forex",
      );
      // Run fallback simulator ticks every 10 seconds for smooth local testing
      this.pollInterval = setInterval(() => void this.pollFallback(), 10_000);
      void this.pollFallback();
      return;
    }

    this.logger.log(`Twelve Data provider connected (Polling every ${this.pollIntervalMs / 1000}s)`);
    this.pollInterval = setInterval(() => void this.pollAll(), this.pollIntervalMs);
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
    if (this.connected && this.subscribed.size > before) {
      if (this.apiKey) void this.pollAll();
      else void this.pollFallback();
    }
  }

  async unsubscribe(providerSymbols: string[]): Promise<void> {
    for (const symbol of providerSymbols) this.subscribed.delete(symbol.toLowerCase());
  }

  async getPrice(): Promise<NormalizedPrice | null> {
    return null;
  }

  private normalizeSymbol(sym: string): string {
    // If symbol has no slash and is 6 chars e.g. "xauusd", format as "XAU/USD"
    const s = sym.toUpperCase();
    if (!s.includes("/") && s.length === 6) {
      return `${s.slice(0, 3)}/${s.slice(3)}`;
    }
    return s;
  }

  private async pollAll(): Promise<void> {
    if (!this.apiKey || this.subscribed.size === 0) return;
    const symbols = [...this.subscribed].map((s) => this.normalizeSymbol(s));
    const start = Date.now();

    try {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${this.apiKey}`;
      const res = await fetch(url);
      if (res.status === 429) {
        this.logger.warn("Twelve Data API rate limit reached (HTTP 429). Will retry on next interval.");
        return;
      }
      if (!res.ok) {
        this.logger.warn(`Twelve Data /quote responded ${res.status}`);
        return;
      }
      const body = (await res.json()) as Record<string, unknown>;
      this.lastLatencyMs = Date.now() - start;

      const quotes: TwelveDataQuote[] =
        symbols.length === 1 && typeof body.symbol === "string"
          ? [body as unknown as TwelveDataQuote]
          : Object.values(body as Record<string, TwelveDataQuote>);

      const now = Date.now();
      for (const quote of quotes) {
        if (!quote || quote.close === undefined || "code" in quote) continue;
        const price = Number(quote.close);
        if (!Number.isFinite(price)) continue;

        this.lastMessageAt = now;
        const volume = quote.volume !== undefined ? Number(quote.volume) : undefined;
        const rawSymbol = quote.symbol.toLowerCase().replace("/", "");
        const tick: NormalizedTick = {
          instrumentId: rawSymbol,
          providerSymbol: quote.symbol.toLowerCase(),
          price,
          eventTime: quote.last_quote_at ? quote.last_quote_at * 1000 : now,
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

  private pollFallback(): void {
    if (this.subscribed.size === 0) return;
    const now = Date.now();
    this.lastMessageAt = now;

    for (const rawSymbol of this.subscribed) {
      const key = rawSymbol.toLowerCase();
      let currentPrice = this.fallbackPrices.get(key) || BASE_FALLBACK_PRICES[key] || 100.0;
      // Walk price randomly by ±0.05%
      const pctChange = (Math.random() - 0.49) * 0.001;
      currentPrice = currentPrice * (1 + pctChange);
      this.fallbackPrices.set(key, currentPrice);

      const tick: NormalizedTick = {
        instrumentId: key,
        providerSymbol: key,
        price: Number(currentPrice.toFixed(currentPrice > 10 ? 2 : 4)),
        eventTime: now,
        receivedTime: now,
        providerId: this.name,
        changePct24h: Number((pctChange * 100).toFixed(2)),
      };
      for (const handler of this.tickHandlers) handler(tick);
    }
  }

  async getHistoricalData(providerSymbol: string, timeframe: Timeframe): Promise<Candle[]> {
    if (!this.apiKey) {
      // Fallback synthetic candles generator
      const intervalMinutes = TIMEFRAME_MINUTES[timeframe] ?? 1440;
      const basePrice = BASE_FALLBACK_PRICES[providerSymbol.toLowerCase()] || 100;
      const candles: Candle[] = [];
      const now = Math.floor(Date.now() / 1000);
      let p = basePrice;
      for (let i = 100; i >= 0; i--) {
        const time = now - i * intervalMinutes * 60;
        const open = p;
        const close = p * (1 + (Math.random() - 0.49) * 0.003);
        const high = Math.max(open, close) * 1.001;
        const low = Math.min(open, close) * 0.999;
        p = close;
        candles.push({ time, open, high, low, close });
      }
      return candles;
    }

    const interval = TIMEFRAME_INTERVAL[timeframe];
    const normSymbol = this.normalizeSymbol(providerSymbol);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(normSymbol)}&interval=${interval}&outputsize=200&apikey=${this.apiKey}`;
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
