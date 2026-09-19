import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type Redis from "ioredis";
import { InjectRedis } from "../redis/inject-redis.decorator";

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async check(key = "redis") {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await this.redis.ping();
      if (pong !== "PONG") throw new Error(`Unexpected PING reply: ${pong}`);
      return indicator.up();
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
