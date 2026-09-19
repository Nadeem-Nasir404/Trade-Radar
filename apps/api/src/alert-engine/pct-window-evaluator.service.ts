import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type Redis from "ioredis";
import { AlertStatus, ConditionType } from "@prisma/client";
import { InjectRedis } from "../redis/inject-redis.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { PriceCacheService } from "../market-data/price-cache/price-cache.service";
import { AlertEngineService } from "./alert-engine.service";

function timeframeToMs(timeframe: string | null): number {
  const match = /^(\d+)([mhd])$/.exec(timeframe ?? "1h");
  if (!match) return 3_600_000;
  const value = Number(match[1]);
  const unit = match[2];
  return unit === "m" ? value * 60_000 : unit === "h" ? value * 3_600_000 : value * 86_400_000;
}

function baselineKey(alertId: string) {
  return `alert:pctbaseline:${alertId}`;
}

/**
 * PCT_CHANGE_WINDOW ("moved 5% in the last hour") needs a moving baseline, so unlike every
 * other condition type it can't live in a static ZSET - AlertIndexerService deliberately
 * skips indexing it. This runs on a schedule instead: a pragmatic tumbling window (the
 * baseline resets every `timeframe` rather than sliding continuously), which is a known
 * simplification documented in ARCHITECTURE.md. Funnels into the exact same
 * AlertEngineService.triggerAlert() path as tick-driven alerts, so idempotency/cooldown/
 * queue behavior is identical.
 */
@Injectable()
export class PctWindowEvaluatorService {
  private readonly logger = new Logger(PctWindowEvaluatorService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly priceCache: PriceCacheService,
    private readonly alertEngine: AlertEngineService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluate(): Promise<void> {
    const alerts = await this.prisma.alert.findMany({
      where: { status: AlertStatus.ACTIVE, conditionType: ConditionType.PCT_CHANGE_WINDOW },
    });
    if (alerts.length === 0) return;

    for (const alert of alerts) {
      const snapshot = await this.priceCache.getSnapshot(alert.instrumentId);
      if (!snapshot || snapshot.feedStatus === "STALE") continue;

      const windowMs = timeframeToMs(alert.timeframe);
      const baselineRaw = await this.redis.hgetall(baselineKey(alert.id));
      const now = Date.now();

      if (!baselineRaw.price) {
        await this.redis.hset(baselineKey(alert.id), { price: String(snapshot.price), ts: String(now) });
        continue;
      }

      const baselinePrice = Number(baselineRaw.price);
      const baselineTs = Number(baselineRaw.ts);

      if (now - baselineTs >= windowMs) {
        await this.redis.hset(baselineKey(alert.id), { price: String(snapshot.price), ts: String(now) });
        continue;
      }

      const pct = ((snapshot.price - baselinePrice) / baselinePrice) * 100;
      const target = Number(alert.targetValue);
      const crossed = target >= 0 ? pct >= target : pct <= target;
      if (!crossed) continue;

      // A Redis-backed counter (not in-memory) so the idempotency key stays correct across process restarts.
      const seq = await this.redis.incr(`alert:${alert.id}:pctwindow:seq`);

      await this.alertEngine.triggerAlert(alert.id, baselinePrice, snapshot.price, seq, {
        eventTime: now,
        receivedTime: now,
        providerId: snapshot.providerId ?? "unknown",
      });
    }
  }
}
