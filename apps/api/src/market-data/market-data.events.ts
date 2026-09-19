export const MARKET_TICK_EVENT = "market.tick";
export const MARKET_STALE_EVENT = "market.stale";
export const MARKET_RESUMED_EVENT = "market.resumed";

/** Emitted by MarketDataService after every accepted tick. AlertEngineModule and the WS
 *  gateway both listen for this via @OnEvent - neither imports MarketDataModule directly. */
export interface MarketTickEvent {
  instrumentId: string;
  symbol: string;
  price: number;
  prevPrice: number;
  eventTime: number;
  receivedTime: number;
  seq: number;
  providerId: string;
  providerName: string;
  isDemo: boolean;
  changePct24h: number | null;
}

export interface MarketStaleEventPayload {
  instrumentId: string;
  symbol: string;
  lastUpdateAt: number;
}

export interface MarketResumedEventPayload {
  instrumentId: string;
  symbol: string;
}
