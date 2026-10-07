import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { REGISTERED_QUEUES } from "./registered-queues";
import { QueueErrorListener } from "./queue-error-listener";

/**
 * Registers every BullMQ queue exactly once. Each registerQueue() call creates its own Queue
 * instance, so registering the same queue in several feature modules multiplied Redis
 * connections; feature modules now inject queues from here instead.
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue(...REGISTERED_QUEUES.map((name) => ({ name }))),
  ],
  providers: [QueueErrorListener],
  exports: [BullModule],
})
export class QueuesModule {}
