import { Logger } from "@nestjs/common";
import { OnWorkerEvent, WorkerHost } from "@nestjs/bullmq";

/**
 * WorkerHost that handles its worker's "error" events. BullMQ emits connection failures (Redis
 * down, "max number of clients reached") as "error" events, and an EventEmitter with no "error"
 * listener throws, which crashed the whole API on boot. Logged here, the worker keeps retrying
 * and recovers when Redis is reachable again.
 */
export abstract class ResilientWorkerHost extends WorkerHost {
  private readonly workerLogger = new Logger(this.constructor.name);
  private lastErrorLog = 0;

  @OnWorkerEvent("error")
  onWorkerError(err: Error) {
    // A refused connection repeats several times a second; one line every 10s is enough.
    const now = Date.now();
    if (now - this.lastErrorLog < 10_000) return;
    this.lastErrorLog = now;
    this.workerLogger.warn(`Worker error (retrying): ${err.message}`);
  }
}
