import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import WebSocket from "ws";
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

interface BinanceTickerData {
  e: "24hrTicker";
  E: number; // event time
  s: string; // symbol
  c: string; // last price
  o: string; // open price (24h rolling)
  P: string; // price change percent (24h)
  h: string; // high price (24h)
  l: string; // low price (24h)
  v: string; // base asset volume (24h) - e.g. BTC units traded, not a dollar figure
  q: string; // quote asset volume (24h) - traded volume in the pair's quote currency (USD/USDT), what "24h volume" means to users
}

interface BinanceAggTradeData {
  e: "aggTrade";
  E: number; // event time
  s: string; // symbol
  a: number; // aggregate trade id - monotonic per symbol
  p: string; // price
  T: number; // trade time
}

interface BinanceStreamMessage {
  stream: string;
  data: BinanceTickerData | BinanceAggTradeData;
}

/**
 * Per symbol: aggTrade carries every trade as it happens and drives price + alert evaluation, so
 * a spike through a level inside a single second still fires. The 24h ticker only updates once a
 * second and supplies the 24h stats.
 */
const STREAM_SUFFIXES = ["aggTrade", "ticker"] as const;

function streamsFor(symbol: string): string[] {
  return STREAM_SUFFIXES.map((suffix) => `${symbol.toLowerCase()}@${suffix}`);
}

const MAX_BACKOFF_MS = 30_000;
const WATCHDOG_INTERVAL_MS = 10_000;
const STALE_THRESHOLD_MS = 30_000;
/** Kline hosts in order: the main API, then Binance's public market-data mirror. */
const KLINE_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
const KLINE_TIMEOUT_MS = 8_000;

const KLINE_INTERVAL_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "3m": "3m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

/**
 * Combined-stream Binance WebSocket client. Uses the 24hr ticker stream (one push/sec/symbol,
 * carries last price + 24h high/low/volume/change in a single frame) so live evaluation and
 * the UI's "24h" stats come from the same feed - no separate REST polling.
 */
@Injectable()
export class BinanceProvider implements MarketDataProvider, OnModuleDestroy {
  readonly name = "binance";
  readonly assetTypes = [AssetType.CRYPTO];

  private readonly logger = new Logger(BinanceProvider.name);
  private readonly baseUrl: string;
  private ws: WebSocket | null = null;
  private tickHandlers: Array<(tick: NormalizedTick) => void> = [];
  private readonly subscribed = new Set<string>();
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectCount = 0;
  private lastMessageAt: number | null = null;
  private watchdog: NodeJS.Timeout | null = null;
  private latencyProbe: NodeJS.Timeout | null = null;
  private lastLatencyMs: number | null = null;
  private closingIntentionally = false;
  private msgIdCounter = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  /**
   * 418 ("I'm a teapot") is Binance's response once an IP has been auto-banned for ignoring 429s;
   * hitting a banned host again before its ban clears only prolongs it. Keyed by host, cleared
   * once Date.now() passes the value (Binance's Retry-After header, or a 60s guess without one).
   */
  private readonly bannedUntil = new Map<string, number>();

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    this.baseUrl = this.config.get("BINANCE_WS_BASE_URL", { infer: true });
  }

  async connect(): Promise<void> {
    this.closingIntentionally = false;
    // A failed first attempt (e.g. transient DNS blip) must not hang app startup forever -
    // scheduleReconnect (triggered by openSocket's own close handler) keeps retrying in the
    // background regardless of whether this initial await resolves or rejects.
    await this.openSocket().catch(() => undefined);
    this.watchdog = setInterval(() => this.checkStale(), WATCHDOG_INTERVAL_MS);
    this.latencyProbe = setInterval(() => this.probeLatency(), WATCHDOG_INTERVAL_MS);
  }

  async disconnect(): Promise<void> {
    this.closingIntentionally = true;
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.latencyProbe) clearInterval(this.latencyProbe);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.connected = false;
  }

  private probeLatency() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.ping(Buffer.from(String(Date.now())));
    }
  }

  onModuleDestroy() {
    return this.disconnect();
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/stream?streams=` + (this.subscribed.size ? this.streamNames() : "btcusdt@ticker");
      const socket = new WebSocket(url);
      this.ws = socket;
      let settled = false;

      // Guards against a slow-to-fail *previous* socket's events still landing after we've
      // already moved on to a newer one (`this.ws` will no longer be `socket` by then).
      const isCurrent = () => this.ws === socket;

      socket.on("open", () => {
        if (!isCurrent()) return;
        this.connected = true;
        this.reconnectAttempts = 0;
        this.logger.log(`Connected to Binance combined stream (${this.subscribed.size} symbols)`);
        settled = true;
        resolve();
      });

      socket.on("message", (raw: WebSocket.RawData) => {
        if (isCurrent()) this.handleMessage(raw);
      });

      socket.on("pong", (data: Buffer) => {
        if (!isCurrent()) return;
        const sentAt = Number(data.toString() || 0);
        if (sentAt) this.lastLatencyMs = Date.now() - sentAt;
      });

      socket.on("close", () => {
        if (!isCurrent()) return;
        this.connected = false;
        // A connection that never opened (e.g. DNS failure) would otherwise leave the
        // `await openSocket()` in scheduleReconnect's caller hanging forever, since only
        // "open" used to settle this promise - that left every failed attempt's close handler
        // free to schedule an independent, never-cancelled reconnect chain of its own,
        // compounding with every retry instead of converging on one.
        if (!settled) {
          settled = true;
          reject(new Error("Binance WS closed before opening"));
        }
        if (!this.closingIntentionally) this.scheduleReconnect();
      });

      socket.on("error", (err) => {
        if (isCurrent()) this.logger.error(`Binance WS error: ${err.message}`);
      });
    });
  }

  private streamNames(): string {
    return [...this.subscribed].flatMap(streamsFor).join("/");
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return; // a reconnect is already pending - never stack attempts
    this.reconnectAttempts += 1;
    this.reconnectCount += 1;
    const backoff = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS) + Math.random() * 500;
    this.logger.warn(`Binance WS disconnected - reconnecting in ${Math.round(backoff)}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.closingIntentionally) return;
      try {
        await this.openSocket();
        if (this.subscribed.size > 0) {
          this.logger.log(`Resubscribing to ${this.subscribed.size} symbols after reconnect`);
          this.sendSubscription("SUBSCRIBE", [...this.subscribed]);
        }
      } catch {
        // openSocket's own "close" handler already scheduled the next attempt
      }
    }, backoff);
  }

  private checkStale() {
    if (!this.connected || this.subscribed.size === 0) return;
    if (this.lastMessageAt && Date.now() - this.lastMessageAt > STALE_THRESHOLD_MS) {
      this.logger.warn("Binance feed stale (no messages in 30s) - forcing reconnect");
      this.ws?.close();
    }
  }

  private handleMessage(raw: WebSocket.RawData) {
    let parsed: BinanceStreamMessage;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const d = parsed?.data;
    if (!d) return;

    let tick: NormalizedTick;
    if (d.e === "aggTrade") {
      tick = {
        instrumentId: d.s.toLowerCase(),
        providerSymbol: d.s.toLowerCase(),
        price: Number(d.p),
        eventTime: d.T,
        receivedTime: Date.now(),
        providerId: this.name,
        providerSeq: d.a,
      };
    } else if (d.e === "24hrTicker") {
      tick = {
        instrumentId: d.s.toLowerCase(),
        providerSymbol: d.s.toLowerCase(),
        price: Number(d.c),
        eventTime: d.E,
        receivedTime: Date.now(),
        providerId: this.name,
        statsOnly: true,
        open24h: Number(d.o),
        volume24h: Number(d.q),
        high24h: Number(d.h),
        low24h: Number(d.l),
        changePct24h: Number(d.P),
      };
    } else {
      return;
    }

    this.lastMessageAt = Date.now();
    for (const handler of this.tickHandlers) handler(tick);
  }

  private sendSubscription(method: "SUBSCRIBE" | "UNSUBSCRIBE", symbols: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || symbols.length === 0) return;
    this.ws.send(
      JSON.stringify({
        method,
        params: symbols.flatMap(streamsFor),
        id: this.msgIdCounter++,
      }),
    );
  }

  async subscribe(providerSymbols: string[]): Promise<void> {
    const newSymbols = providerSymbols.map((s) => s.toLowerCase()).filter((s) => !this.subscribed.has(s));
    newSymbols.forEach((s) => this.subscribed.add(s));
    if (newSymbols.length === 0) return;

    if (!this.connected) {
      await this.connect();
      return;
    }
    this.sendSubscription("SUBSCRIBE", newSymbols);
  }

  async unsubscribe(providerSymbols: string[]): Promise<void> {
    const symbols = providerSymbols.map((s) => s.toLowerCase());
    this.sendSubscription("UNSUBSCRIBE", symbols);
    symbols.forEach((s) => this.subscribed.delete(s));
  }

  async getPrice(): Promise<NormalizedPrice | null> {
    // Live evaluation reads exclusively from PriceCacheService (Redis), which every tick
    // already flows through - this provider does not expose a separate REST price lookup.
    return null;
  }

  async getHistoricalData(providerSymbol: string, timeframe: Timeframe): Promise<Candle[]> {
    const query = `symbol=${providerSymbol.toUpperCase()}&interval=${KLINE_INTERVAL_MAP[timeframe]}&limit=500`;
    // api.binance.com refuses some server regions (451) and rate-limits (429/418); the public
    // market-data host serves the same klines without the region block, so it's the fallback.
    for (const host of KLINE_HOSTS) {
      const bannedUntil = this.bannedUntil.get(host);
      if (bannedUntil && Date.now() < bannedUntil) continue; // still cooling down - don't re-trip the ban
      try {
        const res = await fetch(`${host}/api/v3/klines?${query}`, { signal: AbortSignal.timeout(KLINE_TIMEOUT_MS) });
        if (!res.ok) {
          if (res.status === 418 || res.status === 429) this.banHost(host, res);
          this.logger.warn(`Binance klines ${providerSymbol} ${timeframe} from ${host}: HTTP ${res.status}`);
          continue;
        }
        this.bannedUntil.delete(host);
        const raw = (await res.json()) as unknown[][];
        return raw.map((k) => ({
          time: Math.floor(Number(k[0]) / 1000),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
        }));
      } catch (err) {
        this.logger.warn(`Binance klines ${providerSymbol} ${timeframe} from ${host} failed: ${(err as Error).message}`);
      }
    }
    return [];
  }

  /**
   * Honours Binance's Retry-After on a 418/429 (seconds until the ban lifts) so every other
   * chart open in the meantime skips straight past this host instead of extending the ban by
   * hitting it again. Falls back to a conservative 60s when the header is missing.
   */
  private banHost(host: string, res: Response) {
    const header = Number(res.headers.get("retry-after"));
    const seconds = Number.isFinite(header) && header > 0 ? Math.min(header, 24 * 3600) : 60;
    this.bannedUntil.set(host, Date.now() + seconds * 1000);
    this.logger.warn(`Binance host ${host} returned HTTP ${res.status} - pausing klines requests to it for ${seconds}s`);
  }

  getHealth(): ProviderHealth {
    return {
      provider: this.name,
      connected: this.connected,
      latencyMs: this.lastLatencyMs,
      subscribedSymbols: this.subscribed.size,
      lastMessageAt: this.lastMessageAt,
      reconnectCount: this.reconnectCount,
    };
  }

  onTick(handler: (tick: NormalizedTick) => void): void {
    this.tickHandlers.push(handler);
  }
}
