import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { REGISTERED_QUEUES } from "./registered-queues";

/**
 * Listens for "error" on every queue. Like workers, BullMQ queues re-emit Redis connection
 * failures as "error" events, and with no listener that throws and takes the API down. Logged
 * here (at most once per 10s per queue), the queue reconnects on its own.
 */
@Injectable()
export class QueueErrorListener implements OnModuleInit {
  private readonly logger = new Logger(QueueErrorListener.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    for (const name of REGISTERED_QUEUES) {
      const queue = this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
      let last = 0;
      queue.on("error", (err: Error) => {
        const now = Date.now();
        if (now - last < 10_000) return;
        last = now;
        this.logger.warn(`Queue ${name} error (retrying): ${err.message}`);
      });
    }
  }
}
