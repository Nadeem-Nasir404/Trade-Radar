export function formatCompactPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const decimals = value < 1 ? 6 : value < 100 ? 4 : 2;
  return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatTime(value: string | number | Date | null | undefined): string {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(new Date(value));
}

export function isSameDay(value: string | number | Date, reference: Date = new Date()): boolean {
  const d = new Date(value);
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth() && d.getDate() === reference.getDate();
}

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

export function formatAlertTarget(alert: { conditionType: string; targetValue: number; secondaryValue: number | null }): string {
  if (alert.conditionType === "PCT_CHANGE" || alert.conditionType === "PCT_CHANGE_WINDOW") {
    return `${alert.targetValue > 0 ? "+" : ""}${alert.targetValue}%`;
  }
  if ((alert.conditionType === "ENTERS_RANGE" || alert.conditionType === "EXITS_RANGE") && alert.secondaryValue !== null) {
    return `${formatCompactPrice(alert.targetValue)} – ${formatCompactPrice(alert.secondaryValue)}`;
  }
  return formatCompactPrice(alert.targetValue);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up watching?";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function isUpwardCondition(conditionType: string, targetValue?: number): boolean {
  if (conditionType === "PCT_CHANGE" || conditionType === "PCT_CHANGE_WINDOW") return (targetValue ?? 0) >= 0;
  return conditionType === "ABOVE" || conditionType === "CROSSES_ABOVE" || conditionType === "ENTERS_RANGE";
}

// Only meaningful for simple single-price-target conditions - PCT_CHANGE/RANGE/EQUALS distance
// isn't "(price - target) / target" so callers should fall back to the server-computed
// Alert.distancePct for those instead of calling this.
export function computeDistancePct(price: number | null, alert: { conditionType: string; targetValue: number }): number | null {
  if (price === null || alert.targetValue === 0) return null;
  if (alert.conditionType !== "ABOVE" && alert.conditionType !== "BELOW" && alert.conditionType !== "CROSSES_ABOVE" && alert.conditionType !== "CROSSES_BELOW") {
    return null;
  }
  return ((price - alert.targetValue) / alert.targetValue) * 100;
}
