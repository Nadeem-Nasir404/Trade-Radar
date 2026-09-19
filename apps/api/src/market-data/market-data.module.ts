import { Module } from "@nestjs/common";
import { MarketDataService } from "./market-data.service";
import { MarketDataController } from "./market-data.controller";
import { SubscriptionRegistryService } from "./subscription-registry.service";
import { MockMarketDataProvider } from "./providers/mock/mock-market-data.provider";
import { BinanceProvider } from "./providers/binance/binance.provider";
import { TwelveDataProvider } from "./providers/twelvedata/twelvedata.provider";
import { PriceCacheModule } from "./price-cache/price-cache.module";
import { InstrumentsModule } from "../instruments/instruments.module";

@Module({
  imports: [PriceCacheModule, InstrumentsModule],
  controllers: [MarketDataController],
  providers: [MarketDataService, SubscriptionRegistryService, MockMarketDataProvider, BinanceProvider, TwelveDataProvider],
  exports: [MarketDataService, SubscriptionRegistryService],
})
export class MarketDataModule {}
