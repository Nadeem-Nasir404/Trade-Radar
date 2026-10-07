export const ALERT_TRIGGERED_EVENT = "alert.triggered";

/** Emitted after AlertTriggerProcessor durably persists an AlertEvent. NotificationsModule and
 *  the WS gateway both react to this via @OnEvent - AlertEngineModule imports neither. */
export interface AlertTriggeredPayload {
  alertEventId: string;
  alertId: string;
  userId: string;
  instrumentId: string;
  symbol: string;
  conditionType: string;
  targetValue: string;
  observedPrice: string;
  eventTime: number;
  /** True when this trigger ended the alert (one-shot), so its market feed can be released. */
  deactivated: boolean;
}
