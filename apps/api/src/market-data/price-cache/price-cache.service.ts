import { Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { InjectRedis } from "../../redis/inject-redis.decorator";
import { TICK_GUARD_LUA } from "./tick-guard.lua";

export interface TickGuardResult {
  accepted: boolean;
  prevPrice: number;
  seq: number;
}

export interface PriceSnapshot {
  instrumentId: string;
  price: number;
  prevPrice: number;
  eventTime: number;
  receivedTime: number;
  providerId: string | null;
  seq: number;
  feedStatus: "LIVE" | "STALE" | "UNKNOWN";
  isDemo: boolean;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  changePct24h: number | null;
}

const TRACKED_INSTRUMENTS_KEY = "md:tracked-instruments";
export const STALE_AFTER_MS = 45_000;

function priceKey(instrumentId: string) {
  return `price:${instrumentId}`;
}

@Injectable()
export class PriceCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  /** The single atomic entry point every provider adapter's tick must pass through. */
  async applyTick(input: {
    instrumentId: string;
    price: number;
    eventTime: number;
    receivedTime: number;
    providerId: string;
    isDemo: boolean;
  }): Promise<TickGuardResult> {
    const [accepted, prevPriceRaw, seq] = (await this.redis.eval(
      TICK_GUARD_LUA,
      1,
      priceKey(input.instrumentId),
      String(input.price),
      String(input.eventTime),
      String(input.receivedTime),
      input.providerId,
      input.isDemo ? "1" : "0",
    )) as [number, string, number];

    if (accepted === 1) {
      await this.redis.sadd(TRACKED_INSTRUMENTS_KEY, input.instrumentId);
    }

    return { accepted: accepted === 1, prevPrice: Number(prevPriceRaw), seq };
  }

  async updateTickerStats(
    instrumentId: string,
    stats: { high24h?: number; low24h?: number; volume24h?: number; changePct24h?: number },
  ): Promise<void> {
    const fields: string[] = [];
    if (stats.high24h !== undefined) fields.push("high24h", String(stats.high24h));
    if (stats.low24h !== undefined) fields.push("low24h", String(stats.low24h));
    if (stats.volume24h !== undefined) fields.push("volume24h", String(stats.volume24h));
    if (stats.changePct24h !== undefined) fields.push("changePct24h", String(stats.changePct24h));
    if (fields.length === 0) return;
    await this.redis.hset(priceKey(instrumentId), ...fields);
  }

  private parseSnapshot(instrumentId: string, raw: Record<string, string> | null): PriceSnapshot | null {
    if (!raw || !raw.price) return null;
    const eventTime = Number(raw.ts ?? 0);
    const feedStatus: PriceSnapshot["feedStatus"] = eventTime
      ? Date.now() - eventTime > STALE_AFTER_MS
        ? "STALE"
        : "LIVE"
      : "UNKNOWN";

    return {
      instrumentId,
      price: Number(raw.price),
      prevPrice: Number(raw.prevPrice ?? raw.price),
      eventTime,
      receivedTime: Number(raw.receivedTs ?? 0),
      providerId: raw.providerId ?? null,
      seq: Number(raw.seq ?? 0),
      feedStatus,
      isDemo: raw.isDemo === "1",
      high24h: raw.high24h ? Number(raw.high24h) : null,
      low24h: raw.low24h ? Number(raw.low24h) : null,
      volume24h: raw.volume24h ? Number(raw.volume24h) : null,
      changePct24h: raw.changePct24h ? Number(raw.changePct24h) : null,
    };
  }

  async getSnapshot(instrumentId: string): Promise<PriceSnapshot | null> {
    const raw = await this.redis.hgetall(priceKey(instrumentId));
    return this.parseSnapshot(instrumentId, raw);
  }

  async getSnapshots(instrumentIds: string[]): Promise<Map<string, PriceSnapshot>> {
    const result = new Map<string, PriceSnapshot>();
    if (instrumentIds.length === 0) return result;
    const pipeline = this.redis.pipeline();
    for (const id of instrumentIds) pipeline.hgetall(priceKey(id));
    const responses = await pipeline.exec();
    responses?.forEach(([, raw], idx) => {
      const snapshot = this.parseSnapshot(instrumentIds[idx], raw as Record<string, string> | null);
      if (snapshot) result.set(instrumentIds[idx], snapshot);
    });
    return result;
  }

  async listTrackedInstrumentIds(): Promise<string[]> {
    return this.redis.smembers(TRACKED_INSTRUMENTS_KEY);
  }
}
