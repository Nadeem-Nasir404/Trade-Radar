import { Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { InjectRedis } from "../redis/inject-redis.decorator";

const VIEWER_STALE_MS = 60_000;
const TRACKED_VIEWER_INSTRUMENTS_KEY = "md:viewer-instruments";

function alertRefsKey(instrumentId: string) {
  return `md:refsources:alerts:${instrumentId}`;
}
function viewerRefsKey(instrumentId: string) {
  return `md:refsources:viewers:${instrumentId}`;
}

export interface RefChangeResult {
  /** true when this call caused the instrument's total ref count to go from 0 to >0 */
  becameActive: boolean;
  /** true when this call caused the instrument's total ref count to drop to 0 */
  becameInactive: boolean;
}

/**
 * Tracks *why* an instrument needs a live subscription (active alerts, live chart viewers) so
 * MarketDataService subscribes/unsubscribes exactly once per instrument no matter how many
 * alerts or viewers reference it, and drops the subscription only when the last one disappears.
 */
@Injectable()
export class SubscriptionRegistryService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private async totalRefs(instrumentId: string): Promise<number> {
    const [alertCount, viewerCount] = await Promise.all([
      this.redis.scard(alertRefsKey(instrumentId)),
      this.redis.zcard(viewerRefsKey(instrumentId)),
    ]);
    return alertCount + viewerCount;
  }

  async addAlertRef(instrumentId: string, alertId: string): Promise<RefChangeResult> {
    const before = await this.totalRefs(instrumentId);
    await this.redis.sadd(alertRefsKey(instrumentId), alertId);
    const after = await this.totalRefs(instrumentId);
    return { becameActive: before === 0 && after > 0, becameInactive: false };
  }

  async removeAlertRef(instrumentId: string, alertId: string): Promise<RefChangeResult> {
    await this.redis.srem(alertRefsKey(instrumentId), alertId);
    const after = await this.totalRefs(instrumentId);
    return { becameActive: false, becameInactive: after === 0 };
  }

  async addViewerRef(instrumentId: string, connectionId: string): Promise<RefChangeResult> {
    const before = await this.totalRefs(instrumentId);
    await this.redis.zadd(viewerRefsKey(instrumentId), Date.now(), connectionId);
    await this.redis.sadd(TRACKED_VIEWER_INSTRUMENTS_KEY, instrumentId);
    const after = await this.totalRefs(instrumentId);
    return { becameActive: before === 0 && after > 0, becameInactive: false };
  }

  async heartbeatViewerRef(instrumentId: string, connectionId: string): Promise<void> {
    await this.redis.zadd(viewerRefsKey(instrumentId), Date.now(), connectionId);
  }

  async removeViewerRef(instrumentId: string, connectionId: string): Promise<RefChangeResult> {
    await this.redis.zrem(viewerRefsKey(instrumentId), connectionId);
    const after = await this.totalRefs(instrumentId);
    return { becameActive: false, becameInactive: after === 0 };
  }

  async hasAnyRefs(instrumentId: string): Promise<boolean> {
    return (await this.totalRefs(instrumentId)) > 0;
  }

  async listInstrumentsWithAlertRefs(): Promise<string[]> {
    // Uses SCAN (not the blocking KEYS command) so this stays safe on a large keyspace even
    // though, in practice, it's only called once at startup and is bounded by distinct
    // instruments-with-alerts rather than total alert count.
    const withMembers: string[] = [];
    const stream = this.redis.scanStream({ match: "md:refsources:alerts:*", count: 100 });
    for await (const keys of stream) {
      for (const key of keys as string[]) {
        const count = await this.redis.scard(key);
        if (count > 0) withMembers.push(key.replace("md:refsources:alerts:", ""));
      }
    }
    return withMembers;
  }

  /** Removes viewer refs whose heartbeat is older than VIEWER_STALE_MS. Returns instruments that became inactive. */
  async sweepStaleViewers(): Promise<string[]> {
    const instrumentIds = await this.redis.smembers(TRACKED_VIEWER_INSTRUMENTS_KEY);
    const cutoff = Date.now() - VIEWER_STALE_MS;
    const becameInactive: string[] = [];

    for (const instrumentId of instrumentIds) {
      const key = viewerRefsKey(instrumentId);
      await this.redis.zremrangebyscore(key, "-inf", cutoff);
      const remaining = await this.redis.zcard(key);
      if (remaining === 0) {
        await this.redis.srem(TRACKED_VIEWER_INSTRUMENTS_KEY, instrumentId);
        if (!(await this.hasAnyRefs(instrumentId))) becameInactive.push(instrumentId);
      }
    }
    return becameInactive;
  }
}
