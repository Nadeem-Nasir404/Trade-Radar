import { PlanTier } from "./enums";

export interface PlanDefinition {
  tier: PlanTier;
  label: string;
  maxActiveAlerts: number;
  maxWatchlists: number;
  maxAlertGroups: number;
  priceMonthlyUsd: number;
  features: string[];
}

/**
 * The core product promise ("Set every level. Miss nothing.") lives here as data, not marketing
 * copy: these ceilings are the actual backend-enforced quota (see SubscriptionsModule.canCreateAlert),
 * deliberately generous relative to the "3 active alerts" ceilings common on trading platforms.
 */
export const PLAN_LIMITS: Record<PlanTier, PlanDefinition> = {
  [PlanTier.FREE]: {
    tier: PlanTier.FREE,
    label: "Free",
    maxActiveAlerts: 50,
    maxWatchlists: 2,
    maxAlertGroups: 1,
    priceMonthlyUsd: 0,
    features: [
      "Up to 50 active alerts",
      "Basic price alerts (above/below/crosses)",
      "Browser notifications",
      "2 watchlists",
    ],
  },
  [PlanTier.PRO]: {
    tier: PlanTier.PRO,
    label: "Pro",
    maxActiveAlerts: 300,
    maxWatchlists: 20,
    maxAlertGroups: 25,
    priceMonthlyUsd: 15,
    features: [
      "Up to 300 active alerts",
      "Advanced alert types (range, volatility, volume, MA cross)",
      "Telegram + Discord + Email notifications",
      "Alert groups & Level Map",
      "20 watchlists",
    ],
  },
  [PlanTier.MAX]: {
    tier: PlanTier.MAX,
    label: "Max",
    maxActiveAlerts: 2000,
    maxWatchlists: 100,
    maxAlertGroups: 200,
    priceMonthlyUsd: 39,
    features: [
      "Up to 2000 active alerts",
      "Multi-condition alerts",
      "Priority infrastructure",
      "Expanded market coverage (gold, FX, indices)",
      "Priority support",
    ],
  },
};

export function getPlanLimit(tier: PlanTier): PlanDefinition {
  return PLAN_LIMITS[tier];
}
