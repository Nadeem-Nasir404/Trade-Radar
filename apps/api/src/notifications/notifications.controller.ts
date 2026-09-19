import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { NotificationChannelType } from "@prisma/client";
import { NotificationsService } from "./notifications.service";
import { ConnectDiscordDto } from "./dto/connect-discord.dto";
import { SubscribeWebPushDto } from "./dto/subscribe-webpush.dto";
import { RegisterExpoPushDto } from "./dto/register-expo-push.dto";
import { TestNotificationDto } from "./dto/test-notification.dto";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("channels")
  listChannels(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listChannels(user.id);
  }

  @Get("webpush/vapid-public-key")
  @Public()
  getVapidPublicKey() {
    return { publicKey: this.notifications.getVapidPublicKey() };
  }

  @Post("webpush/subscribe")
  @HttpCode(HttpStatus.OK)
  async subscribeWebPush(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubscribeWebPushDto, @Req() req: Request) {
    await this.notifications.subscribeWebPush(user.id, dto, req.headers["user-agent"]);
    return { success: true };
  }

  @Post("webpush/unsubscribe")
  @HttpCode(HttpStatus.OK)
  async unsubscribeWebPush(@CurrentUser() user: AuthenticatedUser, @Body("endpoint") endpoint: string) {
    await this.notifications.unsubscribeWebPush(user.id, endpoint);
    return { success: true };
  }

  @Post("expo-push/register")
  @HttpCode(HttpStatus.OK)
  async registerExpoPush(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterExpoPushDto) {
    await this.notifications.registerExpoPushToken(user.id, dto.token);
    return { success: true };
  }

  @Post("discord/connect")
  connectDiscord(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConnectDiscordDto) {
    return this.notifications.connectDiscord(user.id, dto.webhookUrl);
  }

  @Post("email/toggle")
  @HttpCode(HttpStatus.OK)
  toggleEmail(@CurrentUser() user: AuthenticatedUser, @Body("isEnabled") isEnabled: boolean) {
    return this.notifications.setEmailEnabled(user.id, isEnabled);
  }

  @Post("telegram/link")
  requestTelegramLink(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.generateTelegramLinkCode(user.id);
  }

  @Delete("channels/:type")
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthenticatedUser, @Param("type") type: NotificationChannelType) {
    await this.notifications.disconnectChannel(user.id, type);
  }

  @Post("test")
  @HttpCode(HttpStatus.OK)
  async test(@CurrentUser() user: AuthenticatedUser, @Body() dto: TestNotificationDto) {
    await this.notifications.sendTest(user.id, dto.channelType);
    return { success: true, message: `Test notification queued for ${dto.channelType}` };
  }

  /** Public webhook Telegram calls when a user sends `/start <code>` to the bot. */
  @Public()
  @Post("telegram/webhook")
  @HttpCode(HttpStatus.OK)
  async telegramWebhook(@Body() update: TelegramUpdate) {
    const text = update.message?.text;
    const chatId = update.message?.chat?.id;
    if (text?.startsWith("/start ") && chatId) {
      const code = text.replace("/start ", "").trim();
      await this.notifications.completeTelegramLink(code, chatId);
    }
    return { ok: true };
  }
}
