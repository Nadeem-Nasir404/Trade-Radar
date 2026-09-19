import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { UserRole } from "@prisma/client";
import { AdminService } from "./admin.service";
import { Roles } from "../common/decorators/roles.decorator";

class SuspendUserDto {
  @IsString()
  reason!: string;
}

class SetEnabledDto {
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("dashboard")
  dashboard() {
    return this.admin.getDashboardStats();
  }

  @Get("users")
  users(@Query("search") search?: string) {
    return this.admin.listUsers(search);
  }

  @Patch("users/:id/suspend")
  suspend(@Param("id") id: string, @Body() dto: SuspendUserDto) {
    return this.admin.suspendUser(id, dto.reason);
  }

  @Patch("users/:id/unsuspend")
  unsuspend(@Param("id") id: string) {
    return this.admin.unsuspendUser(id);
  }

  @Get("providers")
  providers() {
    return this.admin.listProviders();
  }

  @Patch("providers/:id")
  setProviderEnabled(@Param("id") id: string, @Body() dto: SetEnabledDto) {
    return this.admin.setProviderEnabled(id, dto.isEnabled ?? true);
  }

  @Get("instruments")
  instruments() {
    return this.admin.listInstruments();
  }

  @Patch("instruments/:id")
  setInstrumentActive(@Param("id") id: string, @Body() dto: SetEnabledDto) {
    return this.admin.setInstrumentActive(id, dto.isActive ?? true);
  }

  @Get("notifications/failed")
  failedNotifications() {
    return this.admin.listFailedNotifications();
  }

  @Get("logs")
  logs() {
    return this.admin.listSystemEvents();
  }
}
