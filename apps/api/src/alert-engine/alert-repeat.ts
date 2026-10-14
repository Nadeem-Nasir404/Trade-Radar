import { REPEATABLE_CONDITIONS } from "@levelpulse/shared-types";

/** True when this alert should keep reminding the user after it fires (see AlertRepeatService). */
export function repeatsReminders(alert: { repeatIntervalMinutes: number | null; conditionType: string }): boolean {
  return alert.repeatIntervalMinutes != null && (REPEATABLE_CONDITIONS as readonly string[]).includes(alert.conditionType);
}

/**
 * Whether a fired alert's condition still holds at `price` - the test for sending another
 * reminder. Crossing conditions become their lasting state (crossed above -> is above), ranges
 * keep checking inside/outside, and PCT_CHANGE compares against the baseline captured at
 * creation (stored in secondaryValue, see AlertsService.create).
 */
export function isConditionStillMet(
  alert: { conditionType: string; targetValue: number; secondaryValue: number | null },
  price: number,
): boolean {
  const target = alert.targetValue;
  switch (alert.conditionType) {
    case "ABOVE":
    case "CROSSES_ABOVE":
      return price >= target;
    case "BELOW":
    case "CROSSES_BELOW":
      return price <= target;
    case "ENTERS_RANGE":
      return alert.secondaryValue != null && price >= target && price <= alert.secondaryValue;
    case "EXITS_RANGE":
      return alert.secondaryValue != null && (price < target || price > alert.secondaryValue);
    case "PCT_CHANGE": {
      const baseline = alert.secondaryValue;
      if (!baseline) return false;
      const pct = ((price - baseline) / baseline) * 100;
      return target >= 0 ? pct >= target : pct <= target;
    }
    default:
      return false;
  }
}
