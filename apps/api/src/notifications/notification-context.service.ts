import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface NotificationContext {
  userEmail: string;
  userName: string | null;
  symbol: string;
  conditionType: string;
  targetValue: string;
  observedPrice: string;
  eventTime: Date;
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
        conditionType: "CROSSES_ABOVE",
        targetValue: "100000",
        observedPrice: "100000.42",
        eventTime: new Date(),
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
      conditionType: alertEvent.conditionType,
      targetValue: alertEvent.targetValue.toString(),
      observedPrice: alertEvent.observedPrice.toString(),
      eventTime: alertEvent.eventTime,
    };
  }
}

export function formatConditionText(conditionType: string, targetValue: string): string {
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
