import { Controller, Get, Param, Query } from "@nestjs/common";
import { AlertEventsService } from "./alert-events.service";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";

const MAX_PAGE_SIZE = 100;

/** Clamps ?limit= to 1..100; anything unparseable falls back to the service default. */
function parsePageSize(raw: string | undefined): number | undefined {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, 1), MAX_PAGE_SIZE);
}

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
      limit: parsePageSize(limit),
    });
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertEvents.getOne(user.id, id);
  }
}
