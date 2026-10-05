import { Controller, Get, Param, Query } from "@nestjs/common";
import type { Timeframe } from "@levelpulse/shared-types";
import { MarketDataService } from "./market-data.service";
import { InstrumentsService } from "../instruments/instruments.service";
import { Public } from "../common/decorators/public.decorator";

const VALID_TIMEFRAMES: Timeframe[] = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];

@Controller("markets")
export class MarketDataController {
  constructor(
    private readonly marketData: MarketDataService,
    private readonly instruments: InstrumentsService,
  ) {}

  @Public()
  @Get(":symbol/history")
  async history(@Param("symbol") symbol: string, @Query("timeframe") timeframe?: string) {
    const instrument = await this.instruments.getBySymbol(symbol);
    const tf = VALID_TIMEFRAMES.includes(timeframe as Timeframe) ? (timeframe as Timeframe) : "15m";
    return this.marketData.getHistoricalCandles(instrument.id, tf);
  }
}
