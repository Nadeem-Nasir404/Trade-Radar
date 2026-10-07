import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { AssetType, type Instrument, AlertStatus } from "@prisma/client";
import type { Candle, NormalizedTick, Timeframe } from "@levelpulse/shared-types";
import type Redis from "ioredis";
import { InjectRedis } from "../redis/inject-redis.decorator";
import { TIMEFRAME_SECONDS } from "./providers/synthetic-candles";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../common/config/env.validation";
import { PriceCacheService } from "./price-cache/price-cache.service";
import { ALERT_TRIGGERED_EVENT, type AlertTriggeredPayload } from "../alert-engine/alert-engine.events";
import { SubscriptionRegistryService } from "./subscription-registry.service";
import { MockMarketDataProvider } from "./providers/mock/mock-market-data.provider";
import { BinanceProvider } from "./providers/binance/binance.provider";
import { TwelveDataProvider } from "./providers/twelvedata/twelvedata.provider";
import {
  MARKET_RESUMED_EVENT,
  MARKET_STALE_EVENT,
  MARKET_TICK_EVENT,
  type MarketTickEvent,
} from "./market-data.events";

type AdapterName = "binance" | "twelvedata" | "mock";

/**
 * How long a fetched history stays fresh within one bar; the live bar itself is drawn from ticks.
 */
const CANDLE_CACHE_SECONDS: Record<Timeframe, number> = {
  "1m": 5,
  "3m": 10,
  "5m": 10,
  "15m": 20,
  "1h": 30,
  "4h": 60,
  "1d": 60,
  "1w": 300,
};
/**
 * Fallback copy for when the exchange fails. Kept short: one copy per coin and timeframe is ~40 KB,
 * and a day of them filled a small Redis plan, after which every chart request failed.
 */
const LAST_GOOD_CANDLE_SECONDS = 2 * 3600;

/**
 * The shared Redis client waits indefinitely while disconnected (maxRetriesPerRequest: null, which
 * BullMQ needs), so cache calls get their own short deadline and a slow Redis counts as a miss.
 */
const CACHE_TIMEOUT_MS = 500;
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis did not answer within ${CACHE_TIMEOUT_MS}ms`)), CACHE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Keyed by the current bar too, so the first request after a bar closes always fetches its final OHLC. */
function candleCacheKey(instrumentId: string, timeframe: Timeframe) {
  const currentBar = Math.floor(Date.now() / 1000 / TIMEFRAME_SECONDS[timeframe]);
  return `candles:${instrumentId}:${timeframe}:${currentBar}`;
}
function lastGoodCandleKey(instrumentId: string, timeframe: Timeframe) {
  return `candles:lastgood:${instrumentId}:${timeframe}`;
}

@Injectable()
export class MarketDataService implements OnModuleInit {
  private readonly logger = new Logger(MarketDataService.name);
  private lastTickErrorLog = 0;
  private readonly demoMode: boolean;

  /** providerSymbol (lowercase) -> Instrument row, one map per adapter */
  private readonly symbolMaps: Record<AdapterName, Map<string, Instrument>> = {
    binance: new Map(),
    twelvedata: new Map(),
    mock: new Map(),
  };
  private readonly instrumentAdapter = new Map<string, AdapterName>();
  private readonly instrumentIsDemo = new Map<string, boolean>();
  private readonly instrumentsById = new Map<string, Instrument>();
  private providerIds: Record<AdapterName, string | null> = { binance: null, twelvedata: null, mock: null };
  private readonly lastKnownFeedStatus = new Map<string, "LIVE" | "STALE">();
  private readonly open24hById = new Map<string, number>();
  private readonly candleRequests = new Map<string, Promise<Candle[]>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly events: EventEmitter2,
    private readonly priceCache: PriceCacheService,
    private readonly registry: SubscriptionRegistryService,
    private readonly mockProvider: MockMarketDataProvider,
    private readonly binanceProvider: BinanceProvider,
    private readonly twelveDataProvider: TwelveDataProvider,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.demoMode = this.config.get("DEMO_MODE", { infer: true });
  }

  private providerFor(adapter: AdapterName) {
    if (adapter === "binance") return this.binanceProvider;
    if (adapter === "twelvedata") return this.twelveDataProvider;
    return this.mockProvider;
  }

  async onModuleInit() {
    const providers = await this.prisma.provider.findMany();
    for (const p of providers) {
      if (p.name === "binance") this.providerIds.binance = p.id;
      if (p.name === "twelvedata") this.providerIds.twelvedata = p.id;
      if (p.name === "mock") this.providerIds.mock = p.id;
    }

    await this.mockProvider.connect();
    this.mockProvider.onTick((tick) => this.onAdapterTick("mock", tick));

    if (!this.demoMode) {
      await this.binanceProvider.connect();
      this.binanceProvider.onTick((tick) => this.onAdapterTick("binance", tick));
      await this.twelveDataProvider.connect();
      this.twelveDataProvider.onTick((tick) => this.onAdapterTick("twelvedata", tick));
    } else {
      this.logger.warn("DEMO_MODE=true - all instruments (including crypto) are served by MockMarketDataProvider");
    }

    const instruments = await this.prisma.instrument.findMany({ where: { isActive: true } });
    for (const instrument of instruments) this.registerInstrument(instrument);

    // Mock is zero-cost, and a Twelve Data poll covers every subscribed symbol in one request
    // regardless of count - neither benefits from ref-counting like a real per-symbol exchange
    // feed does, so both stay subscribed permanently. Without this they'd sit frozen at their
    // seeded price until someone happened to open an alert or the detail screen on them.
    const alwaysOn = instruments.filter((i) => {
      const adapter = this.instrumentAdapter.get(i.id);
      return adapter === "mock" || adapter === "twelvedata";
    });
    for (const instrument of alwaysOn) {
      const adapter = this.instrumentAdapter.get(instrument.id) as AdapterName;
      await this.providerFor(adapter).subscribe([instrument.providerSymbol]);
    }
    if (alwaysOn.length > 0) {
      this.logger.log(`Always-on mock feed for ${alwaysOn.length} instrument(s): ${alwaysOn.map((i) => i.symbol).join(", ")}`);
    }

    await this.resubscribeFromExistingAlerts();
  }

  private registerInstrument(instrument: Instrument) {
    // Route by the instrument's actual assigned provider, not its asset type - e.g. gold (a
    // COMMODITY) is sourced from Twelve Data's real XAU/USD spot quote, not the mock simulator.
    let adapter: AdapterName = "mock";
    if (!this.demoMode) {
      if (instrument.providerId === this.providerIds.binance) adapter = "binance";
      else if (instrument.providerId === this.providerIds.twelvedata) adapter = "twelvedata";
    }
    // Without a Twelve Data key, gold/forex come from a local random walk - flag it, so
    // simulated prices are never shown as real market data.
    const isDemo = adapter === "mock" || (adapter === "twelvedata" && this.twelveDataProvider.isSimulated);
    this.symbolMaps[adapter].set(instrument.providerSymbol.toLowerCase(), instrument);
    this.instrumentAdapter.set(instrument.id, adapter);
    this.instrumentIsDemo.set(instrument.id, isDemo);
    this.instrumentsById.set(instrument.id, instrument);
  }

  private async resubscribeFromExistingAlerts() {
    const instrumentIds = await this.prisma.alert.findMany({
      where: { status: AlertStatus.ACTIVE },
      distinct: ["instrumentId"],
      select: { instrumentId: true },
    });
    for (const { instrumentId } of instrumentIds) {
      const alertsForInstrument = await this.prisma.alert.findMany({
        where: { instrumentId, status: AlertStatus.ACTIVE },
        select: { id: true },
      });
      // Ref-counting lives in Redis; if Redis is refusing connections the feed still subscribes,
      // so prices and alerts keep flowing instead of the whole API failing to boot.
      try {
        for (const alert of alertsForInstrument) {
          await this.registry.addAlertRef(instrumentId, alert.id);
        }
      } catch (err) {
        this.logger.warn(`Startup: could not record alert refs for ${instrumentId} (${(err as Error).message})`);
      }
      await this.ensureSubscribedById(instrumentId);
    }
    this.logger.log(`Startup: subscribed to ${instrumentIds.length} instrument(s) with active alerts`);
  }

  private async getOrLoadInstrument(instrumentId: string): Promise<Instrument | null> {
    const cached = this.instrumentsById.get(instrumentId);
    if (cached) return cached;
    const instrument = await this.prisma.instrument.findUnique({ where: { id: instrumentId } });
    if (instrument) this.registerInstrument(instrument);
    return instrument;
  }

  async ensureSubscribedById(instrumentId: string): Promise<void> {
    const instrument = await this.getOrLoadInstrument(instrumentId);
    if (!instrument) {
      this.logger.warn(`Cannot subscribe: instrument ${instrumentId} not found`);
      return;
    }
    const adapter: AdapterName = this.instrumentAdapter.get(instrumentId) ?? "mock";
    await this.providerFor(adapter).subscribe([instrument.providerSymbol]);
  }

  async releaseSubscriptionById(instrumentId: string): Promise<void> {
    const instrument = await this.getOrLoadInstrument(instrumentId);
    if (!instrument) return;
    const adapter: AdapterName = this.instrumentAdapter.get(instrumentId) ?? "mock";
    if (adapter === "mock" || adapter === "twelvedata") return; // always-on feed - never unsubscribe
    await this.providerFor(adapter).unsubscribe([instrument.providerSymbol]);
  }

  /** Called by AlertsService when an alert is created/resumed. Subscribes on first reference. */
  async onAlertActivated(instrumentId: string, alertId: string): Promise<void> {
    const result = await this.registry.addAlertRef(instrumentId, alertId);
    if (result.becameActive) await this.ensureSubscribedById(instrumentId);
  }

  @OnEvent(ALERT_TRIGGERED_EVENT)
  async onAlertTriggered(event: AlertTriggeredPayload): Promise<void> {
    if (event.deactivated) await this.onAlertDeactivated(event.instrumentId, event.alertId);
  }

  /** Called when an alert is paused, deleted, or expired (AlertsService) or fires for the last time (onAlertTriggered). */
  async onAlertDeactivated(instrumentId: string, alertId: string): Promise<void> {
    const result = await this.registry.removeAlertRef(instrumentId, alertId);
    if (result.becameInactive) await this.releaseSubscriptionById(instrumentId);
  }

  private onAdapterTick(adapter: AdapterName, tick: NormalizedTick) {
    const instrument = this.symbolMaps[adapter].get(tick.providerSymbol.toLowerCase());
    if (!instrument) return; // adapter is subscribed to something we no longer track - ignore

    const isDemo = this.instrumentIsDemo.get(instrument.id) ?? adapter === "mock";
    const providerId = this.providerIds[adapter];
    if (!providerId) return;

    // Fire-and-forget, so it must never reject: a Redis outage would otherwise surface as an
    // unhandled rejection on every tick and kill the process.
    this.handleResolvedTick(instrument, tick, providerId, isDemo, adapter).catch((err: Error) => {
      const now = Date.now();
      if (now - this.lastTickErrorLog < 10_000) return;
      this.lastTickErrorLog = now;
      this.logger.warn(`Tick for ${instrument.symbol} dropped: ${err.message}`);
    });
  }

  private async handleResolvedTick(instrument: Instrument, tick: NormalizedTick, providerId: string, isDemo: boolean, adapter: AdapterName) {
    if (tick.open24h !== undefined && tick.open24h > 0) this.open24hById.set(instrument.id, tick.open24h);

    const hasStats =
      tick.high24h !== undefined || tick.low24h !== undefined || tick.volume24h !== undefined || tick.changePct24h !== undefined;
    if (tick.statsOnly) {
      // 24h stats only: refreshes high/low/volume and proves the feed is alive, but the price
      // itself comes from trades, so this never moves the price or evaluates alerts.
      await this.priceCache.updateTickerStats(instrument.id, {
        high24h: tick.high24h,
        low24h: tick.low24h,
        volume24h: tick.volume24h,
        changePct24h: tick.changePct24h,
        heardAt: tick.receivedTime,
      });
      return;
    }

    const result = await this.priceCache.applyTick({
      instrumentId: instrument.id,
      price: tick.price,
      eventTime: tick.eventTime,
      receivedTime: tick.receivedTime,
      providerId,
      isDemo,
      providerSeq: tick.providerSeq,
    });
    if (!result.accepted) return;

    if (hasStats) {
      await this.priceCache.updateTickerStats(instrument.id, {
        high24h: tick.high24h,
        low24h: tick.low24h,
        volume24h: tick.volume24h,
        changePct24h: tick.changePct24h,
      });
    }

    this.lastKnownFeedStatus.set(instrument.id, "LIVE");

    const payload: MarketTickEvent = {
      instrumentId: instrument.id,
      symbol: instrument.displaySymbol,
      price: tick.price,
      prevPrice: result.prevPrice,
      eventTime: tick.eventTime,
      receivedTime: tick.receivedTime,
      seq: result.seq,
      providerId,
      providerName: adapter,
      isDemo,
      changePct24h: tick.changePct24h ?? this.changePctFromOpen(instrument.id, tick.price),
    };
    this.events.emit(MARKET_TICK_EVENT, payload);
  }

  /** 24h change against the latest trade price, so it moves in step with the price shown beside it. */
  private changePctFromOpen(instrumentId: string, price: number): number | null {
    const open = this.open24hById.get(instrumentId);
    return open ? ((price - open) / open) * 100 : null;
  }

  /** Throttled persistence of the live price into Postgres, purely for cold-start display. */
  @Cron("*/15 * * * * *")
  async persistLatestPrices() {
    const instrumentIds = await this.priceCache.listTrackedInstrumentIds();
    if (instrumentIds.length === 0) return;
    const snapshots = await this.priceCache.getSnapshots(instrumentIds);
    await Promise.all(
      [...snapshots.entries()].map(([instrumentId, snapshot]) =>
        this.prisma.instrument
          .update({
            where: { id: instrumentId },
            data: { lastPrice: snapshot.price, lastPriceAt: new Date(snapshot.eventTime) },
          })
          .catch(() => undefined),
      ),
    );
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async sweepStaleFeeds() {
    const instrumentIds = await this.priceCache.listTrackedInstrumentIds();
    for (const instrumentId of instrumentIds) {
      const snapshot = await this.priceCache.getSnapshot(instrumentId);
      if (!snapshot) continue;
      const previous = this.lastKnownFeedStatus.get(instrumentId);
      const isStale = snapshot.feedStatus === "STALE";

      if (isStale && previous !== "STALE") {
        this.lastKnownFeedStatus.set(instrumentId, "STALE");
        const instrument = await this.getOrLoadInstrument(instrumentId);
        this.events.emit(MARKET_STALE_EVENT, {
          instrumentId,
          symbol: instrument?.displaySymbol ?? instrumentId,
          lastUpdateAt: snapshot.eventTime,
        });
      } else if (!isStale && previous === "STALE") {
        this.lastKnownFeedStatus.set(instrumentId, "LIVE");
        const instrument = await this.getOrLoadInstrument(instrumentId);
        this.events.emit(MARKET_RESUMED_EVENT, { instrumentId, symbol: instrument?.displaySymbol ?? instrumentId });
      }
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweepStaleViewerSubscriptions() {
    const becameInactive = await this.registry.sweepStaleViewers();
    for (const instrumentId of becameInactive) {
      const stillHasRefs = await this.registry.hasAnyRefs(instrumentId);
      if (!stillHasRefs) await this.releaseSubscriptionById(instrumentId);
    }
  }

  getProviderHealth() {
    return [this.mockProvider.getHealth(), this.binanceProvider.getHealth(), this.twelveDataProvider.getHealth()];
  }

  async getHistoricalCandles(instrumentId: string, timeframe: Timeframe): Promise<Candle[]> {
    const fresh = await this.cacheGet(candleCacheKey(instrumentId, timeframe));
    if (fresh) return JSON.parse(fresh) as Candle[];

    // Concurrent chart opens for the same series share one upstream request.
    const key = `${instrumentId}:${timeframe}`;
    const pending = this.candleRequests.get(key);
    if (pending) return pending;
    const request = this.loadHistoricalCandles(instrumentId, timeframe).finally(() => this.candleRequests.delete(key));
    this.candleRequests.set(key, request);
    return request;
  }

  /**
   * Charts only ever show the provider's real candles. A failed fetch (rate limit, outage) serves
   * the last good copy, or nothing - never synthetic candles passed off as market data. Only
   * instruments already flagged isDemo use the simulator.
   */
  private async loadHistoricalCandles(instrumentId: string, timeframe: Timeframe): Promise<Candle[]> {
    const instrument = await this.getOrLoadInstrument(instrumentId);
    if (!instrument) return [];
    const adapter: AdapterName = this.instrumentAdapter.get(instrumentId) ?? "mock";

    const candles = await this.providerFor(adapter).getHistoricalData(instrument.providerSymbol, timeframe);
    if (candles.length > 0) {
      const body = JSON.stringify(candles);
      // The cache only saves exchange calls; a full or unreachable Redis must not cost the chart.
      try {
        await withTimeout(
          this.redis
            .multi()
            .set(candleCacheKey(instrumentId, timeframe), body, "EX", CANDLE_CACHE_SECONDS[timeframe])
            .set(lastGoodCandleKey(instrumentId, timeframe), body, "EX", LAST_GOOD_CANDLE_SECONDS)
            .exec(),
        );
      } catch (err) {
        this.logger.warn(`Could not cache ${timeframe} candles for ${instrument.displaySymbol}: ${(err as Error).message}`);
      }
      return candles;
    }

    const lastGood = await this.cacheGet(lastGoodCandleKey(instrumentId, timeframe));
    if (lastGood) {
      this.logger.warn(`Serving last good ${timeframe} candles for ${instrument.displaySymbol}: provider returned none`);
      return JSON.parse(lastGood) as Candle[];
    }
    this.logger.warn(`No historical candles from ${adapter} for ${instrument.symbol} (${timeframe}); returning none`);
    return [];
  }

  /** A cache read that treats an unavailable Redis as a miss, so charts still load from the exchange. */
  private async cacheGet(key: string): Promise<string | null> {
    try {
      return await withTimeout(this.redis.get(key));
    } catch (err) {
      this.logger.warn(`Candle cache read failed (${key}): ${(err as Error).message}`);
      return null;
    }
  }
}
