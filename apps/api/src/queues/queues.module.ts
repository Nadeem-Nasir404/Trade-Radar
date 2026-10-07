import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@levelpulse/shared-types";

/**
 * Registers every BullMQ queue exactly once. Each registerQueue() call creates its own Queue
 * instance, so registering the same queue in several feature modules multiplied Redis
 * connections; feature modules now inject queues from here instead.
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ALERT_TRIGGER },
      { name: QUEUE_NAMES.NOTIFY_EMAIL },
      { name: QUEUE_NAMES.NOTIFY_WEBPUSH },
      { name: QUEUE_NAMES.NOTIFY_TELEGRAM },
      { name: QUEUE_NAMES.NOTIFY_DISCORD },
      { name: QUEUE_NAMES.NOTIFY_EXPO_PUSH },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
