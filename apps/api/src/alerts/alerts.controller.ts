import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { UpdateAlertDto } from "./dto/update-alert.dto";
import { ListAlertsDto } from "./dto/list-alerts.dto";
import { CreateAlertGroupDto } from "./dto/alert-group.dto";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAlertsDto) {
    return this.alertsService.findAllForUser(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(user.id, dto);
  }

  @Get("groups")
  listGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.listGroups(user.id);
  }

  @Post("groups")
  createGroup(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlertGroupDto) {
    return this.alertsService.createGroup(user.id, dto.name);
  }

  @Post("groups/:id/pause")
  @HttpCode(HttpStatus.OK)
  pauseGroup(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.setGroupPaused(user.id, id, true);
  }

  @Post("groups/:id/resume")
  @HttpCode(HttpStatus.OK)
  resumeGroup(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.setGroupPaused(user.id, id, false);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.findOne(user.id, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateAlertDto) {
    return this.alertsService.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.alertsService.remove(user.id, id);
  }

  @Post(":id/pause")
  @HttpCode(HttpStatus.OK)
  pause(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.pause(user.id, id);
  }

  @Post(":id/resume")
  @HttpCode(HttpStatus.OK)
  resume(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.resume(user.id, id);
  }

  @Post(":id/clone")
  clone(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.alertsService.clone(user.id, id);
  }
}
