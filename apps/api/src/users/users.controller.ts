import { Body, Controller, Get, Patch } from "@nestjs/common";
import { UsersService } from "./users.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.usersService.findById(user.id);
    const { passwordHash: _passwordHash, ...safe } = full;
    return safe;
  }

  @Patch("me")
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    const { passwordHash: _passwordHash, ...safe } = updated;
    return safe;
  }

  @Patch("me/settings")
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(user.id, dto);
  }

  @Get("me/subscription")
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.getForUser(user.id);
  }
}
