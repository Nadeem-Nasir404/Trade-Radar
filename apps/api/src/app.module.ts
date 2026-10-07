import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";
import type Redis from "ioredis";
import { validateEnv, type EnvConfig } from "./common/config/env.validation";
import { HttpThrottlerGuard } from "./common/guards/http-throttler.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { REDIS_CLIENT } from "./redis/redis.constants";
import { QueuesModule } from "./queues/queues.module";
import { MailerModule } from "./common/mailer/mailer.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { InstrumentsModule } from "./instruments/instruments.module";
import { MarketDataModule } from "./market-data/market-data.module";
import { AlertEngineModule } from "./alert-engine/alert-engine.module";
import { AlertsModule } from "./alerts/alerts.module";
import { AlertEventsModule } from "./alert-events/alert-events.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { WatchlistsModule } from "./watchlists/watchlists.module";
import { AdminModule } from "./admin/admin.module";
import { WebsocketModule } from "./websocket/websocket.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [".env.local", ".env"],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        throttlers: [
          {
            ttl: config.get("THROTTLE_TTL_MS", { infer: true }),
            limit: config.get("THROTTLE_LIMIT", { infer: true }),
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // Queues and workers share the app's Redis client for ordinary commands; BullMQ only opens
    // its own connection for each worker's blocking wait. One process holds about 7 connections
    // instead of 24, which matters on hosted plans with low connection caps.
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({ connection: redis }),
    }),
    QueuesModule,
    PrismaModule,
    RedisModule,
    MailerModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    InstrumentsModule,
    MarketDataModule,
    AlertEngineModule,
    AlertsModule,
    AlertEventsModule,
    NotificationsModule,
    WatchlistsModule,
    AdminModule,
    WebsocketModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
export class AppModule {}
