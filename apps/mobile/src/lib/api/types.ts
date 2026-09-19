import type { AssetType, ConditionType, AlertStatus, PlanTier, NotificationChannelType } from "@levelpulse/shared-types";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  currency: string;
  role: "USER" | "ADMIN";
  createdAt: string;
}

export interface Subscription {
  id: string;
  plan: PlanTier;
  status: string;
  maxActiveAlerts: number;
  currentPeriodEnd: string | null;
}

export interface PlanDefinition {
  tier: PlanTier;
  label: string;
  maxActiveAlerts: number;
  maxWatchlists: number;
  maxAlertGroups: number;
  priceMonthlyUsd: number;
  features: string[];
}

export interface Instrument {
  id: string;
  symbol: string;
  displaySymbol: string;
  name: string | null;
  assetType: AssetType;
  quoteCurrency: string | null;
  provider: string;
  exchange: string | null;
  iconUrl: string | null;
  price: number | null;
  changePct24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  feedStatus: "LIVE" | "STALE" | "UNKNOWN";
  isDemo: boolean;
  lastUpdateAt: number | null;
}

export interface ChannelPref {
  channelType: NotificationChannelType;
  isEnabled: boolean;
}

export interface Alert {
  id: string;
  instrumentId: string;
  symbol: string;
  iconUrl: string | null;
  provider: string;
  exchange: string | null;
  assetType: AssetType;
  conditionType: ConditionType;
  targetValue: number;
  secondaryValue: number | null;
  timeframe: string | null;
  status: AlertStatus;
  isRecurring: boolean;
  cooldownSeconds: number;
  triggerCount: number;
  lastTriggeredAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  tags: string[];
  alertGroupId: string | null;
  alertGroupName: string | null;
  channels: ChannelPref[];
  currentPrice: number | null;
  distancePct: number | null;
  createdAt: string;
}

export interface AlertGroup {
  id: string;
  name: string;
  isPaused: boolean;
  _count: { alerts: number };
}

export interface WatchlistItem {
  id: string;
  instrumentId: string;
  symbol: string;
  iconUrl: string | null;
  assetType: AssetType;
  price: number | null;
  changePct24h: number | null;
  alertCount: number;
  sortOrder: number;
}

export interface Watchlist {
  id: string;
  name: string;
  isDefault: boolean;
  items: WatchlistItem[];
}

export interface AlertEventDelivery {
  channelType: NotificationChannelType;
  status: string;
  sentAt: string | null;
  latencyMs: number | null;
  failReason: string | null;
}

export interface AlertEvent {
  id: string;
  alertId: string;
  instrumentId: string;
  symbol: string;
  conditionType: ConditionType;
  targetValue: number;
  observedPrice: number;
  previousPrice: number | null;
  provider: string;
  exchange: string | null;
  eventTime: string;
  receivedTime: string;
  latencyMs: number;
  deliveries: AlertEventDelivery[];
}

export interface NotificationChannel {
  id: string;
  type: NotificationChannelType;
  isEnabled: boolean;
  isVerified: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CoinGeckoSearchResult {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
  thumb: string | null;
}
