import { Module } from "@nestjs/common";
import { PriceCacheService } from "./price-cache.service";

@Module({
  providers: [PriceCacheService],
  exports: [PriceCacheService],
})
export class PriceCacheModule {}
