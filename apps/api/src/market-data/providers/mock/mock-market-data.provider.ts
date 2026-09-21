import { Injectable, Logger } from "@nestjs/common";
import {
  AssetType,
  type Candle,
  type MarketDataProvider,
  type NormalizedPrice,
  type NormalizedTick,
  type ProviderHealth,
  type Timeframe,
} from "@levelpulse/shared-types";

interface MockSymbolState {
  price: number;
  volatilityPct: number; // typical per-tick move, as a fraction of price
  dailyVolumeUsd: number;
  dayOpenPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

/** Seed base prices for the instruments LevelPulse ships out of the box. Any other symbol defaults to 100. */
const BASE_PRICES: Record<string, { price: number; volatilityPct: number; dailyVolumeUsd: number }> = {
  btcusdt: { price: 103_420, volatilityPct: 0.0006, dailyVolumeUsd: 28_000_000_000 },
  ethusdt: { price: 4_821, volatilityPct: 0.0009, dailyVolumeUsd: 14_000_000_000 },
  solusdt: { price: 238, volatilityPct: 0.0015, dailyVolumeUsd: 2_600_000_000 },
  "xau/usd": { price: 3_987, volatilityPct: 0.0002, dailyVolumeUsd: 95_000_000_000 },
};
const DEFAULT_SYMBOL_SEED = { price: 100, volatilityPct: 0.001, dailyVolumeUsd: 50_000_000 };

const TICK_INTERVAL_MS = 1_500;

/**
 * Simulates realistic random-walk price movement for BTC/ETH/SOL/XAU with zero external
 * dependencies, so the entire UI and alert engine are exercisable with no API keys configured.
 * Every tick this emits is tagged isDemo=true end-to-end (see PriceCacheService) - never
 * presented to users as real market data.
 */
@Injectable()
export class MockMarketDataProvider implements MarketDataProvider {
  readonly name = "mock";
  readonly assetTypes = [AssetType.CRYPTO, AssetType.COMMODITY, AssetType.FOREX, AssetType.INDEX];

  private readonly logger = new Logger(MockMarketDataProvider.name);
  private readonly state = new Map<string, MockSymbolState>();
  private readonly subscribed = new Set<string>();
  private tickHandlers: Array<(tick: NormalizedTick) => void> = [];
  private interval: NodeJS.Timeout | null = null;
  private connected = false;
  private lastMessageAt: number | null = null;

  async connect(): Promise<void> {
    this.connected = true;
    this.interval = setInterval(() => this.tickAll(), TICK_INTERVAL_MS);
    this.logger.warn("MockMarketDataProvider connected - serving simulated DEMO data, not real prices");
  }

  async disconnect(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.connected = false;
  }

  async subscribe(providerSymbols: string[]): Promise<void> {
    for (const symbol of providerSymbols) {
      const key = symbol.toLowerCase();
      this.subscribed.add(key);
      if (!this.state.has(key)) {
        const base = BASE_PRICES[key] ?? DEFAULT_SYMBOL_SEED;
        this.state.set(key, { ...base, dayOpenPrice: base.price, high24h: base.price, low24h: base.price, volume24h: base.dailyVolumeUsd });
      }
    }
  }

  async unsubscribe(providerSymbols: string[]): Promise<void> {
    for (const symbol of providerSymbols) this.subscribed.delete(symbol.toLowerCase());
  }

  async getPrice(providerSymbol: string): Promise<NormalizedPrice | null> {
    const state = this.state.get(providerSymbol.toLowerCase());
    if (!state) return null;
    return {
      instrumentId: providerSymbol,
      price: state.price,
      eventTime: Date.now(),
      receivedTime: Date.now(),
      providerId: this.name,
    };
  }

  async getHistoricalData(providerSymbol: string, timeframe: Timeframe): Promise<Candle[]> {
    const state = this.state.get(providerSymbol.toLowerCase()) ?? BASE_PRICES[providerSymbol.toLowerCase()];
    const basePrice = state?.price ?? 100;
    const volatility = "volatilityPct" in (state ?? {}) ? (state as MockSymbolState).volatilityPct : 0.001;
    const bucketSeconds = timeframeToSeconds(timeframe);
    const candles: Candle[] = [];
    let price = basePrice * (1 - volatility * 40);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - bucketSeconds * 200;

    for (let i = 0; i < 200; i++) {
      const open = price;
      const drift = (Math.random() - 0.48) * price * volatility * 4;
      const close = Math.max(open + drift, 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * volatility);
      const low = Math.min(open, close) * (1 - Math.random() * volatility);
      candles.push({
        time: startTime + i * bucketSeconds,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000,
      });
      price = close;
    }
    return candles;
  }

  getHealth(): ProviderHealth {
    return {
      provider: this.name,
      connected: this.connected,
      latencyMs: this.connected ? 5 + Math.round(Math.random() * 10) : null,
      subscribedSymbols: this.subscribed.size,
      lastMessageAt: this.lastMessageAt,
      reconnectCount: 0,
    };
  }

  onTick(handler: (tick: NormalizedTick) => void): void {
    this.tickHandlers.push(handler);
  }

  private tickAll() {
    const now = Date.now();
    for (const symbol of this.subscribed) {
      const state = this.state.get(symbol);
      if (!state) continue;

      const move = (Math.random() - 0.5) * 2 * state.volatilityPct;
      state.price = Math.max(state.price * (1 + move), 0.01);
      state.high24h = Math.max(state.high24h, state.price);
      state.low24h = Math.min(state.low24h, state.price);
      state.volume24h = state.volume24h * 0.985 + Math.random() * 0.03 * state.volume24h; // fluctuates around its baseline rather than drifting away
      this.lastMessageAt = now;

      const tick: NormalizedTick = {
        instrumentId: symbol,
        providerSymbol: symbol,
        price: Number(state.price.toFixed(state.price < 10 ? 6 : 2)),
        eventTime: now,
        receivedTime: now,
        providerId: this.name,
        high24h: state.high24h,
        low24h: state.low24h,
        volume24h: state.volume24h,
        changePct24h: ((state.price - state.dayOpenPrice) / state.dayOpenPrice) * 100,
      };
      for (const handler of this.tickHandlers) handler(tick);
    }
  }
}

function timeframeToSeconds(tf: Timeframe): number {
  switch (tf) {
    case "1m":
      return 60;
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "1h":
      return 3600;
    case "4h":
      return 14_400;
    case "1d":
      return 86_400;
    case "1w":
      return 604_800;
  }
}
