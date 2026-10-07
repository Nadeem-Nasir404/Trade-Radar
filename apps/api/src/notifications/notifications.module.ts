import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationDispatchService } from "./notification-dispatch.service";
import { NotificationContextService } from "./notification-context.service";
import { DeliveryStatusService } from "./delivery-status.service";
import { EmailProcessor } from "./processors/email.processor";
import { WebPushProcessor } from "./processors/webpush.processor";
import { TelegramProcessor } from "./processors/telegram.processor";
import { DiscordProcessor } from "./processors/discord.processor";
import { ExpoPushProcessor } from "./processors/expo-push.processor";

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    NotificationContextService,
    DeliveryStatusService,
    EmailProcessor,
    WebPushProcessor,
    TelegramProcessor,
    DiscordProcessor,
    ExpoPushProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
