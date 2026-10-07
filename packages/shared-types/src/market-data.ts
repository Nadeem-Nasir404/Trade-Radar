import { AssetType } from "./enums";

/** The normalized internal instrument format every provider adapter must map into. */
export interface NormalizedInstrument {
  id: string;
  symbol: string; // canonical form, e.g. "BTCUSDT"
  displaySymbol: string; // "BTC/USDT"
  assetType: AssetType;
  provider: string; // provider name, e.g. "binance"
  providerSymbol: string; // provider-native form, e.g. "btcusdt"
  quoteCurrency: string | null;
  exchange: string | null;
}

export interface NormalizedPrice {
  instrumentId: string;
  price: number;
  eventTime: number; // ms epoch, exchange-reported tick time
  receivedTime: number; // ms epoch, server ingestion time
  providerId: string;
}

/** Raw tick handed from a provider adapter into MarketDataService.onTick(). */
export interface NormalizedTick {
  instrumentId: string;
  providerSymbol: string;
  price: number;
  eventTime: number;
  receivedTime: number;
  providerId: string;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  changePct24h?: number;
  /** 24h rolling open, so change % can be recomputed against every new trade price. */
  open24h?: number;
  /**
   * Monotonic per-symbol id from the provider (e.g. Binance aggregate trade id). When present,
   * tick admission orders by it instead of eventTime, so trades sharing a millisecond all count.
   */
  providerSeq?: number;
  /** A 24h-stats update that carries no new trade price; it refreshes stats, not the price. */
  statsOnly?: boolean;
}

export interface Candle {
  time: number; // seconds epoch (Lightweight Charts convention)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Timeframe = "1m" | "3m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export interface ProviderHealth {
  provider: string;
  connected: boolean;
  latencyMs: number | null;
  subscribedSymbols: number;
  lastMessageAt: number | null;
  reconnectCount: number;
}

/**
 * Every market-data source (Binance, Coinbase, Kraken, CoinGecko, Twelve Data, Mock) implements
 * this so the alert engine and REST layer never depend on a specific vendor's SDK/protocol.
 */
export interface MarketDataProvider {
  readonly name: string;
  readonly assetTypes: AssetType[];

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(providerSymbols: string[]): Promise<void>;
  unsubscribe(providerSymbols: string[]): Promise<void>;
  getPrice(providerSymbol: string): Promise<NormalizedPrice | null>;
  getHistoricalData(providerSymbol: string, timeframe: Timeframe): Promise<Candle[]>;
  getHealth(): ProviderHealth;

  onTick(handler: (tick: NormalizedTick) => void): void;
}
