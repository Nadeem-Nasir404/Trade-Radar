import { Injectable } from "@nestjs/common";
import { DeliveryStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DeliveryStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async markSent(deliveryId: string, latencyMs: number): Promise<void> {
    if (deliveryId === "test") return;
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: DeliveryStatus.SENT, sentAt: new Date(), latencyMs, attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });
  }

  async markFailed(deliveryId: string, reason: string, willRetry: boolean): Promise<void> {
    if (deliveryId === "test") return;
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: willRetry ? DeliveryStatus.RETRYING : DeliveryStatus.FAILED,
        failReason: reason.slice(0, 500),
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }
}
