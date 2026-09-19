import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@levelpulse/shared-types";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { MarketDataModule } from "../market-data/market-data.module";

@Module({
  imports: [
    MarketDataModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ALERT_TRIGGER },
      { name: QUEUE_NAMES.NOTIFY_EMAIL },
      { name: QUEUE_NAMES.NOTIFY_WEBPUSH },
      { name: QUEUE_NAMES.NOTIFY_TELEGRAM },
      { name: QUEUE_NAMES.NOTIFY_DISCORD },
    ),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
