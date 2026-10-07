import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AssetType, type Instrument, AlertStatus } from "@prisma/client";
import type { NormalizedTick } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../common/config/env.validation";
import { PriceCacheService } from "./price-cache/price-cache.service";
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

@Injectable()
export class MarketDataService implements OnModuleInit {
  private readonly logger = new Logger(MarketDataService.name);
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly events: EventEmitter2,
    private readonly priceCache: PriceCacheService,
    private readonly registry: SubscriptionRegistryService,
    private readonly mockProvider: MockMarketDataProvider,
    private readonly binanceProvider: BinanceProvider,
    private readonly twelveDataProvider: TwelveDataProvider,
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
    const isDemo = adapter === "mock";
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
      for (const alert of alertsForInstrument) {
        await this.registry.addAlertRef(instrumentId, alert.id);
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

  /** Called by AlertsService when an alert is paused/deleted/triggered-non-recurring/expired. */
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

    void this.handleResolvedTick(instrument, tick, providerId, isDemo, adapter);
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

  async getHistoricalCandles(instrumentId: string, timeframe: Parameters<MockMarketDataProvider["getHistoricalData"]>[1]) {
    const instrument = await this.getOrLoadInstrument(instrumentId);
    if (!instrument) return [];
    const adapter: AdapterName = this.instrumentAdapter.get(instrumentId) ?? "mock";
    const candles = await this.providerFor(adapter).getHistoricalData(instrument.providerSymbol, timeframe);
    // Real providers' REST endpoints need no active subscription, but if one ever returns
    // nothing (rate limit, symbol not listed, no API key), fall back to synthetic demo candles
    // rather than showing an empty chart.
    if (candles.length === 0 && adapter !== "mock") {
      return this.mockProvider.getHistoricalData(instrument.providerSymbol, timeframe);
    }
    return candles;
  }
}
