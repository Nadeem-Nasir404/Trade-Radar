import { Controller, Get, Param, Query } from "@nestjs/common";
import { AlertEventsService } from "./alert-events.service";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";

@Controller("alert-events")
export class AlertEventsController {
  constructor(private readonly alertEvents: AlertEventsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("instrumentId") instrumentId?: string,
    @Query("alertId") alertId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.alertEvents.list(user.id, {
      instrumentId,
      alertId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertEvents.getOne(user.id, id);
  }
}
