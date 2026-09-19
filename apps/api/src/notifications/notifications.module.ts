import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@levelpulse/shared-types";
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
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFY_EMAIL },
      { name: QUEUE_NAMES.NOTIFY_WEBPUSH },
      { name: QUEUE_NAMES.NOTIFY_TELEGRAM },
      { name: QUEUE_NAMES.NOTIFY_DISCORD },
      { name: QUEUE_NAMES.NOTIFY_EXPO_PUSH },
    ),
  ],
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
