import { formatCompactPrice } from "@/lib/utils";
import type { Alert } from "@/lib/api/types";

export function formatConditionLabel(conditionType: string): string {
  switch (conditionType) {
    case "ABOVE":
      return "Above";
    case "BELOW":
      return "Below";
    case "CROSSES_ABOVE":
      return "Crosses Above";
    case "CROSSES_BELOW":
      return "Crosses Below";
    case "EQUALS":
      return "Equals";
    case "ENTERS_RANGE":
      return "Enters Range";
    case "EXITS_RANGE":
      return "Exits Range";
    case "PCT_CHANGE":
      return "% Change";
    case "PCT_CHANGE_WINDOW":
      return "% Change (window)";
    default:
      return conditionType;
  }
}

export function formatAlertTarget(alert: Pick<Alert, "conditionType" | "targetValue" | "secondaryValue">): string {
  if (alert.conditionType === "PCT_CHANGE" || alert.conditionType === "PCT_CHANGE_WINDOW") {
    return `${alert.targetValue > 0 ? "+" : ""}${alert.targetValue}%`;
  }
  if ((alert.conditionType === "ENTERS_RANGE" || alert.conditionType === "EXITS_RANGE") && alert.secondaryValue !== null) {
    return `${formatCompactPrice(alert.targetValue)} – ${formatCompactPrice(alert.secondaryValue)}`;
  }
  return formatCompactPrice(alert.targetValue);
}

export function isUpwardCondition(conditionType: string): boolean {
  return conditionType === "ABOVE" || conditionType === "CROSSES_ABOVE" || conditionType === "ENTERS_RANGE";
}

/** % from `price` to a price-level alert's target (positive = price above it); null for conditions without a single level. */
export function computeDistancePct(price: number | null, alert: { conditionType: string; targetValue: number }): number | null {
  if (price === null || alert.targetValue === 0) return null;
  if (!["ABOVE", "BELOW", "CROSSES_ABOVE", "CROSSES_BELOW", "EQUALS"].includes(alert.conditionType)) return null;
  return ((price - alert.targetValue) / alert.targetValue) * 100;
}
