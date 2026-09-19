import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EventsGateway } from "./events.gateway";
import { MarketDataModule } from "../market-data/market-data.module";

@Module({
  imports: [JwtModule.register({}), MarketDataModule],
  providers: [EventsGateway],
})
export class WebsocketModule {}
