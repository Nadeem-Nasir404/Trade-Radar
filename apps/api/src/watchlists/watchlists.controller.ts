import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { WatchlistsService } from "./watchlists.service";
import { CreateWatchlistDto, AddWatchlistItemDto, ReorderWatchlistDto } from "./dto/watchlist.dto";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";

@Controller("watchlists")
export class WatchlistsController {
  constructor(private readonly watchlists: WatchlistsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.watchlists.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWatchlistDto) {
    return this.watchlists.create(user.id, dto.name);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.watchlists.remove(user.id, id);
  }

  @Post(":id/items")
  addItem(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: AddWatchlistItemDto) {
    return this.watchlists.addItem(user.id, id, dto.instrumentId);
  }

  @Delete(":id/items/:itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Param("itemId") itemId: string) {
    await this.watchlists.removeItem(user.id, id, itemId);
  }

  @Post(":id/reorder")
  @HttpCode(HttpStatus.OK)
  async reorder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ReorderWatchlistDto) {
    await this.watchlists.reorder(user.id, id, dto.itemIdsInOrder);
    return { success: true };
  }
}
