import { Module } from "@nestjs/common";
import { InstrumentsService } from "./instruments.service";
import { InstrumentsController } from "./instruments.controller";
import { CoinGeckoService } from "./coingecko.service";
import { PriceCacheModule } from "../market-data/price-cache/price-cache.module";

@Module({
  imports: [PriceCacheModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsService, CoinGeckoService],
  exports: [InstrumentsService, CoinGeckoService],
})
export class InstrumentsModule {}
