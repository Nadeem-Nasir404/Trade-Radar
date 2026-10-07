import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { MarketDataModule } from "../market-data/market-data.module";

@Module({
  imports: [
    MarketDataModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
