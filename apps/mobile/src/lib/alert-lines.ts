import type { ConditionType } from "@levelpulse/shared-types";
import type { Alert } from "@/lib/api/types";
import { isUpwardCondition } from "@/lib/format";

/** One alert level drawn on the chart. */
export interface ChartAlertLevel {
  /** Alert id; the chart echoes it back when the line is dragged or swiped away. */
  id: string;
  price: number;
  up: boolean;
  /** Single-price alerts can be dragged to a new level or swiped away; range edges stay put. */
  draggable: boolean;
}

/** Conditions with a single price level (one line on the chart). */
const SINGLE_LEVEL = new Set<string>(["ABOVE", "BELOW", "CROSSES_ABOVE", "CROSSES_BELOW", "EQUALS"]);
const RANGE = new Set<string>(["ENTERS_RANGE", "EXITS_RANGE"]);
/** Triggered and expired alerts still show as lines, but only live ones can be edited. */
const EDITABLE_STATUS = new Set<string>(["ACTIVE", "PAUSED"]);

/**
 * The chart lines for a coin's alerts. Percent-change alerts have no price level (their target is
 * a percentage), so they draw nothing; range alerts draw both edges.
 */
export function chartAlertLevels(alerts: Alert[]): ChartAlertLevel[] {
  const levels: ChartAlertLevel[] = [];
  for (const a of alerts) {
    const up = isUpwardCondition(a.conditionType, a.targetValue);
    if (SINGLE_LEVEL.has(a.conditionType)) {
      levels.push({ id: a.id, price: a.targetValue, up, draggable: EDITABLE_STATUS.has(a.status) });
    } else if (RANGE.has(a.conditionType)) {
      levels.push({ id: `${a.id}:low`, price: a.targetValue, up, draggable: false });
      if (a.secondaryValue != null) levels.push({ id: `${a.id}:high`, price: a.secondaryValue, up, draggable: false });
    }
  }
  return levels;
}

/**
 * The condition for an alert moved to `price`: above-type when the new level is above the current
 * price, below-type when under it, so the alert still fires when price reaches the line.
 * EQUALS ("hit") has no direction and stays as it is.
 */
export function conditionForLevel(conditionType: ConditionType, price: number, currentPrice: number | null): ConditionType {
  if (currentPrice == null) return conditionType;
  const above = price > currentPrice;
  if (conditionType === "CROSSES_ABOVE" || conditionType === "CROSSES_BELOW") return above ? "CROSSES_ABOVE" : "CROSSES_BELOW";
  if (conditionType === "ABOVE" || conditionType === "BELOW") return above ? "ABOVE" : "BELOW";
  return conditionType;
}
