import { Module } from "@nestjs/common";
import { WatchlistsService } from "./watchlists.service";
import { WatchlistsController } from "./watchlists.controller";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { PriceCacheModule } from "../market-data/price-cache/price-cache.module";

@Module({
  imports: [SubscriptionsModule, PriceCacheModule],
  controllers: [WatchlistsController],
  providers: [WatchlistsService],
})
export class WatchlistsModule {}
