import { Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import { ConditionType, type Alert } from "@prisma/client";
import { InjectRedis } from "../redis/inject-redis.decorator";

export interface RegisteredAlert {
  id: string;
  userId: string;
  instrumentId: string;
  conditionType: ConditionType;
  targetValue: number;
  status: string;
  cooldownSeconds: number;
  isRecurring: boolean;
  lastTriggeredAt: number | null;
  expiresAt: number | null;
}

function alertHashKey(alertId: string) {
  return `alert:${alertId}`;
}
function idempotencyKey(alertId: string, transitionId: string) {
  return `alert:${alertId}:trigger:${transitionId}`;
}
function rangeHashKey(alertId: string) {
  return `alert:range:${alertId}`;
}
function registryKey(kind: "above" | "below" | "equals" | "range-lower" | "range-upper", instrumentId: string) {
  return `alerts:${kind}:${instrumentId}`;
}

/** Which ZSET a condition type lives in. PCT_CHANGE is resolved to a static ABOVE/BELOW
 *  threshold by AlertsService before this is called; PCT_CHANGE_WINDOW is never ZSET-indexed
 *  (evaluated separately by PctWindowEvaluatorService). */
function registryKindFor(conditionType: ConditionType): "above" | "below" | "equals" | "range" | null {
  switch (conditionType) {
    case ConditionType.ABOVE:
    case ConditionType.CROSSES_ABOVE:
      return "above";
    case ConditionType.BELOW:
    case ConditionType.CROSSES_BELOW:
      return "below";
    case ConditionType.EQUALS:
      return "equals";
    case ConditionType.ENTERS_RANGE:
    case ConditionType.EXITS_RANGE:
      return "range";
    default:
      return null;
  }
}

/**
 * KEYS[1] = alert:{id} hash, KEYS[2] = idempotency key for this transition
 * ARGV[1] = now (ms epoch)
 * Returns { claimed (0|1), previous lastTriggeredAt ('' if never) }
 */
const CLAIM_TRIGGER_LUA = `
local h = redis.call('HMGET', KEYS[1], 'status', 'expiresAt', 'cooldownSeconds', 'lastTriggeredAt', 'isRecurring')
if h[1] ~= 'ACTIVE' then return {0, ''} end
local now = tonumber(ARGV[1])
local last = h[4] or ''
if h[2] and h[2] ~= '' and now > tonumber(h[2]) then return {0, last} end
local cooldown = tonumber(h[3] or '0') or 0
if cooldown > 0 and last ~= '' and (now - tonumber(last)) < cooldown * 1000 then return {0, last} end
if not redis.call('SET', KEYS[2], '1', 'EX', 86400, 'NX') then return {0, last} end
redis.call('HSET', KEYS[1], 'lastTriggeredAt', ARGV[1])
if h[5] ~= '1' then redis.call('HSET', KEYS[1], 'status', 'TRIGGERED') end
return {1, last}
`;

@Injectable()
export class AlertRegistryService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Indexes an alert into Redis. `effectiveTargetValue` lets callers pass a resolved absolute
   * price for PCT_CHANGE alerts (baseline * (1 +/- pct/100)) while `alert.targetValue` keeps
   * the original percentage for display/serialization elsewhere.
   */
  async register(alert: Alert, effectiveTargetValue: number, rangeBounds?: { lower: number; upper: number }): Promise<void> {
    const kind = registryKindFor(alert.conditionType);

    const pipeline = this.redis.pipeline();
    // The alert:{id} hash is written even when there's no ZSET kind (PCT_CHANGE_WINDOW): its
    // status/cooldown/expiry fields are what triggerAlert() re-checks regardless of how a
    // trigger candidate was found (tick-driven ZSET lookup, or PctWindowEvaluatorService).
    pipeline.hset(alertHashKey(alert.id), {
      userId: alert.userId,
      instrumentId: alert.instrumentId,
      conditionType: alert.conditionType,
      targetValue: String(effectiveTargetValue),
      status: alert.status,
      cooldownSeconds: String(alert.cooldownSeconds),
      isRecurring: alert.isRecurring ? "1" : "0",
      lastTriggeredAt: alert.lastTriggeredAt ? String(alert.lastTriggeredAt.getTime()) : "",
      expiresAt: alert.expiresAt ? String(alert.expiresAt.getTime()) : "",
    });

    if (kind === "range" && rangeBounds) {
      pipeline.hset(rangeHashKey(alert.id), { lower: String(rangeBounds.lower), upper: String(rangeBounds.upper) });
      // Indexed by BOTH boundaries: a transition can happen by crossing the lower bound
      // (enter-from-below / exit-below) or the upper bound (enter-from-above / exit-above),
      // and a single ZSET can only be scored one way, so candidatesRangeNear() unions both.
      pipeline.zadd(registryKey("range-lower", alert.instrumentId), rangeBounds.lower, alert.id);
      pipeline.zadd(registryKey("range-upper", alert.instrumentId), rangeBounds.upper, alert.id);
    } else if (kind && kind !== "range") {
      pipeline.zadd(registryKey(kind, alert.instrumentId), effectiveTargetValue, alert.id);
    }

    await pipeline.exec();
  }

  async unregister(alertId: string, instrumentId: string, conditionType: ConditionType): Promise<void> {
    const kind = registryKindFor(conditionType);
    const pipeline = this.redis.pipeline();
    pipeline.del(alertHashKey(alertId));
    if (kind === "range") {
      pipeline.zrem(registryKey("range-lower", instrumentId), alertId);
      pipeline.zrem(registryKey("range-upper", instrumentId), alertId);
      pipeline.del(rangeHashKey(alertId));
    } else if (kind) {
      pipeline.zrem(registryKey(kind, instrumentId), alertId);
    }
    await pipeline.exec();
  }

  async getAlertHash(alertId: string): Promise<RegisteredAlert | null> {
    const raw = await this.redis.hgetall(alertHashKey(alertId));
    if (!raw || !raw.userId) return null;
    return {
      id: alertId,
      userId: raw.userId,
      instrumentId: raw.instrumentId,
      conditionType: raw.conditionType as ConditionType,
      targetValue: Number(raw.targetValue),
      status: raw.status,
      cooldownSeconds: Number(raw.cooldownSeconds || 0),
      isRecurring: raw.isRecurring === "1",
      lastTriggeredAt: raw.lastTriggeredAt ? Number(raw.lastTriggeredAt) : null,
      expiresAt: raw.expiresAt ? Number(raw.expiresAt) : null,
    };
  }

  async getRangeBounds(alertId: string): Promise<{ lower: number; upper: number } | null> {
    const raw = await this.redis.hgetall(rangeHashKey(alertId));
    if (!raw || !raw.lower) return null;
    return { lower: Number(raw.lower), upper: Number(raw.upper) };
  }

  async candidatesAbove(instrumentId: string, exclusiveMin: number, inclusiveMax: number): Promise<string[]> {
    return this.redis.zrangebyscore(registryKey("above", instrumentId), `(${exclusiveMin}`, `${inclusiveMax}`);
  }

  async candidatesBelow(instrumentId: string, inclusiveMin: number, exclusiveMax: number): Promise<string[]> {
    return this.redis.zrangebyscore(registryKey("below", instrumentId), `${inclusiveMin}`, `(${exclusiveMax}`);
  }

  async candidatesEquals(instrumentId: string, min: number, max: number): Promise<string[]> {
    return this.redis.zrangebyscore(registryKey("equals", instrumentId), min, max);
  }

  /**
   * Range alerts whose lower OR upper boundary falls within the tick's [prev, curr] movement
   * interval - i.e. every alert whose boundary could plausibly have just been crossed.
   */
  async candidatesRangeNear(instrumentId: string, prev: number, curr: number): Promise<string[]> {
    const [lo, hi] = prev < curr ? [prev, curr] : [curr, prev];
    const [lowerHits, upperHits] = await Promise.all([
      this.redis.zrangebyscore(registryKey("range-lower", instrumentId), lo, hi),
      this.redis.zrangebyscore(registryKey("range-upper", instrumentId), lo, hi),
    ]);
    return [...new Set([...lowerHits, ...upperHits])];
  }

  /**
   * Atomically decides whether this alert fires for `transitionId`: re-checks status, expiry and
   * cooldown, claims the idempotency key, records the trigger time, and (for one-shot alerts)
   * flips status to TRIGGERED - all in one script, so two ticks evaluated at the same moment can
   * never both pass the checks. Returns the previous lastTriggeredAt so releaseTrigger() can undo
   * the claim if the trigger job can't be enqueued.
   */
  async claimTrigger(alertId: string, transitionId: string, nowMs: number): Promise<{ claimed: boolean; previousLastTriggeredAt: string }> {
    const [claimed, previous] = (await this.redis.eval(
      CLAIM_TRIGGER_LUA,
      2,
      alertHashKey(alertId),
      idempotencyKey(alertId, transitionId),
      String(nowMs),
    )) as [number, string];
    return { claimed: claimed === 1, previousLastTriggeredAt: previous ?? "" };
  }

  /** Reverses claimTrigger() so the alert can fire on its next crossing. */
  async releaseTrigger(alertId: string, transitionId: string, previousLastTriggeredAt: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.hset(alertHashKey(alertId), { status: "ACTIVE", lastTriggeredAt: previousLastTriggeredAt });
    pipeline.del(idempotencyKey(alertId, transitionId));
    await pipeline.exec();
  }

  /** Rebuilds every registry from Postgres. Called on API boot since Redis is a rebuildable index, not source of truth. */
  async clearAll(): Promise<void> {
    const stream = this.redis.scanStream({ match: "alerts:*", count: 200 });
    for await (const keys of stream) {
      if ((keys as string[]).length > 0) await this.redis.del(...(keys as string[]));
    }
    const alertKeysStream = this.redis.scanStream({ match: "alert:*", count: 200 });
    for await (const keys of alertKeysStream) {
      if ((keys as string[]).length > 0) await this.redis.del(...(keys as string[]));
    }
  }
}
