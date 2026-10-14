import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface NotificationContext {
  userEmail: string;
  userName: string | null;
  symbol: string;
  instrumentId: string;
  conditionType: string;
  targetValue: string;
  observedPrice: string;
  eventTime: Date;
  alertId: string;
  /** A repeat reminder that the level is still crossed, rather than a new crossing. */
  isReminder: boolean;
}

/** Shared by every channel processor to build the human-readable message content for a delivery. */
@Injectable()
export class NotificationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(alertEventId: string, userId: string): Promise<NotificationContext | null> {
    if (alertEventId === "test") {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) return null;
      return {
        userEmail: user.email,
        userName: user.name,
        symbol: "BTC/USDT",
        instrumentId: "",
        conditionType: "CROSSES_ABOVE",
        targetValue: "100000",
        observedPrice: "100000.42",
        eventTime: new Date(),
        alertId: "",
        isReminder: false,
      };
    }

    const alertEvent = await this.prisma.alertEvent.findUnique({
      where: { id: alertEventId },
      include: { user: true, alert: { include: { instrument: true } } },
    });
    if (!alertEvent) return null;

    return {
      userEmail: alertEvent.user.email,
      userName: alertEvent.user.name,
      symbol: alertEvent.alert.instrument.displaySymbol,
      instrumentId: alertEvent.instrumentId,
      conditionType: alertEvent.conditionType,
      targetValue: alertEvent.targetValue.toString(),
      observedPrice: alertEvent.observedPrice.toString(),
      eventTime: alertEvent.eventTime,
      alertId: alertEvent.alertId,
      isReminder: alertEvent.isReminder,
    };
  }
}

export function formatConditionText(conditionType: string, targetValue: string, isReminder = false): string {
  if (isReminder) return formatReminderText(conditionType, targetValue);
  switch (conditionType) {
    case "ABOVE":
      return `is above ${targetValue}`;
    case "BELOW":
      return `is below ${targetValue}`;
    case "CROSSES_ABOVE":
      return `crossed above ${targetValue}`;
    case "CROSSES_BELOW":
      return `crossed below ${targetValue}`;
    case "EQUALS":
      return `hit ${targetValue}`;
    case "PCT_CHANGE":
    case "PCT_CHANGE_WINDOW":
      return `moved ${targetValue}%`;
    case "ENTERS_RANGE":
      return `entered your range`;
    case "EXITS_RANGE":
      return `exited your range`;
    default:
      return `reached ${targetValue}`;
  }
}

/** Wording for a repeat reminder: the alert already fired, and the level is still crossed. */
function formatReminderText(conditionType: string, targetValue: string): string {
  switch (conditionType) {
    case "ABOVE":
    case "CROSSES_ABOVE":
      return `is still above ${targetValue}`;
    case "BELOW":
    case "CROSSES_BELOW":
      return `is still below ${targetValue}`;
    case "ENTERS_RANGE":
      return `is still inside your range`;
    case "EXITS_RANGE":
      return `is still outside your range`;
    case "PCT_CHANGE":
      return `is still past ${targetValue}%`;
    default:
      return `is still past your level`;
  }
}
