import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationChannelType, type User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

export interface CreateLocalUserInput {
  email: string;
  passwordHash: string;
  name?: string;
}

export interface CreateOAuthUserInput {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  provider: string;
  providerAccountId: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { subscription: true, settings: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async createLocalUser(input: CreateLocalUserInput): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) throw new ConflictException("An account with this email already exists");

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        name: input.name,
        settings: { create: {} },
      },
    });
    await this.subscriptions.createDefaultSubscription(user.id);
    await this.provisionDefaultEmailChannel(user.id);
    return user;
  }

  /** Finds an existing user by linked Google account or email, else provisions a new one. */
  async findOrCreateFromOAuth(input: CreateOAuthUserInput): Promise<User> {
    const existingAccount = await this.prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: input.provider, providerAccountId: input.providerAccountId } },
      include: { user: true },
    });
    if (existingAccount) return existingAccount.user;

    const existingUser = await this.findByEmail(input.email);
    if (existingUser) {
      await this.prisma.account.create({
        data: {
          userId: existingUser.id,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
        },
      });
      return existingUser;
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name ?? undefined,
        avatarUrl: input.avatarUrl ?? undefined,
        emailVerified: new Date(),
        settings: { create: {} },
        accounts: {
          create: { provider: input.provider, providerAccountId: input.providerAccountId },
        },
      },
    });
    await this.subscriptions.createDefaultSubscription(user.id);
    await this.provisionDefaultEmailChannel(user.id);
    return user;
  }

  /** Used by the magic-link flow: same provisioning as OAuth but with no external account row. */
  async findOrCreateByEmail(email: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        emailVerified: new Date(),
        settings: { create: {} },
      },
    });
    await this.subscriptions.createDefaultSubscription(user.id);
    await this.provisionDefaultEmailChannel(user.id);
    return user;
  }

  // Email is the one channel every account inherently has (unlike push/Telegram/Discord, which
  // need an explicit device/connection), so it's enabled by default at signup instead of leaving
  // alert emails silently undeliverable until the user finds a toggle for something they'd expect
  // to just work.
  private async provisionDefaultEmailChannel(userId: string): Promise<void> {
    await this.prisma.notificationChannel.upsert({
      where: { userId_type: { userId, type: NotificationChannelType.EMAIL } },
      update: {},
      create: { userId, type: NotificationChannelType.EMAIL, config: {}, isEnabled: true, isVerified: true },
    });
  }

  async updateProfile(userId: string, data: { name?: string; timezone?: string; currency?: string }) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  async updateSettings(userId: string, data: { theme?: string; defaultChartInterval?: string; emailDigestEnabled?: boolean; soundEnabled?: boolean }) {
    return this.prisma.userSettings.update({ where: { userId }, data });
  }
}
