/**
 * Socket.IO event name contract between apps/api WebsocketGatewayModule and apps/web lib/ws.
 * The server only ever emits the events below into `instrument:{id}` or `user:{userId}` rooms —
 * never a raw tick firehose to every connected client.
 */
export const WS_EVENTS = {
  // client -> server
  SUBSCRIBE_INSTRUMENT: "subscribe:instrument",
  UNSUBSCRIBE_INSTRUMENT: "unsubscribe:instrument",
  HEARTBEAT: "heartbeat",

  // server -> client
  PRICE_UPDATE: "price:update",
  MARKET_STALE: "market:stale",
  MARKET_RESUMED: "market:resumed",
  ALERT_TRIGGERED: "alert:triggered",
  ALERT_STATUS_CHANGED: "alert:status-changed",
  PROVIDER_HEALTH: "provider:health",
} as const;

export interface PriceUpdateEvent {
  instrumentId: string;
  symbol: string;
  price: number;
  prevPrice: number;
  changePct24h: number | null;
  eventTime: number;
  /**
   * Updates are throttled to a few per second, but trades in between can spike further. These
   * are the highest and lowest trade prices since the previous update, from trades starting at
   * windowStartTime (exchange ms), so a live bar can include wicks the sampled price never showed.
   */
  windowHigh?: number;
  windowLow?: number;
  windowStartTime?: number;
}

export interface MarketStaleEvent {
  instrumentId: string;
  symbol: string;
  lastUpdateAt: number;
}

export interface MarketResumedEvent {
  instrumentId: string;
  symbol: string;
}

export interface AlertTriggeredEvent {
  alertId: string;
  alertEventId: string;
  instrumentId: string;
  symbol: string;
  conditionType: string;
  targetValue: string;
  observedPrice: string;
  eventTime: number;
}

export interface AlertStatusChangedEvent {
  alertId: string;
  status: string;
}

export interface ProviderHealthEvent {
  provider: string;
  connected: boolean;
  latencyMs: number | null;
  subscribedSymbols: number;
}
