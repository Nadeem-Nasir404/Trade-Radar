import { Body, Controller, Get, Post } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { CheckoutDto } from "./dto/checkout.dto";
import { Public } from "../common/decorators/public.decorator";

@Controller("subscription")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.getForUser(user.id);
  }

  @Public()
  @Get("plans")
  plans() {
    return this.subscriptions.getPlanCatalog();
  }

  @Post("checkout")
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto) {
    return this.subscriptions.checkout(user.id, dto.plan);
  }
}
