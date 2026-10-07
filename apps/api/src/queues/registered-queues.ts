import { QUEUE_NAMES } from "@levelpulse/shared-types";

/** The queues this API registers (QUEUE_NAMES also lists names nothing uses yet). */
export const REGISTERED_QUEUES = [
  QUEUE_NAMES.ALERT_TRIGGER,
  QUEUE_NAMES.NOTIFY_EMAIL,
  QUEUE_NAMES.NOTIFY_WEBPUSH,
  QUEUE_NAMES.NOTIFY_TELEGRAM,
  QUEUE_NAMES.NOTIFY_DISCORD,
  QUEUE_NAMES.NOTIFY_EXPO_PUSH,
] as const;
