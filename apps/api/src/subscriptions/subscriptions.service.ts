import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AlertStatus, PlanTier, type Subscription } from "@prisma/client";
import { PLAN_LIMITS } from "@levelpulse/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import type { EnvConfig } from "../common/config/env.validation";

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async createDefaultSubscription(userId: string): Promise<Subscription> {
    return this.prisma.subscription.create({
      data: {
        userId,
        plan: PlanTier.FREE,
        maxActiveAlerts: PLAN_LIMITS[PlanTier.FREE].maxActiveAlerts,
      },
    });
  }

  async getForUser(userId: string): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new NotFoundException("Subscription not found");
    return subscription;
  }

  /**
   * The core capacity gate: throws when a user is at their plan's active-alert ceiling.
   * Every alert-creating path (AlertsModule.create, clone, template instantiation) must
   * call this before writing a new Alert row.
   */
  async assertCanCreateAlert(userId: string): Promise<void> {
    const subscription = await this.getForUser(userId);
    const activeCount = await this.prisma.alert.count({
      where: { userId, status: AlertStatus.ACTIVE },
    });
    if (activeCount >= subscription.maxActiveAlerts) {
      throw new ForbiddenException(
        `You've reached your ${subscription.plan} plan's limit of ${subscription.maxActiveAlerts} active alerts. Upgrade your plan or pause an existing alert to create a new one.`,
      );
    }
  }

  /** Same ceiling as assertCanCreateAlert, for activating several alerts at once (resuming a group). */
  async assertCanActivateAlerts(userId: string, count: number): Promise<void> {
    if (count === 0) return;
    const subscription = await this.getForUser(userId);
    const activeCount = await this.prisma.alert.count({ where: { userId, status: AlertStatus.ACTIVE } });
    if (activeCount + count > subscription.maxActiveAlerts) {
      throw new ForbiddenException(
        `Resuming these ${count} alerts would put you over your ${subscription.plan} plan's limit of ${subscription.maxActiveAlerts} active alerts. Pause or delete some alerts first.`,
      );
    }
  }

  async assertCanCreateWatchlist(userId: string): Promise<void> {
    const subscription = await this.getForUser(userId);
    const count = await this.prisma.watchlist.count({ where: { userId } });
    const limit = PLAN_LIMITS[subscription.plan].maxWatchlists;
    if (count >= limit) {
      throw new ForbiddenException(`You've reached your ${subscription.plan} plan's limit of ${limit} watchlists.`);
    }
  }

  getPlanCatalog() {
    return Object.values(PLAN_LIMITS);
  }

  /**
   * No real Stripe integration yet (see ARCHITECTURE.md). In dev, ENABLE_MOCK_BILLING lets the
   * frontend exercise the full upgrade flow by instantly switching plans; in a real deployment
   * this endpoint should be replaced with a Stripe Checkout session creation call.
   */
  async checkout(userId: string, plan: PlanTier): Promise<Subscription> {
    if (!this.config.get("ENABLE_MOCK_BILLING", { infer: true })) {
      throw new ForbiddenException(
        "Billing is not yet available. Real payment processing has not been configured for this deployment.",
      );
    }
    this.logger.warn(`Mock billing: instantly upgrading user ${userId} to ${plan}`);
    return this.prisma.subscription.update({
      where: { userId },
      data: { plan, maxActiveAlerts: PLAN_LIMITS[plan].maxActiveAlerts },
    });
  }
}
