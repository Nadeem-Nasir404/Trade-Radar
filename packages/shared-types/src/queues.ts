import { NotificationChannelType } from "./enums";

export const QUEUE_NAMES = {
  ALERT_TRIGGER: "alert-trigger",
  // BullMQ queue names may not contain ":" (it namespaces Redis keys internally).
  NOTIFY_EMAIL: "notify-email",
  NOTIFY_WEBPUSH: "notify-webpush",
  NOTIFY_TELEGRAM: "notify-telegram",
  NOTIFY_DISCORD: "notify-discord",
  NOTIFY_EXPO_PUSH: "notify-expo-push",
  PCT_WINDOW_EVAL: "pct-window-eval",
  SUBSCRIPTION_SWEEP: "subscription-sweep",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const NOTIFICATION_QUEUE_BY_CHANNEL: Record<NotificationChannelType, QueueName> = {
  [NotificationChannelType.EMAIL]: QUEUE_NAMES.NOTIFY_EMAIL,
  [NotificationChannelType.WEBPUSH]: QUEUE_NAMES.NOTIFY_WEBPUSH,
  [NotificationChannelType.TELEGRAM]: QUEUE_NAMES.NOTIFY_TELEGRAM,
  [NotificationChannelType.DISCORD]: QUEUE_NAMES.NOTIFY_DISCORD,
  [NotificationChannelType.EXPO_PUSH]: QUEUE_NAMES.NOTIFY_EXPO_PUSH,
};

/** Job payload enqueued by AlertEngineService.tryTrigger() onto QUEUE_NAMES.ALERT_TRIGGER. */
export interface AlertTriggerJobPayload {
  alertId: string;
  userId: string;
  instrumentId: string;
  conditionType: string;
  targetValue: string;
  observedPrice: string;
  previousPrice: string;
  eventTime: number;
  receivedTime: number;
  providerId: string;
  transitionId: string;
}

/** Job payload enqueued per enabled channel by NotificationDispatchService. */
export interface NotificationJobPayload {
  alertEventId: string;
  userId: string;
  deliveryId: string;
}
