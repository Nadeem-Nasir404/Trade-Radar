import { Controller, Get, Param, Query } from "@nestjs/common";
import { InstrumentsService } from "./instruments.service";
import { CoinGeckoService } from "./coingecko.service";
import { ListInstrumentsDto } from "./dto/list-instruments.dto";
import { Public } from "../common/decorators/public.decorator";

@Controller("markets")
export class InstrumentsController {
  constructor(
    private readonly instruments: InstrumentsService,
    private readonly coingecko: CoinGeckoService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListInstrumentsDto) {
    return this.instruments.list(query);
  }

  @Public()
  @Get("discover")
  discover(@Query("q") q: string) {
    if (!q || q.trim().length === 0) return [];
    return this.coingecko.search(q.trim());
  }

  @Public()
  @Get(":symbol")
  getBySymbol(@Param("symbol") symbol: string) {
    return this.instruments.getBySymbol(symbol);
  }
}
