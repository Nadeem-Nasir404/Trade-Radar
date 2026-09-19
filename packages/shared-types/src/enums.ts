// Plain `as const` objects + derived union types, not TS `enum` - this matches how Prisma
// generates its own schema enums (a union of string literals, not a nominal enum) so values
// from either side are freely interchangeable, and plain string literals ("WEBPUSH", etc.),
// which the frontend uses constantly in JSX/comparisons, are assignable without friction.

export const UserRole = { USER: "USER", ADMIN: "ADMIN" } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PlanTier = { FREE: "FREE", PRO: "PRO", MAX: "MAX" } as const;
export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

export const SubscriptionStatus = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  PAST_DUE: "PAST_DUE",
  TRIALING: "TRIALING",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const AssetType = {
  CRYPTO: "CRYPTO",
  FOREX: "FOREX",
  COMMODITY: "COMMODITY",
  INDEX: "INDEX",
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const ProviderType = {
  BINANCE: "BINANCE",
  COINBASE: "COINBASE",
  KRAKEN: "KRAKEN",
  COINGECKO: "COINGECKO",
  TWELVE_DATA: "TWELVE_DATA",
  MOCK: "MOCK",
} as const;
export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

/**
 * Every value below maps 1:1 to a Redis registry / evaluation path in the alert engine.
 * See apps/api/src/alert-engine for how each is evaluated.
 */
export const ConditionType = {
  ABOVE: "ABOVE",
  BELOW: "BELOW",
  CROSSES_ABOVE: "CROSSES_ABOVE",
  CROSSES_BELOW: "CROSSES_BELOW",
  ENTERS_RANGE: "ENTERS_RANGE",
  EXITS_RANGE: "EXITS_RANGE",
  EQUALS: "EQUALS",
  PCT_CHANGE: "PCT_CHANGE",
  PCT_CHANGE_WINDOW: "PCT_CHANGE_WINDOW",
} as const;
export type ConditionType = (typeof ConditionType)[keyof typeof ConditionType];

export const AlertStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  TRIGGERED: "TRIGGERED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const NotificationChannelType = {
  EMAIL: "EMAIL",
  WEBPUSH: "WEBPUSH",
  TELEGRAM: "TELEGRAM",
  DISCORD: "DISCORD",
  EXPO_PUSH: "EXPO_PUSH",
} as const;
export type NotificationChannelType = (typeof NotificationChannelType)[keyof typeof NotificationChannelType];

export const DeliveryStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  RETRYING: "RETRYING",
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

/** Directional threshold conditions that resolve into the above/below ZSET registries. */
export const UPWARD_CONDITIONS = [ConditionType.ABOVE, ConditionType.CROSSES_ABOVE] as const;
export const DOWNWARD_CONDITIONS = [ConditionType.BELOW, ConditionType.CROSSES_BELOW] as const;
