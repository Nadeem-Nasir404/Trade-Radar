import { Module } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { AlertsController } from "./alerts.controller";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { AlertEngineModule } from "../alert-engine/alert-engine.module";
import { MarketDataModule } from "../market-data/market-data.module";
import { PriceCacheModule } from "../market-data/price-cache/price-cache.module";

@Module({
  imports: [SubscriptionsModule, AlertEngineModule, MarketDataModule, PriceCacheModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
