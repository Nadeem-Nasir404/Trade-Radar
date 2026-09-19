import { Global, Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";
import type { EnvConfig } from "../common/config/env.validation";

const logger = new Logger("RedisModule");

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => {
        const url = config.get("REDIS_URL", { infer: true });
        const client = new Redis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });
        client.on("connect", () => logger.log(`Connected to Redis at ${url}`));
        client.on("error", (err) => logger.error(`Redis connection error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
